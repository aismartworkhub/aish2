"use client";

import { Heart, MessageCircle, Eye, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Content, BoardConfig } from "@/types/content";
import MediaPreview from "./MediaPreview";

type Props = {
  content: Content;
  board?: BoardConfig;
  onClick?: (content: Content) => void;
};

function timeAgo(dateVal: unknown): string {
  if (!dateVal) return "";
  const d =
    typeof dateVal === "string"
      ? new Date(dateVal)
      : (dateVal as { toDate?: () => Date }).toDate?.() ?? new Date();
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}일 전`;
  return d.toLocaleDateString("ko-KR");
}

/** 그리드(콘텐츠) 레이아웃 카드 */
function GridCard({ content, onClick }: Omit<Props, "board">) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(content)}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white",
        "text-left transition-shadow hover:shadow-md",
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        <MediaPreview
          mediaUrl={content.mediaUrl}
          mediaType={content.mediaType}
          thumbnailUrl={content.thumbnailUrl}
          title={content.title}
          className="h-full w-full transition-transform duration-200 group-hover:scale-105"
        />
        {content.isShort && (
          <span className={cn(
            "absolute bottom-2 right-2 rounded bg-red-600 px-1.5 py-0.5",
            "text-[10px] font-bold text-white",
          )}>
            SHORT
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
          {content.isPinned && <Pin size={12} className="mr-1 inline text-primary-500" />}
          {content.title}
        </h3>
        <p className="text-xs text-gray-500">{content.authorName}</p>
        <div className="mt-auto flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-0.5">
            <Eye size={12} /> {content.views}
          </span>
          <span className="flex items-center gap-0.5">
            <Heart size={12} /> {content.likeCount}
          </span>
          <span className="flex items-center gap-0.5">
            <MessageCircle size={12} /> {content.commentCount}
          </span>
          <span className="ml-auto" suppressHydrationWarning>{timeAgo(content.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}

/** 리스트(커뮤니티) 레이아웃 행 */
function ListRow({ content, onClick }: Omit<Props, "board">) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(content)}
      className={cn(
        "flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3",
        "text-left transition-colors hover:bg-gray-50",
        content.isPinned && "bg-primary-50/40",
      )}
    >
      {content.isPinned && <Pin size={14} className="shrink-0 text-primary-500" />}
      <span className="flex-1 truncate text-sm font-medium text-gray-800">
        {content.title}
      </span>
      {content.commentCount > 0 && (
        <span className="text-xs text-primary-500">[{content.commentCount}]</span>
      )}
      <span className="shrink-0 text-xs text-gray-400">{content.authorName}</span>
      <span className="shrink-0 text-xs text-gray-400" suppressHydrationWarning>{timeAgo(content.createdAt)}</span>
      <span className="flex shrink-0 items-center gap-0.5 text-xs text-gray-400">
        <Eye size={12} /> {content.views}
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-xs text-gray-400">
        <Heart size={12} /> {content.likeCount}
      </span>
    </button>
  );
}

/** FAQ 아코디언 행 — 별도 상세 페이지 없이 인라인 토글 */
function FaqRow({ content }: Omit<Props, "board" | "onClick">) {
  return (
    <details className="group border-b border-gray-100">
      <summary className={cn(
        "flex cursor-pointer items-center gap-2 px-4 py-3",
        "text-sm font-medium text-gray-800 hover:bg-gray-50",
      )}>
        <span className="font-bold text-primary-500">Q.</span>
        <span className="flex-1">{content.question ?? content.title}</span>
      </summary>
      <div className="px-4 pb-4 pl-9 text-sm leading-relaxed text-gray-600">
        {content.answer ?? content.body}
      </div>
    </details>
  );
}

export default function ContentCard({ content, board, onClick }: Props) {
  const layout = board?.layout ?? "grid";

  if (layout === "faq") return <FaqRow content={content} />;
  if (layout === "list") return <ListRow content={content} onClick={onClick} />;
  return <GridCard content={content} onClick={onClick} />;
}
