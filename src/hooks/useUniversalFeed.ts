"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore";
import { getContentsPaginated } from "@/lib/content-engine";
import type { Content } from "@/types/content";
import type { Program, AdminEvent, Instructor } from "@/types/firestore";
import type { FeedItem, FeedItemKind, FeedCategoryKey, FeedFetchOpts } from "@/types/feed";

/* ── 유틸: createdAt/lastActivityAt → epoch ms ─────────────────── */

function toMs(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "string") {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  const ts = v as { toDate?: () => Date; seconds?: number };
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

/** 활동순 정렬 키 = lastActivityAt 우선, 폴백 createdAt */
function activitySortKey(c: Content): number {
  return toMs(c.lastActivityAt) || toMs(c.createdAt);
}

/* ── 페치 ─────────────────────────────────────────────────────── */

async function fetchContentsForFeed(opts: {
  group?: "media" | "community";
  pageSize: number;
  activitySort: boolean;
}): Promise<Content[]> {
  // 활동순 정렬 — Firestore에서 lastActivityAt 미존재 doc은 결과에서 빠질 수 있으므로
  // createdAt 정렬로 가져온 뒤 클라이언트에서 lastActivityAt || createdAt으로 재정렬.
  const page = await getContentsPaginated({
    group: opts.group,
    limit: Math.max(opts.pageSize * 2, 30), // 여유 있게 가져와서 클라 정렬
  });
  const items = page.items;
  if (opts.activitySort) {
    items.sort((a, b) => activitySortKey(b) - activitySortKey(a));
  }
  return items.slice(0, opts.pageSize);
}

async function fetchPrograms(maxItems: number): Promise<Program[]> {
  try {
    const q = query(
      collection(db, COLLECTIONS.PROGRAMS),
      orderBy("startDate", "desc"),
      firestoreLimit(maxItems),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Program, "id">) }));
  } catch {
    return [];
  }
}

async function fetchEvents(maxItems: number): Promise<AdminEvent[]> {
  try {
    const q = query(
      collection(db, COLLECTIONS.ADMIN_EVENTS),
      where("status", "in", ["recruiting", "upcoming", "ongoing", "open"]),
      firestoreLimit(maxItems),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminEvent, "id">) }));
  } catch {
    // status 인덱스 없으면 단순 페치
    try {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.ADMIN_EVENTS),
        firestoreLimit(maxItems),
      ));
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminEvent, "id">) }));
    } catch { return []; }
  }
}

async function fetchInstructors(maxItems: number): Promise<Instructor[]> {
  try {
    const snap = await getDocs(query(
      collection(db, COLLECTIONS.INSTRUCTORS),
      firestoreLimit(maxItems),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Instructor, "id">) }));
  } catch {
    return [];
  }
}

/* ── 인터리브 ─────────────────────────────────────────────────── */

/**
 * 콘텐츠 배열에 program/instructor/event를 N번째 슬롯에 삽입.
 * 핀 항목은 결과 최상단에 그대로 유지.
 */
function interleaveFeed(
  contents: FeedItem[],
  programs: FeedItem[],
  instructors: FeedItem[],
  events: FeedItem[],
  intervals: { program: number; instructor: number; event: number },
): FeedItem[] {
  // 핀 분리
  const pinned = contents.filter((c) => c.pinned);
  const unpinned = contents.filter((c) => !c.pinned);

  const result: FeedItem[] = [...pinned];
  let pIdx = 0;
  let iIdx = 0;
  let eIdx = 0;

  for (let n = 0; n < unpinned.length; n++) {
    result.push(unpinned[n]);
    const slot = n + 1; // 1-based 위치 (핀 제외)
    if (intervals.program > 0 && slot % intervals.program === 0 && pIdx < programs.length) {
      result.push(programs[pIdx++]);
    }
    if (intervals.instructor > 0 && slot % intervals.instructor === 0 && iIdx < instructors.length) {
      result.push(instructors[iIdx++]);
    }
    if (intervals.event > 0 && slot % intervals.event === 0 && eIdx < events.length) {
      result.push(events[eIdx++]);
    }
  }
  return result;
}

