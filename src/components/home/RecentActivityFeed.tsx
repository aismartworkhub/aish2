"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle, Heart, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Content } from "@/types/content";
import { contentDisplayTitle, contentDisplayBody } from "@/lib/content-display";
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
          // 카드 피드 — 기존 1줄 미니 카드 디자인 유지 (마케팅 친화)
          <ul className="divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border bg-white">
            {items.map((c) => {
              const tab = c.boardKey === "community-qna" ? "qna" : "free";
              const boardLabel = c.boardKey === "community-qna" ? "Q&A" : "자유";
              return (
                <li key={c.id}>
                  <Link
                    href={`/community?tab=${tab}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50",
                    )}
                  >
                    <span className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                      c.boardKey === "community-qna"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-100 text-blue-700",
                    )}>
                      {boardLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-gray-900">
                        {contentDisplayTitle(c)}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                        <span className="truncate">{c.authorName}</span>
                        {contentDisplayBody(c) && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="truncate hidden sm:inline">{contentDisplayBody(c).slice(0, 60)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 hidden sm:flex items-center gap-2 text-xs text-gray-400">
                      {c.commentCount > 0 && (
                        <span className="flex items-center gap-0.5"><MessageCircle size={11} />{c.commentCount}</span>
                      )}
                      {c.likeCount > 0 && (
                        <span className="flex items-center gap-0.5"><Heart size={11} />{c.likeCount}</span>
                      )}
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-gray-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
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
