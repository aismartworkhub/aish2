"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  /** 로드 실패·src 없음 → 노출. null이면 호출자에서 컨테이너 숨김 처리. */
  fallback?: React.ReactNode;
  priority?: boolean;
};

/**
 * 카드 썸네일 — onError 시 fallback 노드 swap.
 * src 가 바뀌면 failed 플래그 리셋 (피드 재로드 후 새 URL 시도).
 */
export default function SmartThumbnail({ src, alt = "", className, fallback, priority }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);

  if (!src || failed) {
    return fallback ? <>{fallback}</> : null;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={cn("h-full w-full object-cover", className)}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
