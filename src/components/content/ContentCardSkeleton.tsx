"use client";

import { cn } from "@/lib/utils";
import type { ContentCardVariant } from "./ContentCard";

interface ContentCardSkeletonProps {
  variant?: ContentCardVariant;
  count?: number;
}

/**
 * 콘텐츠 카드 로딩 스켈레톤 — Firestore 쿼리 진행 중 즉시 표시.
 * variant별로 실제 카드와 같은 위치·크기로 그려 layout shift 회피.
 */
export default function ContentCardSkeleton({
  variant = "dispatch",
  count = 6,
}: ContentCardSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div aria-busy="true" aria-live="polite">
      {items.map((i) => (
        <SkeletonItem key={i} variant={variant} />
      ))}
    </div>
  );
}

function SkeletonItem({ variant }: { variant: ContentCardVariant }) {
  if (variant === "instagram") {
    return (
      <div className="aspect-square w-full overflow-hidden bg-gray-100 animate-pulse" />
    );
  }
  if (variant === "list") {
    return (
      <div className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 animate-pulse">
        <div className="h-4 flex-1 rounded bg-gray-200" />
        <div className="h-3 w-12 rounded bg-gray-100" />
        <div className="h-3 w-16 rounded bg-gray-100" />
      </div>
    );
  }
  if (variant === "timeline") {
    return (
      <div className="border-b border-gray-100 bg-white px-4 py-4 animate-pulse">
        <div className="flex gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-gray-200" />
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="aspect-video w-full rounded-lg bg-gray-100" />
            <div className="flex gap-6">
              <div className="h-3 w-8 rounded bg-gray-100" />
              <div className="h-3 w-8 rounded bg-gray-100" />
              <div className="h-3 w-8 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  // dispatch (가로) — 기본
  return (
    <div className={cn("flex w-full gap-3 border-b border-gray-100 bg-white p-3 animate-pulse")}>
      <div className="shrink-0 w-24 sm:w-36 aspect-video rounded-md bg-gray-200" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-4 w-5/6 rounded bg-gray-200" />
        <div className="h-3 w-3/4 rounded bg-gray-100" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
        <div className="mt-auto pt-2 flex gap-3">
          <div className="h-3 w-16 rounded bg-gray-100" />
          <div className="h-3 w-12 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
