"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 3-스타일 뷰 모드 훅 — 페이지별 독립 localStorage 저장.
 *
 * - x-feed: X.com 스타일 (timeline variant)
 * - card-feed: 카드 그리드 (instagram/grid variant)
 * - board-list: 게시판 리스트 (list variant)
 *
 * scopeKey로 페이지별 모드 분리 (예: "media", "community", "home-recent").
 * SSR-safe: hydration 전에는 default를 반환하고, hydrated=false 표시.
 */

export type ViewMode = "x-feed" | "card-feed" | "board-list";

const STORAGE_PREFIX = "aish_viewMode_";

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope}`;
}

function isViewMode(v: unknown): v is ViewMode {
  return v === "x-feed" || v === "card-feed" || v === "board-list";
}

function readMode(scope: string, fallback: ViewMode): ViewMode {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(storageKey(scope));
    return isViewMode(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function writeMode(scope: string, mode: ViewMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(scope), mode);
  } catch {
    /* quota·private 모드 무시 */
  }
}

export function useViewMode(
  scopeKey: string,
  defaultMode: ViewMode,
): {
  mode: ViewMode;
  setMode: (next: ViewMode) => void;
  /** hydration 전에는 false. 마운트 후 true로 전환되어 실제 저장값 반영. */
  hydrated: boolean;
} {
  const [mode, setModeState] = useState<ViewMode>(defaultMode);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setModeState(readMode(scopeKey, defaultMode));
    setHydrated(true);
  }, [scopeKey, defaultMode]);

  const setMode = useCallback(
    (next: ViewMode) => {
      setModeState(next);
      writeMode(scopeKey, next);
    },
    [scopeKey],
  );

  return { mode, setMode, hydrated };
}
