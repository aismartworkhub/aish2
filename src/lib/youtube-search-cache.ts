/**
 * YouTube 검색 결과 sessionStorage 캐시 (TTL 24h).
 * 같은 검색 옵션을 짧은 시간에 반복 시 API 호출 절약 + 즉시 표시.
 */

import type { YoutubeSearchOpts, YoutubeVideoDetail } from "./youtube-search";

const PREFIX = "yt-search-cache:";
const TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = {
  ts: number;
  items: YoutubeVideoDetail[];
};

function keyFor(opts: YoutubeSearchOpts): string {
  const norm = {
    q: opts.q,
    categoryId: opts.categoryId ?? "",
    minViews: opts.minViews ?? 0,
    minSubscribers: opts.minSubscribers ?? 0,
    publishedAfter: opts.publishedAfter ?? "",
    order: opts.order ?? "",
    videoDuration: opts.videoDuration ?? "",
    maxResults: opts.maxResults ?? 25,
    regionCode: opts.regionCode ?? "",
    relevanceLanguage: opts.relevanceLanguage ?? "",
  };
  return PREFIX + JSON.stringify(norm);
}

export function readSearchCache(opts: YoutubeSearchOpts): YoutubeVideoDetail[] | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(keyFor(opts));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.ts > TTL_MS) {
      sessionStorage.removeItem(keyFor(opts));
      return null;
    }
    return entry.items;
  } catch {
    return null;
  }
}

export function writeSearchCache(opts: YoutubeSearchOpts, items: YoutubeVideoDetail[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const entry: CacheEntry = { ts: Date.now(), items };
    sessionStorage.setItem(keyFor(opts), JSON.stringify(entry));
  } catch {
    // QuotaExceededError 등은 무시 — 캐시는 부가 기능
  }
}
