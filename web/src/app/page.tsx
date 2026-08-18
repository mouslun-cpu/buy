"use client";

import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../lib/firebase";

const statuses = ["new", "watching", "analyzing", "go", "no_go", "submitted", "won", "lost"] as const;
type Status = (typeof statuses)[number];

const statusLabels: Record<Status, string> = {
  new: "新推播",
  watching: "考慮中",
  analyzing: "分析中",
  go: "決定投標",
  no_go: "放棄",
  submitted: "已投標",
  won: "得標",
  lost: "未得標",
};

interface TenderRecord {
  id: string;
  title: string;
  orgName: string;
  jobNumber: string;
  budget: number | null;
  publishedAt: string;
  deadline: string;
  tenderWay: string;
  sourceUrl: string;
  status: Status;
  statusNote: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function formatMoney(value: number | null) {
  return value === null ? "未公開" : `NT$ ${value.toLocaleString("zh-TW")}`;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [tenders, setTenders] = useState<TenderRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [selected, setSelected] = useState<TenderRecord | null>(null);
  const [note, setNote] = useState("");
  const [loadError, setLoadError] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    const deferredInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsStandalone(standalone);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    window.addEventListener("beforeinstallprompt", deferredInstall);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");

    return () => window.removeEventListener("beforeinstallprompt", deferredInstall);
  }, []);

  useEffect(() => {
    if (!user) {
      setTenders([]);
      return;
    }

    return onSnapshot(
      query(collection(db, "tenders"), orderBy("publishedAt", "desc")),
      (snapshot) => {
        setTenders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as TenderRecord));
        setLoadError("");
      },
      () => setLoadError("無法讀取標案資料，請確認登入權限與 Firestore 規則。"),
    );
  }, [user]);

  const visibleTenders = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return tenders.filter((tender) => {
      const matchesKeyword = !keyword || [tender.title, tender.orgName, tender.jobNumber].join(" ").toLowerCase().includes(keyword);
      return matchesKeyword && (statusFilter === "all" || tender.status === statusFilter);
    });
  }, [search, statusFilter, tenders]);

  async function saveTender() {
    if (!selected) return;
    await updateDoc(doc(db, "tenders", selected.id), {
      status: selected.status,
      statusNote: note,
      updatedAt: serverTimestamp(),
    });
    setSelected(null);
  }

  async function deleteTender() {
    if (!selected || !window.confirm(`確定刪除「${selected.title}」？`)) return;
    await deleteDoc(doc(db, "tenders", selected.id));
    setSelected(null);
  }

  async function installApp() {
    if (!installPrompt) {
      setShowInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (!user) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <p className="eyebrow">BUYBUYBUY</p>
          <h1>政府標案工作台</h1>
          <p>把 LINE 推播變成可追蹤、可決策的案件清單。</p>
          <button className="primary-button" onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}>使用 Google 登入</button>
          {!isStandalone && (installPrompt || isIOS) && <button className="login-install-button" onClick={installApp}>加入主畫面</button>}
          {showInstallHelp && <div className="login-install-help">{isIOS ? "請按 Safari 的分享按鈕，選擇「加入主畫面」。" : "請使用 Chrome 或 Edge 開啟此網址，並從瀏覽器選單選擇「安裝應用程式」。"}</div>}
          <small>請以已獲授權的 Google 帳號登入。</small>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><img src="/app-icon.svg" alt="BuyBuyBuy" /><div><strong>BuyBuyBuy</strong><small>政府標案工作台</small></div></div>
        <div className="account">{!isStandalone && (installPrompt || isIOS) && <button className="install-button" onClick={installApp}>加入主畫面</button>}<span>{user.email}</span><button onClick={() => signOut(auth)}>登出</button></div>
      </header>

      {showInstallHelp && <div className="install-help"><strong>加入 BuyBuyBuy</strong><span>{isIOS ? "請按 Safari 的分享按鈕，選擇「加入主畫面」。" : "請使用 Chrome 或 Edge 開啟此網址，並從瀏覽器選單選擇「安裝應用程式」。"}</span><button onClick={() => setShowInstallHelp(false)} aria-label="關閉加入主畫面說明">×</button></div>}

      <section className="workspace">
        <div className="workspace-heading"><div><p className="eyebrow">案件工作台</p><h2>所有推播標案</h2></div><span>{visibleTenders.length} 筆</span></div>
        <div className="filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋標案名稱、機關或案號" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | "all")}><option value="all">全部狀態</option>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div>
        {loadError && <p className="notice">{loadError}</p>}
        {visibleTenders.length === 0 ? <div className="empty"><strong>還沒有可顯示的標案</strong><p>下一次 Worker 推播時，案件會自動寫入這裡。</p></div> : <div className="table-wrap"><table><thead><tr><th>標案</th><th>公告／截止</th><th>預算</th><th>狀態</th><th></th></tr></thead><tbody>{visibleTenders.map((tender) => <tr key={tender.id}><td><strong>{tender.title}</strong><span>{tender.orgName} · {tender.jobNumber}</span></td><td><span>{tender.publishedAt || "—"}</span><small>截止 {tender.deadline || "未提供"}</small></td><td><strong>{formatMoney(tender.budget)}</strong><small>{tender.tenderWay}</small></td><td><span className={`status status-${tender.status}`}>{statusLabels[tender.status]}</span></td><td><button className="text-button" onClick={() => { setSelected(tender); setNote(tender.statusNote ?? ""); }}>管理</button></td></tr>)}</tbody></table></div>}
      </section>

      {selected && <div className="dialog-backdrop" onMouseDown={() => setSelected(null)}><section className="dialog" onMouseDown={(event) => event.stopPropagation()}><div className="dialog-heading"><div><p className="eyebrow">案件管理</p><h2>{selected.title}</h2></div><button onClick={() => setSelected(null)}>×</button></div><a className="source-link" href={selected.sourceUrl} target="_blank" rel="noreferrer">開啟政府採購網資訊頁 ↗</a><label>案件狀態<select value={selected.status} onChange={(event) => setSelected({ ...selected, status: event.target.value as Status })}>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label><label>決策備註<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：確認人力配置後再決定是否投標" /></label><div className="dialog-actions"><button className="danger-button" onClick={deleteTender}>刪除標案</button><button className="primary-button" onClick={saveTender}>儲存案件狀態</button></div></section></div>}
    </main>
  );
}
