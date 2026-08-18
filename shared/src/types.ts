/**
 * Firestore 文件型別定義。整個系統（web + worker）共用這一份 contract。
 * 時間欄位一律用 ISO 8601 字串儲存（跨 web/worker/LLM 邊界最不易出錯）。
 */

import type {
  AwardWay,
  Category,
  FeasibilityLight,
  TenderStatus,
  TenderWay,
} from "./constants.js";

/** 模組 A：訂閱條件 Profile */
export interface Profile {
  id: string;
  name: string;
  /** 標案名稱命中任一即入選（OR） */
  keywordsInclude: string[];
  /** 必須全部命中（AND，可空） */
  keywordsRequire: string[];
  /** 命中任一即排除 */
  keywordsExclude: string[];
  /** 標的分類過濾（預設只勾勞務） */
  categories: Category[];
  /** 預算下限（元，0＝不限） */
  budgetMin: number;
  /** 預算上限（元，0＝不限） */
  budgetMax: number;
  /** 機關名稱包含（可空＝不限） */
  orgInclude: string[];
  /** 機關名稱排除 */
  orgExclude: string[];
  /** 招標方式過濾（可空＝全收） */
  tenderWays: TenderWay[];
  /** 履約地點縣市過濾（可空） */
  regions: string[];
  /** 推播目的地 LINE 群組 ID */
  lineTarget: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** LLM 解析後的資格條件結構化欄位 */
export interface QualificationParsed {
  /** 要求的實收資本額（元），無則 null */
  requiredCapital: number | null;
  /** 要求的登記/證照 */
  requiredLicenses: string[];
  /** 是否要求同類實績 */
  requiresPastPerformance: boolean;
  /** 其他重點（自由文字條列） */
  notes: string[];
}

/** 模組 B/C：標案主檔 */
export interface Tender {
  id: string; // = hash(案號 + 機關代碼)
  jobNumber: string; // 標案案號
  title: string;
  orgName: string;
  orgId: string;
  category: Category | null;
  procurementLawCategory: string | null; // 採購法標的分類細項
  budget: number | null; // 元
  budgetDisclosed: boolean; // 是否公開預算金額
  tenderWay: TenderWay | null;
  awardWay: AwardWay | null;
  publishDate: string | null; // 公告日 ISO
  deadline: string | null; // 截止投標 ISO
  openDate: string | null; // 開標 ISO
  performLocation: string | null;
  performPeriod: string | null;
  bondAmount: number | null; // 押標金
  eBid: boolean | null; // 是否允許電子投標
  qualificationRaw: string | null; // 資格原文
  qualificationParsed: QualificationParsed | null;
  sourceUrl: string;
  source: "gov_web" | "g0v_api" | "opendata"; // 資料來源
  matchedProfiles: string[]; // 命中的 profileId
  status: TenderStatus;
  statusNote: string | null; // no_go 時填原因
  rawSnapshotPath: string | null; // 原始頁面存檔參照
  createdAt: string;
  updatedAt: string;
}

/** 模組 B：推播紀錄 */
export interface Notification {
  id: string;
  tenderId: string;
  profileId: string;
  lineTarget: string;
  messageType: "flex_card" | "summary_list" | "analysis";
  sentAt: string;
  ok: boolean;
  error: string | null;
}

/** D1 單項檢核結果 */
export interface FeasibilityCheck {
  key: string; // e.g. "qualification_capital"
  label: string;
  light: FeasibilityLight;
  detail: string;
}

/** 模組 D：分析結果 */
export interface Analysis {
  tenderId: string;
  /** D1 初篩 */
  score: number; // 0–100
  overallLight: FeasibilityLight;
  checks: FeasibilityCheck[];
  /** D2 獲利粗估（半自動，參數可由使用者調整） */
  profitEstimate: ProfitEstimate | null;
  /** D3 LLM 生成的文字報告 */
  reportMarkdown: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** D2 勞務案獲利試算 */
export interface ProfitEstimate {
  /** 投入人力數 */
  headcount: number;
  /** 履約月數 */
  months: number;
  /** 每人月平均薪資（元） */
  avgMonthlySalary: number;
  /** 勞健保雇主負擔係數（約 1.15–1.20） */
  employerBurdenRatio: number;
  /** 管理費率 */
  overheadRatio: number;
  /** 備標成本（元） */
  bidPrepCost: number;
  /** 預計投標價（元） */
  bidPrice: number;
  /** 各欄位來源標記，避免把推估當確定值 */
  sources: Record<string, "extracted" | "user_input" | "historical_stat">;
}

/** 模組 D：歷史決標（月度 OpenData 匯入） */
export interface Award {
  id: string;
  jobNumber: string;
  orgName: string;
  orgId: string;
  budget: number | null;
  awardAmount: number | null; // 決標金額
  winners: string[]; // 得標廠商
  bidderCount: number | null; // 投標家數
  awardDate: string | null;
  /** 決標金額 / 預算，供行情分析 */
  awardToBudgetRatio: number | null;
}

/** settings/global：全域設定（門檻、爬蟲、LINE、公司資料） */
export interface GlobalSettings {
  thresholds: {
    publicNoticeAmount: number;
    auditAmountService: number;
    hugeAmountService: number;
    smallAmount: number;
    bondMaxRatio: number;
  };
  company: {
    capital: number;
    licenses: string[];
    pastPerformanceCount: number;
  };
  crawl: {
    minDelayMs: number;
    jitterMs: number;
    dailyRequestCap: number;
    maxConsecutiveFailures: number;
    userAgent: string;
  };
  updatedAt: string;
}
