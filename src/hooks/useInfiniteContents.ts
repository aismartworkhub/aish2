"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getContentsPaginated, type ContentsPage } from "@/lib/content-engine";
import type { Content, BoardGroup } from "@/types/content";

export type UseInfiniteContentsOptions = {
  boardKey?: string;
  /** 다중 보드 IN 쿼리 — boardKey보다 우선. 최대 30개. */
  boardKeys?: string[];
  group?: BoardGroup;
  tags?: string[];
  searchTerms?: string[];
  pageSize?: number;
  /**
   * 첫 페이지에만 적용되는 작은 크기 — Above-the-fold 가속용.
   * 미지정 시 pageSize와 동일.
   * 권장값: 6 (모바일 1열 / 데스크톱 한 화면 채울 수)
   */
  firstPageSize?: number;
  /** 첫 페이지 로드 후 idle 시 다음 페이지 prefetch (기본 true) */
  idlePrefetch?: boolean;
  /** true면 의존성 변경 시 처음부터 다시 로드 (기본값) */
  resetOnDeps?: boolean;
};

/** requestIdleCallback 폴백 (Safari 미지원) */
function scheduleIdle(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  type IdleCallbackHandle = number;
  type IdleWindow = Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => IdleCallbackHandle;
    cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
  };
  const w = window as IdleWindow;
  if (typeof w.requestIdleCallback === "function") {
    const handle = w.requestIdleCallback(callback, { timeout: 1500 });
    return () => w.cancelIdleCallback?.(handle);
  }
  const t = window.setTimeout(callback, 300);
  return () => window.clearTimeout(t);
}

export type UseInfiniteContentsResult = {
  items: Content[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  /** Intersection Observer 트리거를 부착할 ref */
  sentinelRef: (el: HTMLDivElement | null) => void;
  /** 외부에서 강제 새로고침 */
  refresh: () => void;
};

/**
 * Firestore contents 컬렉션 무한 스크롤 훅.
 * - getContentsPaginated 기반 cursor 페이징
 * - Intersection Observer로 sentinel이 뷰포트 200px 위에 들어오면 다음 페이지 자동 로드
 * - 옵션(boardKey, group, tags, searchTerms) 변경 시 처음부터 재로드
 */
export function useInfiniteContents(
  opts: UseInfiniteContentsOptions,
): UseInfiniteContentsResult {
  const pageSize = opts.pageSize ?? 24;
  const firstPageSize = opts.firstPageSize ?? pageSize;
  const idlePrefetchEnabled = opts.idlePrefetch ?? true;
  const [items, setItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<ContentsPage["lastDoc"]>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const tickRef = useRef(0); // 옵션 변경 race condition 방지용

  // 의존성 시리얼라이즈 (배열도 안정적으로 비교)
  const depKey = JSON.stringify({
    b: opts.boardKey ?? null,
    bs: opts.boardKeys ?? null,
    g: opts.group ?? null,
    t: opts.tags ?? null,
    s: opts.searchTerms ?? null,
  });

  const loadFirst = useCallback(async () => {
    const myTick = ++tickRef.current;
    setLoading(true);
    setError(null);
    lastDocRef.current = null;
    try {
      // ATF 가속: 첫 페이지는 firstPageSize(작게)로 → 화면 빠르게 채움
      const page = await getContentsPaginated({
        boardKey: opts.boardKey,
        boardKeys: opts.boardKeys,
        group: opts.group,
        tags: opts.tags,
        searchTerms: opts.searchTerms,
        limit: firstPageSize,
      });
      if (tickRef.current !== myTick) return;
      setItems(page.items);
      lastDocRef.current = page.lastDoc;
      setHasMore(page.hasMore);
    } catch (e) {
      if (tickRef.current !== myTick) return;
      setError(e instanceof Error ? e.message : "콘텐츠를 불러오지 못했습니다.");
      setItems([]);
      setHasMore(false);
    } finally {
      if (tickRef.current === myTick) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey, firstPageSize]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    if (!lastDocRef.current) return;
    const myTick = tickRef.current;
    setLoadingMore(true);
    try {
      const page = await getContentsPaginated({
        boardKey: opts.boardKey,
        boardKeys: opts.boardKeys,
        group: opts.group,
        tags: opts.tags,
        searchTerms: opts.searchTerms,
        lastDoc: lastDocRef.current,
        limit: pageSize,
      });
      if (tickRef.current !== myTick) return;
      setItems((prev) => [...prev, ...page.items]);
      lastDocRef.current = page.lastDoc;
      setHasMore(page.hasMore);
    } catch {
      if (tickRef.current !== myTick) return;
      setHasMore(false);
    } finally {
      if (tickRef.current === myTick) setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey, pageSize, hasMore, loadingMore, loading]);

  // 옵션 변경 시 첫 페이지 로드
  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  // 첫 페이지 로드 후 idle 시 다음 페이지 백그라운드 prefetch
  // (스크롤 시작 시 이미 데이터 준비 완료 → 무한 스크롤 끊김 없음)
  useEffect(() => {
    if (!idlePrefetchEnabled) return;
    if (loading || loadingMore) return;
    if (!hasMore) return;
    if (items.length === 0) return;
    // 첫 페이지보다 작거나 같은 경우(=초기 로드 직후)에만 prefetch
    if (items.length > firstPageSize) return;
    const cancel = scheduleIdle(() => { void loadMore(); });
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingMore, hasMore, items.length, idlePrefetchEnabled, firstPageSize]);

  // Intersection Observer 부착
  const sentinelRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!el) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              void loadMore();
            }
          }
        },
        { rootMargin: "200px" },
      );
      observerRef.current.observe(el);
    },
    [loadMore],
  );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    sentinelRef,
    refresh: () => void loadFirst(),
  };
}
