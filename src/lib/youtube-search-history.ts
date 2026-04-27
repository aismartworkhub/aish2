/**
 * YouTube 검색 히스토리 — localStorage 기반.
 * - 보관: 최근 30일, 최대 500개 (LRU)
 * - 자동 만료 (getHistory 호출 시 cutoff 미만 항목 제거)
 * - 동일 검색은 dedup하여 최근으로 갱신
 */

const KEY = "yt-search-history-v1";
const MAX = 500;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SearchOptsSnapshot = {
  categoryId: string;
  keywords: string;
  keywordMode: "or" | "and";
  minViews: number;
  minSubs: number;
  periodDays: number;
  order: "viewCount" | "date" | "relevance";
  durations: ("short" | "medium" | "long")[];
  maxResults: 25 | 50;
  useFavoritesOnly: boolean;
};

export type HistoryEntry = {
  ts: number;
  opts: SearchOptsSnapshot;
};

export function getHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(all)) return [];
    const cutoff = Date.now() - TTL_MS;
    const fresh = all.filter((e) => e && typeof e.ts === "number" && e.ts >= cutoff);
    if (fresh.length !== all.length) {
      try { localStorage.setItem(KEY, JSON.stringify(fresh)); } catch { /* quota */ }
    }
    return fresh.sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

export function pushHistory(opts: SearchOptsSnapshot): void {
  if (typeof localStorage === "undefined") return;
  // 빈 검색 무시 (검색어도 없고 선호 채널 모드도 아니면 저장 X)
  if (!opts.keywords?.trim() && !opts.useFavoritesOnly) return;
  try {
    const all = getHistory();
    const dedupKey = JSON.stringify(opts);
    const filtered = all.filter((e) => JSON.stringify(e.opts) !== dedupKey);
    const next = [{ ts: Date.now(), opts }, ...filtered].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // QuotaExceededError 등은 무시 — 히스토리는 부가 기능
  }
}

export function removeHistoryEntry(ts: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    const all = getHistory();
    const next = all.filter((e) => e.ts !== ts);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

/** 시간 차이 → 한국어 상대 시각 ("5분 전", "어제", "3일 전") */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return "방금";
  if (diff < hour) return `${Math.floor(diff / min)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 2 * day) return "어제";
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;
  try {
    return new Date(ts).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

/** 항목들을 오늘/이번 주/이번 달 그룹으로 분류 (이번 달 외는 버림) */
export function groupByPeriod(entries: HistoryEntry[]): {
  today: HistoryEntry[];
  thisWeek: HistoryEntry[];
  thisMonth: HistoryEntry[];
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const today: HistoryEntry[] = [];
  const thisWeek: HistoryEntry[] = [];
  const thisMonth: HistoryEntry[] = [];
  for (const e of entries) {
    if (e.ts >= todayStart) today.push(e);
    else if (e.ts >= weekStart) thisWeek.push(e);
    else if (e.ts >= monthStart) thisMonth.push(e);
  }
  return { today, thisWeek, thisMonth };
}

/** 히스토리 항목 → 짧은 라벨 ("LLM, 파인튜닝" 또는 "선호 채널만") */
export function describeHistoryOpts(opts: SearchOptsSnapshot): string {
  const kw = opts.keywords?.trim();
  if (kw) return kw;
  if (opts.useFavoritesOnly) return "선호 채널 전체";
  return "(빈 검색)";
}
