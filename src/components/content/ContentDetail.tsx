"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, Star, ExternalLink, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { incrementContentViews } from "@/lib/content-engine";
import type { Content, BoardConfig } from "@/types/content";
import MediaPreview from "./MediaPreview";
import ReactionButtons from "./ReactionButtons";
import CommentSection from "./CommentSection";

type Props = {
  content: Content;
  board?: BoardConfig;
  onBack: () => void;
};

function formatDate(dateVal: unknown): string {
  if (!dateVal) return "";
  const d =
    typeof dateVal === "string"
      ? new Date(dateVal)
      : (dateVal as { toDate?: () => Date }).toDate?.() ?? new Date();
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default function ContentDetail({ content, board, onBack }: Props) {
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    incrementContentViews(content.id).catch(() => {});
  }, [content.id]);

  const showComments = board?.allowComments !== false;
  const hasMedia = content.mediaUrl && content.mediaType !== "none";

  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={onBack}
        className={cn(
          "mb-4 flex items-center gap-1.5 text-sm text-gray-500",
          "hover:text-gray-700 transition-colors",
        )}
      >
        <ArrowLeft size={16} />
        목록으로
      </button>

      <article className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{content.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{content.authorName}</span>
            <span suppressHydrationWarning>{formatDate(content.createdAt)}</span>
            <span>조회 {content.views}</span>
          </div>
          {content.rating != null && content.rating > 0 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  size={16}
                  className={cn(
                    i < content.rating! ? "fill-yellow-400 text-yellow-400" : "text-gray-300",
                  )}
                />
              ))}
              {content.programTitle && (
                <span className="ml-2 text-xs text-gray-500">{content.programTitle}</span>
              )}
            </div>
          )}
          {content.tags && content.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {content.tags.map((t) => (
                <span key={t} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </header>

        {hasMedia && (
          <MediaPreview
            mediaUrl={content.mediaUrl}
            mediaType={content.mediaType}
            thumbnailUrl={content.thumbnailUrl}
            title={content.title}
            embed
            className="rounded-lg"
          />
        )}

        {content.mediaUrl && (
          <div className="flex gap-2">
            {content.mediaType === "youtube" ? (
              <a
                href={content.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium",
                  "bg-red-600 text-white hover:bg-red-700 transition-colors",
                )}
              >
                <Youtube size={16} />
                YouTube에서 보기
                <ExternalLink size={14} />
              </a>
            ) : (
              <a
                href={content.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium",
                  "bg-gray-800 text-white hover:bg-gray-900 transition-colors",
                )}
              >
                <ExternalLink size={16} />
                원본 보기
              </a>
            )}
          </div>
        )}

        {content.body && (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
            {content.body}
          </div>
        )}

        <div className="border-t border-gray-100 pt-4">
          <ReactionButtons
            contentId={content.id}
            initialLikes={content.likeCount}
            board={board}
          />
        </div>

        {showComments && (
          <div className="border-t border-gray-100 pt-4">
            <CommentSection contentId={content.id} />
          </div>
        )}
      </article>
    </div>
  );
}
