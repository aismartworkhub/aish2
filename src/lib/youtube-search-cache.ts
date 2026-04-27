/**
 * YouTube 검색 결과 localStorage 캐시 (TTL 24h).
 *
 * - 같은 검색 옵션을 짧은 시간에 반복 시 API 호출 절약 + 즉시 표시
 * - localStorage 사용 — 탭/브라우저 재시작 후에도 24h 동안 결과 보존
 * - 캐시 키는 publishedAfter를 일(YYYY-MM-DD) 단위로 라운딩하여
 *   같은 날 같은 옵션이면 항상 일치 (Date.now() sub-second 차이 회피)
 */

import type { YoutubeSearchOpts, YoutubeVideoDetail } from "./youtube-search";

const PREFIX = "yt-search-cache:";
const TTL_MS = 24 * 60 * 60 * 1000;
const STORAGE_QUOTA_GUARD = 4 * 1024 * 1024; // 4MB — 한 항목 너무 크면 저장 스킵

type CacheEntry = {
  ts: number;
  items: YoutubeVideoDetail[];
};

/** publishedAfter ISO 문자열을 'YYYY-MM-DD'로 자른다. 빈 값은 그대로. */
function dayPart(iso: string | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : iso;
}

function keyFor(opts: YoutubeSearchOpts): string {
  const norm = {
    q: opts.q,
    categoryId: opts.categoryId ?? "",
    minViews: opts.minViews ?? 0,
    minSubscribers: opts.minSubscribers ?? 0,
    publishedAfter: dayPart(opts.publishedAfter),
    order: opts.order ?? "",
    videoDuration: opts.videoDuration ?? "",
    maxResults: opts.maxResults ?? 25,
    regionCode: opts.regionCode ?? "",
    relevanceLanguage: opts.relevanceLanguage ?? "",
  };
  return PREFIX + JSON.stringify(norm);
}

function getStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function readSearchCache(opts: YoutubeSearchOpts): YoutubeVideoDetail[] | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(keyFor(opts));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.ts > TTL_MS) {
      storage.removeItem(keyFor(opts));
      return null;
    }
    return entry.items;
  } catch {
    return null;
  }
}

/** 캐시 존재 여부만 확인 (UI 배지용). 만료된 경우는 false. */
export function hasSearchCache(opts: YoutubeSearchOpts): boolean {
  return readSearchCache(opts) !== null;
}

export function writeSearchCache(opts: YoutubeSearchOpts, items: YoutubeVideoDetail[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const entry: CacheEntry = { ts: Date.now(), items };
    const payload = JSON.stringify(entry);
    if (payload.length > STORAGE_QUOTA_GUARD) return; // 단일 항목 과대 시 스킵
    storage.setItem(keyFor(opts), payload);
  } catch {
    // QuotaExceededError 등은 무시 — 가장 오래된 항목 정리 후 재시도
    pruneOldest();
    try {
      const entry: CacheEntry = { ts: Date.now(), items };
      storage.setItem(keyFor(opts), JSON.stringify(entry));
    } catch {
      /* 그래도 실패하면 포기 */
    }
  }
}

/** localStorage가 가득 찼을 때 가장 오래된 항목 절반을 정리한다. */
function pruneOldest(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const items: { key: string; ts: number }[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      try {
        const raw = storage.getItem(k);
        if (!raw) continue;
        const entry = JSON.parse(raw) as CacheEntry;
        items.push({ key: k, ts: entry.ts });
      } catch {
        items.push({ key: k, ts: 0 });
      }
    }
    items.sort((a, b) => a.ts - b.ts);
    const toRemove = items.slice(0, Math.ceil(items.length / 2));
    for (const it of toRemove) storage.removeItem(it.key);
  } catch {
    /* ignore */
  }
}
