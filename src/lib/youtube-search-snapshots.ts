/**
 * YouTube 검색 결과 스냅샷 — localStorage 영구 보관 (최근 20건 LRU).
 *
 * 24h 캐시(youtube-search-cache)와 분리:
 * - 캐시: 같은 옵션 재검색 즉시 복원용 — opts 해시로 dedup, 24h TTL
 * - 스냅샷: 회차별 영구 기록 — 매 검색마다 새 항목, 20건까지 보존
 *
 * 사용자가 "내가 어제 어떤 영상들을 찾아봤지?"를 회상할 수 있게 한다.
 */

import type { YoutubeVideoDetail } from "./youtube-search";
import type { SearchOptsSnapshot } from "./youtube-search-history";

const KEY = "yt-search-snapshots-v1";
const MAX = 20;
const STORAGE_GUARD = 4 * 1024 * 1024; // 4MB — 한 번에 너무 많이 쓰면 거부

/** 표시에 충분한 최소 필드만 보관 (저장 용량 최적화) */
export type SnapshotItem = {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId: string;
  thumbnailUrl: string;
  url: string;
  viewCount: number;
  publishedAt: string;
  durationSeconds: number;
};

export type SearchSnapshot = {
  ts: number;
  opts: SearchOptsSnapshot;
  foundCount: number;
  existsInAishCount: number;
  /** 캐시 hit으로 복원된 결과인지 여부 */
  fromCache: boolean;
  items: SnapshotItem[];
};

function getStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function getSnapshots(): SearchSnapshot[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as SearchSnapshot[];
    if (!Array.isArray(all)) return [];
    return all.sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

function trimItem(v: YoutubeVideoDetail): SnapshotItem {
  return {
    videoId: v.videoId,
    title: v.title,
    channelTitle: v.channelTitle,
    channelId: v.channelId,
    thumbnailUrl: v.thumbnailUrl,
    url: v.url,
    viewCount: v.viewCount,
    publishedAt: v.publishedAt,
    durationSeconds: v.durationSeconds,
  };
}

export interface SaveSnapshotInput {
  opts: SearchOptsSnapshot;
  items: YoutubeVideoDetail[];
  existsInAishCount: number;
  fromCache: boolean;
}

export function saveSnapshot(input: SaveSnapshotInput): void {
  const storage = getStorage();
  if (!storage) return;
  // 빈 결과는 회차로 남기지 않음
  if (input.items.length === 0) return;
  try {
    const snapshot: SearchSnapshot = {
      ts: Date.now(),
      opts: input.opts,
      foundCount: input.items.length,
      existsInAishCount: input.existsInAishCount,
      fromCache: input.fromCache,
      items: input.items.map(trimItem),
    };
    const existing = getSnapshots();
    const next = [snapshot, ...existing].slice(0, MAX);
    const payload = JSON.stringify(next);
    if (payload.length > STORAGE_GUARD) {
      // 한도 초과 시 더 짧은 리스트로 재시도
      const reduced = [snapshot, ...existing.slice(0, Math.max(1, Math.floor(MAX / 2)))];
      storage.setItem(KEY, JSON.stringify(reduced));
      return;
    }
    storage.setItem(KEY, payload);
  } catch {
    // QuotaExceededError 등은 무시
    try {
      // 가장 짧게 1건만 보관
      const fallback: SearchSnapshot = {
        ts: Date.now(),
        opts: input.opts,
        foundCount: input.items.length,
        existsInAishCount: input.existsInAishCount,
        fromCache: input.fromCache,
        items: input.items.slice(0, 10).map(trimItem),
      };
      storage.setItem(KEY, JSON.stringify([fallback]));
    } catch {
      /* ignore */
    }
  }
}

export function removeSnapshot(ts: number): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const next = getSnapshots().filter((s) => s.ts !== ts);
    storage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearSnapshots(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const SNAPSHOTS_MAX = MAX;
