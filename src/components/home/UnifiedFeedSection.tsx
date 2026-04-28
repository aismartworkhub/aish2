"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Content } from "@/types/content";
import { useUniversalFeed } from "@/hooks/useUniversalFeed";
import { useFeedCategory } from "@/hooks/useFeedCategory";
import { useViewMode } from "@/hooks/useViewMode";
import ViewModeToggle from "@/components/ui/ViewModeToggle";
import FeedCategoryChips from "@/components/feed/FeedCategoryChips";
import UniversalCard from "@/components/feed/UniversalCard";
import ContentCardSkeleton from "@/components/content/ContentCardSkeleton";
import type { FeatureFlags } from "@/lib/site-settings-public";
import type { ContentCardVariant } from "@/components/content";

const ContentDetailModal = dynamic(() => import("@/components/content/ContentDetailModal"), {
  ssr: false,
});

interface UnifiedFeedSectionProps {
  /** phase6 flag — `useFeatureFlags()`에서 가져온 phase6 객체 */
  phase6: FeatureFlags["phase6"];
}

/**
 * 홈에 노출되는 통합 피드 — 6 소스 활동순 + 카테고리 필터 + 뷰 모드 토글.
 * Feature Flag(phase6.enabled) ON 일 때만 렌더 (호출하는 부모가 분기).
 */
export default function UnifiedFeedSection({ phase6 }: UnifiedFeedSectionProps) {
  const { mode: viewMode, setMode: setViewMode } = useViewMode("home-feed", "x-feed");
  const { category, setCategory } = useFeedCategory("home-feed", "all");
  const [selected, setSelected] = useState<Content | null>(null);

  const feed = useUniversalFeed({
    category,
    pageSize: 20,
    interleaveProgram: phase6.interleaveProgram,
    interleaveInstructor: phase6.interleaveInstructor,
    interleaveEvent: phase6.interleaveEvent,
    activitySort: phase6.enableActivitySort !== false,
  });

  const cardVariant: ContentCardVariant =
    viewMode === "x-feed" ? "timeline" :
    viewMode === "board-list" ? "list" : "dispatch";

  return (
    <section className="py-12 md:py-16 bg-white border-t border-brand-border">
      <div className="container-custom max-w-3xl">
        {/* 헤더 + 토글 */}
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl md:text-[28px] font-bold text-brand-blue tracking-tight">
              📰 AISH 전체 피드
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              콘텐츠·프로그램·강사·이벤트·자료를 한 줄로 흐르게.
              {phase6.enableActivitySort !== false && " 댓글 달리면 상단 이동."}
            </p>
          </div>
          <ViewModeToggle mode={viewMode} onChange={setViewMode} compact />
        </div>

        {/* 카테고리 칩 */}
        <FeedCategoryChips active={category} onChange={setCategory} className="mb-3" />

        {/* 피드 본문 */}
        {feed.loading ? (
          <div className="border border-brand-border bg-white rounded-xl overflow-hidden">
            <ContentCardSkeleton variant={cardVariant} count={6} />
          </div>
        ) : feed.error ? (
          <div className="py-16 text-center text-sm text-red-500">{feed.error}</div>
        ) : feed.items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            표시할 항목이 없습니다.
          </div>
        ) : (
          <div className="border border-brand-border bg-white rounded-xl overflow-hidden">
            {feed.items.map((item, i) => (
              <UniversalCard
                key={`${item.kind}-${item.id}`}
                item={item}
                variant={cardVariant}
                onClickContent={(c) => setSelected(c)}
                priority={i < 3}
              />
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/community?tab=free" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-blue">
            커뮤니티 전체 보기 <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      <ContentDetailModal
        content={selected}
        onClose={() => setSelected(null)}
        onSelectRelated={setSelected}
      />
    </section>
  );
}
