"use client";

import { cn } from "@/lib/utils";
import { FEED_CATEGORIES, type FeedCategoryKey } from "@/types/feed";

interface FeedCategoryChipsProps {
  active: FeedCategoryKey;
  onChange: (next: FeedCategoryKey) => void;
  className?: string;
}

/**
 * 통합 피드 카테고리 칩 — 모바일 가로 스크롤.
 * "전체" + 6 종류 (콘텐츠/커뮤니티/프로그램/강사/이벤트).
 */
export default function FeedCategoryChips({ active, onChange, className }: FeedCategoryChipsProps) {
  return (
    <div className={cn("-mx-4 overflow-x-auto px-4", className)}>
      <div className="flex gap-1.5 pb-2">
        {FEED_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => onChange(cat.key)}
            aria-pressed={active === cat.key}
            className={cn(
              "shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
              active === cat.key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200",
            )}
          >
            <span aria-hidden>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
