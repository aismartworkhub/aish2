"use client";

import { useEffect, useState, useCallback } from "react";

export type UiMode = "new" | "legacy";

const STORAGE_KEY = "aish_uiMode";
const DEFAULT_MODE: UiMode = "new";

function readMode(): UiMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "legacy" ? "legacy" : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function writeMode(mode: UiMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch { /* quota·private 모드 무시 */ }
}

/**
 * 큰 UX 전환의 안전망. localStorage 기반.
 * 기본값은 "new" (Sprint B·D 등에서 도입한 신규 UX).
 * 사용자가 토글하면 영향 컴포넌트가 분기 렌더로 기존 UX 노출.
 *
 * 사용 예:
 *   const { mode, setMode } = useUiMode();
 *   return mode === "new" ? <InstagramGrid/> : <LegacyGrid/>;
 */
export function useUiMode(): {
  mode: UiMode;
  setMode: (next: UiMode) => void;
  toggle: () => void;
  /** 마운트 전에는 기본값을 반환하지만 hydration 후 실제 값으로 갱신됨 */
  hydrated: boolean;
} {
  const [mode, setModeState] = useState<UiMode>(DEFAULT_MODE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setModeState(readMode());
    setHydrated(true);
  }, []);

  const setMode = useCallback((next: UiMode) => {
    setModeState(next);
    writeMode(next);
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: UiMode = prev === "new" ? "legacy" : "new";
      writeMode(next);
      return next;
    });
  }, []);

  return { mode, setMode, toggle, hydrated };
}
