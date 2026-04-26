"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type UsePullToRefreshOptions = {
  /** 새로고침을 트리거할 임계값 (px). 기본 60 */
  threshold?: number;
  /** 비활성화 (이전 모드 등) */
  disabled?: boolean;
  /** 트리거 시 호출. async OK — 완료까지 spinner 유지. */
  onRefresh: () => void | Promise<void>;
};

export type UsePullToRefreshResult = {
  /** 현재 당겨진 거리 (0 ~ threshold*1.5). UI 인디케이터 위치 계산용 */
  pullDistance: number;
  /** onRefresh 진행 중 여부 */
  refreshing: boolean;
  /** 컨테이너에 부착할 ref. window 전역으로 처리하므로 필수는 아니지만 옵션. */
  containerRef: (el: HTMLElement | null) => void;
};

/**
 * 모바일 풀투리프레시.
 *
 * - touchstart/touchmove/touchend 기반
 * - window.scrollY === 0 일 때만 활성 (이미 스크롤 위치에서는 비활성)
 * - 임계값 초과 후 손 떼면 onRefresh 호출
 * - 정적 빌드 호환 (서버 호출 없음)
 *
 * 사용 예:
 *   const { pullDistance, refreshing } = usePullToRefresh({
 *     onRefresh: () => feed.refresh(),
 *   });
 *   return <>
 *     {pullDistance > 0 && <Spinner top={pullDistance} />}
 *     {/* 콘텐츠 ... *\/}
 *   </>;
 */
export function usePullToRefresh({
  threshold = 60,
  disabled = false,
  onRefresh,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const elRef = useRef<HTMLElement | null>(null);

  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  const containerRef = useCallback((el: HTMLElement | null) => {
    elRef.current = el;
  }, []);

  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;

    const onTouchStart = (e: TouchEvent) => {
      // 페이지 최상단에서만 시작
      if (window.scrollY > 0) return;
      if (refreshing) return;
      const t = e.touches[0];
      if (t) startY.current = t.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      if (refreshing) return;
      const t = e.touches[0];
      if (!t) return;
      const delta = t.clientY - startY.current;
      // 다운 방향이고 페이지 최상단일 때만 유효
      if (delta <= 0 || window.scrollY > 0) {
        if (pullDistance !== 0) setPullDistance(0);
        return;
      }
      // 저항감(0.5x) — 너무 쉽게 당겨지지 않게
      const resisted = Math.min(delta * 0.5, threshold * 1.5);
      setPullDistance(resisted);
    };

    const onTouchEnd = async () => {
      const triggered = pullDistance >= threshold;
      startY.current = null;
      setPullDistance(0);
      if (triggered && !refreshing) {
        setRefreshing(true);
        try {
          await onRefreshRef.current();
        } catch { /* 무시 */ }
        setRefreshing(false);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, threshold, pullDistance, refreshing]);

  return { pullDistance, refreshing, containerRef };
}
