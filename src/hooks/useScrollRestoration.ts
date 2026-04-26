"use client";

import { useEffect, useRef } from "react";

const KEY_PREFIX = "aish_scroll_";
const TTL_MS = 30 * 60_000; // 30분 후 만료 — 오래된 위치는 무의미

type StoredEntry = { y: number; ts: number };

function read(key: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEntry;
    if (Date.now() - parsed.ts > TTL_MS) return null;
    return typeof parsed.y === "number" ? parsed.y : null;
  } catch {
    return null;
  }
}

function write(key: string, y: number): void {
  if (typeof window === "undefined") return;
  try {
    const entry: StoredEntry = { y, ts: Date.now() };
    window.sessionStorage.setItem(KEY_PREFIX + key, JSON.stringify(entry));
  } catch { /* quota·private 모드 무시 */ }
}

/**
 * 스크롤 위치 복원.
 *
 * - 페이지/탭 단위 key별 sessionStorage에 scrollY 저장
 * - 마운트 시 복원 (콘텐츠 로드 후 적용되도록 첫 paint 후)
 * - 언마운트·route 변경 시 저장
 * - 30분 TTL — 오래된 위치는 무시
 *
 * 콘텐츠 로딩이 비동기인 페이지에서는 ready 옵션으로 데이터 준비 완료 후 복원하도록 제어.
 *
 * 사용 예:
 *   useScrollRestoration({ key: 'media', ready: !feed.loading });
 *   useScrollRestoration({ key: `community-${activeTab}`, ready: !loading });
 */
export function useScrollRestoration({
  key,
  ready = true,
  enabled = true,
}: {
  key: string;
  ready?: boolean;
  enabled?: boolean;
}): void {
  const restored = useRef(false);
  const lastKey = useRef(key);

  // key 변경 시(예: 탭 전환) 이전 위치 저장 + 복원 플래그 리셋
  useEffect(() => {
    if (!enabled) return;
    if (lastKey.current !== key) {
      // 이전 키의 위치 저장
      if (typeof window !== "undefined") write(lastKey.current, window.scrollY);
      lastKey.current = key;
      restored.current = false;
    }
  }, [key, enabled]);

  // 복원 — ready=true 첫 시점에 1회 실행
  useEffect(() => {
    if (!enabled || restored.current || !ready) return;
    if (typeof window === "undefined") return;
    const y = read(key);
    if (y !== null) {
      // 다음 frame에 적용 — 콘텐츠 레이아웃 후 안전하게
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
    restored.current = true;
  }, [key, ready, enabled]);

  // 스크롤 시 throttle 저장 (rAF) + 언마운트 시 마지막 저장
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    let ticking = false;
    const save = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        write(key, window.scrollY);
        ticking = false;
      });
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      window.removeEventListener("scroll", save);
      // 언마운트 시 최종 저장
      if (typeof window !== "undefined") write(key, window.scrollY);
    };
  }, [key, enabled]);
}
