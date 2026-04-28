"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Content } from "@/types/content";
import { ContentCard } from "@/components/content";
import ContentDetailModal from "@/components/content/ContentDetailModal";
import { useViewMode } from "@/hooks/useViewMode";
import ViewModeToggle from "@/components/ui/ViewModeToggle";

/**
 * 홈 매거진의 최근 커뮤니티 활동 피드.
 * 자유게시판·Q&A 최근 5건 시간순.
 * 토글로 X피드(timeline) / 카드피드(grid) 전환 — 홈은 board-list 미사용.
 */
export default function RecentActivityFeed({ items }: { items: Content[] }) {
  const { mode: viewMode, setMode: setViewMode } = useViewMode("home-recent", "x-feed");
  const [selected, setSelected] = useState<Content | null>(null);

  if (items.length === 0) return null;

  return (
    <section className="py-16 md:py-20 bg-white border-t border-brand-border">
      <div className="container-custom">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl md:text-[32px] font-bold text-brand-blue tracking-tight">최근 커뮤니티 활동</h2>
            <p className="mt-1 text-sm text-gray-500">자유게시판·Q&amp;A의 새로운 글</p>
          </div>
          <div className="flex items-center gap-3">
            <ViewModeToggle
              mode={viewMode}
              onChange={setViewMode}
              hidden={["board-list"]}
              compact
            />
            <Link href="/community?tab=free" className="hidden items-center gap-1 text-sm text-gray-500 hover:text-brand-blue md:inline-flex">
              전체 보기 <ChevronRight size={16} />
            </Link>
          </div>
        </div>

        {viewMode === "x-feed" && (
          // X피드 — ContentCard timeline 단일 컬럼
          <div className="mx-auto max-w-2xl border border-brand-border bg-white rounded-xl overflow-hidden">
            {items.map((c) => (
              <ContentCard
                key={c.id}
                content={c}
                variant="timeline"
                onClick={(content) => setSelected(content)}
              />
            ))}
          </div>
        )}

        {viewMode === "card-feed" && (
          // 카드 피드 — 디스패치 뉴스 스타일 (가로 미니 썸네일 + 제목 + 요약)
          <div className="mx-auto max-w-3xl border border-brand-border bg-white rounded-xl overflow-hidden">
            {items.map((c) => (
              <ContentCard
                key={c.id}
                content={c}
                variant="dispatch"
                onClick={(content) => setSelected(content)}
              />
            ))}
          </div>
        )}

        <div className="mt-6 text-center md:hidden">
          <Link href="/community?tab=free" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-blue">
            전체 보기 <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      <ContentDetailModal
        content={selected}
        onClose={() => setSelected(null)}
        onSelectRelated={setSelected}
        galleryItems={items}
        onNavigate={setSelected}
      />
    </section>
  );
}
