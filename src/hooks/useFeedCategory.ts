"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeedCategoryKey } from "@/types/feed";

const STORAGE_PREFIX = "aish_feedCategory_";

const ALL_KEYS: ReadonlyArray<FeedCategoryKey> = [
  "all", "content", "media", "community", "program", "instructor", "event",
];

function isCategoryKey(v: unknown): v is FeedCategoryKey {
  return typeof v === "string" && (ALL_KEYS as readonly string[]).includes(v);
}

function readCategory(scope: string, fallback: FeedCategoryKey): FeedCategoryKey {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(STORAGE_PREFIX + scope);
    return isCategoryKey(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function writeCategory(scope: string, value: FeedCategoryKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + scope, value);
  } catch {
    /* quota·private 모드 무시 */
  }
}

/**
 * 페이지별 통합 피드 카테고리 필터 (localStorage 영구 저장).
 * scopeKey 예시: "home-feed", "feed-page".
 */
export function useFeedCategory(scopeKey: string, defaultCategory: FeedCategoryKey = "all") {
  const [category, setCategoryState] = useState<FeedCategoryKey>(defaultCategory);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCategoryState(readCategory(scopeKey, defaultCategory));
    setHydrated(true);
  }, [scopeKey, defaultCategory]);

  const setCategory = useCallback(
    (next: FeedCategoryKey) => {
      setCategoryState(next);
      writeCategory(scopeKey, next);
    },
    [scopeKey],
  );

  return { category, setCategory, hydrated };
}
