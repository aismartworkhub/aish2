"use client";

import { useEffect, useRef, useState } from "react";

export type ScrollDirection = "up" | "down";

export type UseScrollDirectionOptions = {
  /** 미세 흔들림 무시 임계값 (px). 기본 8 */
  threshold?: number;
  /** 페이지 최상단(scrollY < topZone) 인근에서는 항상 "up"으로 간주. 기본 16 */
  topZone?: number;
};

/**
 * 모바일 네비게이션 자동 숨김용 스크롤 방향·위치 추적 훅.
 *
 * - requestAnimationFrame 스로틀로 스크롤 이벤트 폭주 방지
 * - 임계값 미만의 미세 흔들림은 무시 (방향 유지)
 * - 페이지 최상단 인근에서는 자동으로 "up" — 헤더가 사라진 채 상단 도착하는 어색함 방지
 * - SSR 안전 (typeof window 체크)
 */
export function useScrollDirection({
  threshold = 8,
  topZone = 16,
}: UseScrollDirectionOptions = {}): {
  direction: ScrollDirection;
  scrollY: number;
} {
  const [direction, setDirection] = useState<ScrollDirection>("up");
  const [scrollY, setScrollY] = useState(0);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    lastScrollY.current = window.scrollY;
    setScrollY(window.scrollY);

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const current = window.scrollY;
        const delta = current - lastScrollY.current;

        // 최상단 인근은 "up" 강제
        if (current < topZone) {
          setDirection("up");
        } else if (Math.abs(delta) >= threshold) {
          setDirection(delta > 0 ? "down" : "up");
          lastScrollY.current = current;
        }

        setScrollY(current);
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, topZone]);

  return { direction, scrollY };
}
