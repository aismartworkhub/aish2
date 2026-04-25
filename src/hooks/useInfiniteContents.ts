"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getContentsPaginated, type ContentsPage } from "@/lib/content-engine";
import type { Content, BoardGroup } from "@/types/content";

export type UseInfiniteContentsOptions = {
  boardKey?: string;
  group?: BoardGroup;
  tags?: string[];
  searchTerms?: string[];
  pageSize?: number;
  /** true면 의존성 변경 시 처음부터 다시 로드 (기본값) */
  resetOnDeps?: boolean;
};

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
      const page = await getContentsPaginated({
        boardKey: opts.boardKey,
        group: opts.group,
        tags: opts.tags,
        searchTerms: opts.searchTerms,
        limit: pageSize,
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
  }, [depKey, pageSize]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    if (!lastDocRef.current) return;
    const myTick = tickRef.current;
    setLoadingMore(true);
    try {
      const page = await getContentsPaginated({
        boardKey: opts.boardKey,
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
