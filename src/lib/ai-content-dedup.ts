/**
 * AI 콘텐츠 중복 방지 유틸리티
 * - 기존 Firestore 콘텐츠의 mediaUrl 기준으로 7일 이내 중복을 걸러낸다.
 * - 기존 중복 데이터를 정리하는 cleanupDuplicates 도 제공한다.
 */

import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS, invalidateCache } from "./firestore";

// ── URL 정규화 ──

export function normalizeUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.hostname = u.hostname.replace(/^www\./, "");

    if (u.hostname.includes("youtube.com") || u.hostname === "youtu.be") {
      const videoId =
        u.searchParams.get("v") ||
        (u.hostname === "youtu.be" ? u.pathname.slice(1) : null);
      if (videoId) return `yt:${videoId}`;
    }

    if (u.hostname === "github.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) return `gh:${parts[0]}/${parts[1]}`;
    }

    return `${u.hostname}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return url.toLowerCase().trim();
  }
}

// ── 7일 이내 기존 URL 목록 조회 ──

export async function getExistingUrls(): Promise<Set<string>> {
  const sevenDaysAgo = Timestamp.fromDate(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  );

  try {
    const q = query(
      collection(db, COLLECTIONS.CONTENTS),
      where("createdAt", ">=", sevenDaysAgo),
    );
    const snap = await getDocs(q);
    const urls = new Set<string>();
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.mediaUrl) urls.add(normalizeUrl(data.mediaUrl));
    });
    return urls;
  } catch {
    return new Set();
  }
}

// ── 중복 필터 (수집 결과에서 기존 URL과 자체 중복 제거) ──

export function filterDuplicates<
  T extends { url?: string; mediaUrl?: string; title: string },
>(items: T[], existingUrls: Set<string>): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const url = normalizeUrl(item.url || item.mediaUrl || "");
    if (!url) return true;

    if (existingUrls.has(url)) return false;
    if (seen.has(url)) return false;

    seen.add(url);
    return true;
  });
}

// ── 기존 중복 콘텐츠 정리 (오래된 것을 남기고 새 것을 삭제) ──

interface ContentDoc {
  id: string;
  mediaUrl?: string;
  title: string;
  createdAt?: { toMillis?: () => number; seconds?: number };
}

function toMillis(ts: ContentDoc["createdAt"]): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

export async function cleanupDuplicates(): Promise<{
  removed: number;
  groups: number;
}> {
  const snap = await getDocs(collection(db, COLLECTIONS.CONTENTS));

  const byUrl = new Map<string, ContentDoc[]>();
  snap.docs.forEach((d) => {
    const data = d.data();
    const url = data.mediaUrl ? normalizeUrl(data.mediaUrl) : null;
    if (!url) return;

    const entry: ContentDoc = {
      id: d.id,
      mediaUrl: data.mediaUrl,
      title: data.title,
      createdAt: data.createdAt,
    };

    const group = byUrl.get(url);
    if (group) group.push(entry);
    else byUrl.set(url, [entry]);
  });

  let removed = 0;
  let groups = 0;

  for (const [, items] of byUrl) {
    if (items.length <= 1) continue;
    groups++;

    items.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));

    for (let i = 1; i < items.length; i++) {
      await deleteDoc(doc(db, COLLECTIONS.CONTENTS, items[i].id));
      removed++;
    }
  }

  if (removed > 0) invalidateCache(COLLECTIONS.CONTENTS);

  return { removed, groups };
}