/* ── 카테고리별 단일 종류 페치 ───────────────────────────────── */

async function fetchSingleCategory(
  category: Exclude<FeedCategoryKey, "all">,
  pageSize: number,
  activitySort: boolean,
): Promise<FeedItem[]> {
  if (category === "media" || category === "community") {
    const contents = await fetchContentsForFeed({ group: category, pageSize, activitySort });
    return contents.map((c): FeedItem => ({
      id: c.id,
      kind: "content",
      pinned: c.isPinned,
      sortKey: activitySortKey(c),
      data: c,
    }));
  }
  if (category === "content") {
    const contents = await fetchContentsForFeed({ pageSize, activitySort });
    return contents.map((c): FeedItem => ({
      id: c.id,
      kind: "content",
      pinned: c.isPinned,
      sortKey: activitySortKey(c),
      data: c,
    }));
  }
  if (category === "program") {
    const programs = await fetchPrograms(pageSize);
    return programs.map((p): FeedItem => ({
      id: p.id ?? p.title,
      kind: "program",
      sortKey: toMs(p.startDate),
      data: p,
    }));
  }
  if (category === "event") {
    const events = await fetchEvents(pageSize);
    return events.map((e): FeedItem => ({
      id: e.id ?? e.title,
      kind: "event",
      sortKey: toMs(e.startDate),
      data: e,
    }));
  }
  // instructor
  const instructors = await fetchInstructors(pageSize);
  return instructors.map((i, idx): FeedItem => ({
    id: i.id ?? `inst-${idx}`,
    kind: "instructor",
    sortKey: 0,
    data: i,
  }));
}

/* ── Hook ─────────────────────────────────────────────────────── */

export interface UseUniversalFeedResult {
  items: FeedItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useUniversalFeed(opts: FeedFetchOpts & { activitySort?: boolean }): UseUniversalFeedResult {
  const {
    category,
    pageSize = 20,
    interleaveProgram = 5,
    interleaveInstructor = 8,
    interleaveEvent = 10,
    activitySort = true,
  } = opts;

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const depKey = useMemo(
    () => JSON.stringify({ category, pageSize, interleaveProgram, interleaveInstructor, interleaveEvent, activitySort }),
    [category, pageSize, interleaveProgram, interleaveInstructor, interleaveEvent, activitySort],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (category === "all") {
        // 6개 소스 병렬 페치
        const [contents, programs, events, instructors] = await Promise.all([
          fetchContentsForFeed({ pageSize, activitySort }),
          fetchPrograms(Math.ceil(pageSize / 4)),
          fetchEvents(Math.ceil(pageSize / 4)),
          fetchInstructors(Math.ceil(pageSize / 4)),
        ]);
        const contentItems: FeedItem[] = contents.map((c) => ({
          id: c.id, kind: "content", pinned: c.isPinned, sortKey: activitySortKey(c), data: c,
        }));
        const programItems: FeedItem[] = programs.map((p): FeedItem => ({
          id: p.id ?? p.title, kind: "program", sortKey: toMs(p.startDate), data: p,
        }));
        const eventItems: FeedItem[] = events.map((e): FeedItem => ({
          id: e.id ?? e.title, kind: "event", sortKey: toMs(e.startDate), data: e,
        }));
        const instItems: FeedItem[] = instructors.map((i, idx): FeedItem => ({
          id: i.id ?? `inst-${idx}`, kind: "instructor", sortKey: 0, data: i,
        }));
        const merged = interleaveFeed(
          contentItems,
          programItems,
          instItems,
          eventItems,
          { program: interleaveProgram, instructor: interleaveInstructor, event: interleaveEvent },
        );
        setItems(merged);
      } else {
        const single = await fetchSingleCategory(category as Exclude<FeedCategoryKey, "all">, pageSize, activitySort);
        // 핀 우선 정렬
        single.sort((a, b) => {
          if ((a.pinned ?? false) !== (b.pinned ?? false)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
          return b.sortKey - a.sortKey;
        });
        setItems(single);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "피드를 불러오지 못했습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, refresh: () => void load() };
}

/** "content" 카테고리 키는 FeedItemKind와 매핑 — 확장용 */
export type { FeedItemKind };
