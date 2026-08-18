/**
 * 系統常數：Firestore collection 名、列舉、採購法門檻預設值。
 *
 * 重要：採購法金額門檻會由行政院公共工程委員會不定期修訂。
 * 這裡的數字僅為初始預設，正式上線前與每年初都需人工核對工程會最新公告，
 * 且實際運行時應以 Firestore `settings/global` 的值為準（可後台調整，不必改 code）。
 */

export const COLLECTIONS = {
  profiles: "profiles",
  tenders: "tenders",
  notifications: "notifications",
  analyses: "analyses",
  awards: "awards",
  settings: "settings",
} as const;

/** 標的分類（採購法三大類） */
export const CATEGORIES = ["勞務", "財物", "工程"] as const;
export type Category = (typeof CATEGORIES)[number];

/** 招標方式 */
export const TENDER_WAYS = [
  "公開招標",
  "公開取得報價單或企劃書",
  "限制性招標",
  "選擇性招標",
  "其他",
] as const;
export type TenderWay = (typeof TENDER_WAYS)[number];

/** 決標方式 */
export const AWARD_WAYS = [
  "最低標",
  "最有利標",
  "評分及格最低標",
  "複數決標",
  "準用最有利標",
  "其他",
] as const;
export type AwardWay = (typeof AWARD_WAYS)[number];

/** 案件狀態機（見 SPEC.md 模組 C） */
export const TENDER_STATUSES = [
  "new", // 新推播
  "watching", // 考慮中
  "analyzing", // 分析中
  "go", // 決定投標
  "no_go", // 放棄（需填原因）
  "submitted", // 已投標
  "won", // 得標
  "lost", // 未得標
] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

/** 初篩紅黃綠燈 */
export const FEASIBILITY_LIGHTS = ["green", "yellow", "red"] as const;
export type FeasibilityLight = (typeof FEASIBILITY_LIGHTS)[number];

/**
 * 採購法門檻預設值（新台幣元）。
 * 數字為 schema 設計參考，非法律意見；上線前務必核對工程會公告。
 */
export const DEFAULT_THRESHOLDS = {
  /** 公告金額（2023-01-01 起調整為 150 萬） */
  publicNoticeAmount: 1_500_000,
  /** 查核金額（勞務） */
  auditAmountService: 10_000_000,
  /** 巨額採購（勞務） */
  hugeAmountService: 20_000_000,
  /** 小額採購上限 */
  smallAmount: 150_000,
  /** 押標金上限比率（占底價/預算） */
  bondMaxRatio: 0.05,
} as const;

/** 本公司基本資料（用於資格自動比對，可後台調整） */
export const DEFAULT_COMPANY_PROFILE = {
  /** 實收資本額（元） */
  capital: 10_000_000,
  /** 已具備的登記/證照（比對招標資格用） */
  licenses: [] as string[],
  /** 可佐證的同類實績案數（新公司通常為 0） */
  pastPerformanceCount: 0,
} as const;

/** 反爬蟲節流預設參數（見 SPEC.md 1.3） */
export const DEFAULT_CRAWL_POLICY = {
  minDelayMs: 5000,
  jitterMs: 3000,
  dailyRequestCap: 300,
  maxConsecutiveFailures: 3,
  userAgent: "GovTenderRadar/0.1 (private research tool; contact: set-your-email)",
} as const;
