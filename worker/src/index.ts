import { load } from "cheerio";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const TENDER_SEARCH_URL =
  "https://web.pcc.gov.tw/prkms/tender/common/basic/readTenderBasic";
const ORGANIZATIONS = ["中華郵政股份有限公司", "台灣電力股份有限公司"];

interface TenderSummary {
  title: string;
  budget: number;
  url: string;
  jobNumber: string;
  orgName: string;
  publishedAt: string;
  deadline: string;
  tenderWay: string;
}

function extractTenderTitle(cellHtml: string) {
  const match = cellHtml.match(/pageCode2Img\("((?:\\.|[^"\\])*)"\)/);
  return match ? JSON.parse(`"${match[1]}"`) : "";
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
  }).format(new Date());
}

function toIsoDate(value: string) {
  const [year, month, day] = value.split("/").map(Number);
  if (!year || !month || !day) return "";
  return `${year + 1911}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function database() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? "./serviceAccount.json";

  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(await readFile(serviceAccountPath, "utf8"))) });
  }

  return getFirestore();
}

async function fetchTodayServiceTenders(organization: string): Promise<TenderSummary[]> {
  const date = today().replaceAll("-", "/");
  const body = new URLSearchParams({
    firstSearch: "false",
    searchType: "basic",
    isBinding: "N",
    isLogIn: "N",
    orgName: organization,
    orgId: "",
    tenderName: "",
    tenderId: "",
    tenderType: "TENDER_DECLARATION",
    tenderWay: "TENDER_WAY_ALL_DECLARATION",
    basicDateType: "isNow",
    tenderStartDate: date,
    tenderEndDate: date,
    basicRadProctrgCate: "RAD_PROCTRG_CATE_3",
    policyAdvocacy: "",
  });
  const response = await fetch(TENDER_SEARCH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "GovTenderRadar/0.1 (private research tool)",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`採購網查詢失敗：${response.status} ${response.statusText}`);
  }

  const $ = load(await response.text());
  return $("tr")
    .toArray()
    .map((row) => {
      const cells = $(row).children("td");
      const title = extractTenderTitle(cells.eq(2).html() ?? "");
      const category = cells.eq(5).text().replaceAll(/\s/g, "");
      const budget = Number(cells.eq(8).text().replaceAll(/\s/g, "").replaceAll(",", ""));
      const path = cells.eq(9).find("a").first().attr("href");
      const url = path ? new URL(path, "https://web.pcc.gov.tw").href : "";
      const numberCell = cells.eq(2).clone();
      numberCell.find("script").remove();

      return {
        title,
        category,
        budget,
        url,
        jobNumber: numberCell.text().trim(),
        orgName: cells.eq(1).text().replaceAll(/\s/g, ""),
        publishedAt: toIsoDate(cells.eq(6).text().replaceAll(/\s/g, "")),
        deadline: toIsoDate(cells.eq(7).text().replaceAll(/\s/g, "")),
        tenderWay: cells.eq(4).text().replaceAll(/\s/g, ""),
      };
    })
    .filter(({ title, category, budget, url }) =>
      Boolean(title && category === "勞務類" && Number.isFinite(budget) && url),
    )
    .map(({ title, budget, url, jobNumber, orgName, publishedAt, deadline, tenderWay }) => ({
      title,
      budget,
      url,
      jobNumber,
      orgName,
      publishedAt,
      deadline,
      tenderWay,
    }));
}

function formatLineMessage(organization: string, tenders: TenderSummary[]) {
  const heading = `${today()}\n${organization}`;
  if (tenders.length === 0) {
    return `${heading}\n\n今日無符合條件的標案。`;
  }

  return [
    heading,
    ...tenders.flatMap(({ title, budget, url }) => [
      "",
      title,
      `NT$ ${budget.toLocaleString("zh-TW")}`,
      url,
    ]),
  ].join("\n");
}

async function saveTenders(tenders: TenderSummary[]) {
  const firestore = await database();
  const newTenders: Array<TenderSummary & { id: string }> = [];

  for (const tender of tenders) {
    const id = createHash("sha256").update(`${tender.orgName}|${tender.jobNumber}`).digest("hex");
    const reference = firestore.collection("tenders").doc(id);
    const existing = await reference.get();
    const data = existing.data();

    await reference.set({
      ...tender,
      sourceUrl: tender.url,
      status: data?.status ?? "new",
      statusNote: data?.statusNote ?? "",
      lastSeenAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });

    if (!existing.exists) newTenders.push({ ...tender, id });
  }

  return newTenders;
}

async function pushLineMessage(message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_GROUP_ID;
  if (!token || !to) {
    throw new Error("請在 worker/.env 設定 LINE_CHANNEL_ACCESS_TOKEN 與 LINE_GROUP_ID。");
  }

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text: message }],
    }),
  });

  if (!response.ok) {
    throw new Error(`LINE 推播失敗：${response.status} ${await response.text()}`);
  }
}

let pushedCount = 0;

for (const organization of ORGANIZATIONS) {
  const tenders = await fetchTodayServiceTenders(organization);
  const newTenders = await saveTenders(tenders);

  if (newTenders.length === 0) continue;

  const message = formatLineMessage(organization, newTenders);
  await pushLineMessage(message);
  await (await database()).collection("notifications").add({
    tenderIds: newTenders.map((tender) => tender.id),
    message,
    messageType: "summary_list",
    sentAt: FieldValue.serverTimestamp(),
    ok: true,
  });
  pushedCount += newTenders.length;
  console.log(`已推播 ${organization} ${newTenders.length} 筆新標案。`);
  console.log(message);
}

if (pushedCount === 0) {
  console.log("沒有新標案，未發送 LINE 訊息。");
}
