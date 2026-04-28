"use client";

import { useState } from "react";
import { Heart, MessageCircle, Eye, Pin, Bookmark, Share2, Play, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { contentDisplayTitle } from "@/lib/content-display";
import type { Content, BoardConfig } from "@/types/content";
import MediaPreview from "./MediaPreview";
import { toggleReaction } from "@/lib/content-engine";
import { useAuth } from "@/contexts/AuthContext";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import LoginModal from "@/components/public/LoginModal";
import { useToast } from "@/components/ui/Toast";

/** 영상 길이(초) → 표시용 라벨 ("12:34", "1:23:45", "" if invalid) */
function formatDurationBadge(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** 원본 시간(YouTube publishedAtSource) → "X시간 전" 형식 */
function sourceTimeAgo(iso: string | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}일 전`;
    return d.toLocaleDateString("ko-KR");
  } catch {
    return "";
  }
}

export type ContentCardVariant = "grid" | "list" | "faq" | "instagram" | "timeline" | "dispatch";

type Props = {
  content: Content;
  board?: BoardConfig;
  onClick?: (content: Content) => void;
  /** 시각 변형 — 기본은 board.layout. 명시 시 오버라이드 (예: /media에서 "instagram"). */
  variant?: ContentCardVariant;
  /** Above-the-fold 가속 — 첫 N개 카드 이미지를 eager + fetchpriority high로 */
  priority?: boolean;
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
function GridCard({ content, onClick, priority }: Omit<Props, "board">) {
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
          title={contentDisplayTitle(content)}
          className="h-full w-full transition-transform duration-200 group-hover:scale-105"
          priority={priority}
        />
        {content.isShort && (
          <span className={cn(
            "absolute bottom-2 right-2 rounded bg-red-600 px-1.5 py-0.5",
            "text-[10px] font-bold text-white",
          )}>
            SHORT
          </span>
        )}
        {(() => {
          // 7일 이내 → NEW, downloadCount ≥ 10 → 카운트, 그 사이 → 숨김
          const ms = (() => {
            const c = content.createdAt;
            if (!c) return 0;
            if (typeof c === "string") return new Date(c).getTime();
            const ts = c as { toDate?: () => Date; seconds?: number };
            if (typeof ts.toDate === "function") return ts.toDate().getTime();
            if (typeof ts.seconds === "number") return ts.seconds * 1000;
            return 0;
          })();
          const isNew = ms > 0 && Date.now() - ms < 7 * 24 * 60 * 60 * 1000;
          const dl = content.downloadCount ?? 0;
          if (isNew) {
            return (
              <span className="absolute top-2 left-2 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                NEW
              </span>
            );
          }
          if (dl >= 10) {
            return (
              <span className="absolute top-2 left-2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                ↓ {dl.toLocaleString()}
              </span>
            );
          }
          return null;
        })()}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
          {content.isPinned && <Pin size={12} className="mr-1 inline text-primary-500" />}
          {contentDisplayTitle(content)}
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
        {contentDisplayTitle(content)}
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

/**
 * 등록 일시(string|Timestamp) → epoch ms. NEW 배지·다운로드 카운트 분기용.
 */
function createdAtMs(createdAt: unknown): number {
  if (!createdAt) return 0;
  if (typeof createdAt === "string") return new Date(createdAt).getTime();
  const ts = createdAt as { toDate?: () => Date; seconds?: number };
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

/** 좌상단 NEW/다운로드 배지 — 7일 이내 NEW, ≥10회 카운트, 그 사이 숨김 */
function CornerBadge({ content }: { content: Content }) {
  const ms = createdAtMs(content.createdAt);
  const isNew = ms > 0 && Date.now() - ms < 7 * 24 * 60 * 60 * 1000;
  const dl = content.downloadCount ?? 0;
  if (isNew) {
    return (
      <span className="absolute top-2 left-2 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
        NEW
      </span>
    );
  }
  if (dl >= 10) {
    return (
      <span className="absolute top-2 left-2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
        ↓ {dl.toLocaleString()}
      </span>
    );
  }
  return null;
}

/**
 * Instagram Explore 스타일 카드.
 * - 보더·패딩 없음, rounded-md만
 * - 미디어 자연 비율 (aspect-video 강제 X)
 * - hover/포커스 시 어두운 그라데이션 + 제목·뷰·좋아요 오버레이
 * - 좌상단 NEW/다운로드 배지
 */
function InstagramCard({ content, onClick, priority }: Omit<Props, "board" | "variant">) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(content)}
      className={cn(
        "group relative block w-full overflow-hidden rounded-md bg-gray-100 text-left",
        "transition-shadow hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
      )}
    >
      <div className="relative w-full">
        <MediaPreview
          mediaUrl={content.mediaUrl}
          mediaType={content.mediaType}
          thumbnailUrl={content.thumbnailUrl}
          title={contentDisplayTitle(content)}
          className="block w-full transition-transform duration-300 group-hover:scale-[1.03]"
          priority={priority}
        />
        {content.isShort && (
          <span className="absolute bottom-2 right-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            SHORT
          </span>
        )}
        <CornerBadge content={content} />

        {/* hover/탭 오버레이 — 제목 + 메타 */}
        <div className={cn(
          "pointer-events-none absolute inset-0 flex flex-col justify-end",
          "bg-gradient-to-t from-black/75 via-black/30 to-transparent",
          "opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100",
          "max-md:opacity-100", // 모바일은 항상 노출 (hover 불가)
        )}>
          <div className="p-3 text-white">
            <h3 className="line-clamp-1 text-sm font-semibold">
              {content.isPinned && <Pin size={12} className="mr-1 inline" />}
              {contentDisplayTitle(content)}
            </h3>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-white/85">
              <span className="flex items-center gap-0.5"><Eye size={11} /> {content.views}</span>
              <span className="flex items-center gap-0.5"><Heart size={11} /> {content.likeCount}</span>
              {content.commentCount > 0 && (
                <span className="flex items-center gap-0.5"><MessageCircle size={11} /> {content.commentCount}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

/**
 * X(트위터) 스타일 타임라인 카드.
 * - 작성자 아바타 + 이름 + 시간 (상단 1줄)
 * - 본문 (line-clamp 6줄, "더 보기" 펼침)
 * - 미디어 임베드 인라인 (썸네일/이미지/PDF/링크)
 * - 하단 액션 바: 💬 댓글 / ❤ 좋아요 / 🔖 북마크 / 🔗 공유
 *   (이번 단계는 카운트만 표시·클릭은 카드 onClick으로 모달 진입.
 *   Sprint D Batch 2에서 인라인 토글로 교체.)
 */
function TimelineCard({ content, onClick, priority }: Omit<Props, "board" | "variant">) {
  const ms = createdAtMs(content.createdAt);
  const { user } = useAuth();
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const { toast } = useToast();
  // 낙관적 토글 — 첫 마운트 시점의 reactions은 모르므로, 사용자 클릭한 횟수만 추적.
  // Firestore와 정확히 동기화되지 않더라도 즉각 피드백 + 카운트는 서버 truth로 갱신.
  const [likedDelta, setLikedDelta] = useState(0); // -1, 0, 1
  const [bookmarked, setBookmarked] = useState(false);
  const [busyLike, setBusyLike] = useState(false);
  const [busyBookmark, setBusyBookmark] = useState(false);

  const displayLikeCount = Math.max(0, content.likeCount + likedDelta);
  const isLiked = likedDelta > 0;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      requireLogin(() => undefined, "좋아요는 로그인 후 가능합니다.");
      return;
    }
    if (busyLike) return;
    setBusyLike(true);
    try {
      const isNow = await toggleReaction(content.id, user.uid, "like");
      setLikedDelta(isNow ? 1 : -1);
    } catch {
      // 실패 시 원복
    } finally {
      setBusyLike(false);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      requireLogin(() => undefined, "북마크는 로그인 후 가능합니다.");
      return;
    }
    if (busyBookmark) return;
    setBusyBookmark(true);
    try {
      const isNow = await toggleReaction(content.id, user.uid, "bookmark");
      setBookmarked(isNow);
    } catch {
      // 실패 무시
    } finally {
      setBusyBookmark(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/media?id=${content.id}`
      : `/media?id=${content.id}`;
    const data = {
      title: contentDisplayTitle(content),
      text: content.body?.slice(0, 100) ?? "",
      url,
    };
    try {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav && "share" in nav && typeof nav.share === "function") {
        await nav.share(data);
      } else if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
        toast("링크가 복사되었습니다.", "success");
      }
    } catch {
      // 사용자 취소 등 무시
    }
  };

  // YouTube 콘텐츠는 채널 헤더로 표시 (X.com 스타일)
  const isYouTube = content.mediaType === "youtube" && !!content.channelTitle;
  const headerName = isYouTube ? content.channelTitle! : content.authorName;
  const headerHandle = isYouTube && content.channelId ? `@${content.channelId.slice(0, 14)}` : undefined;
  const headerTime = isYouTube && content.publishedAtSource
    ? sourceTimeAgo(content.publishedAtSource)
    : ms > 0
      ? timeAgo(content.createdAt)
      : "";
  const durationLabel = formatDurationBadge(content.durationSeconds);

  return (
    <article
      className={cn(
        "group border-b border-gray-100 bg-white px-4 py-4 transition-colors hover:bg-gray-50/50",
        content.isPinned && "bg-primary-50/40",
      )}
    >
      <div className="flex gap-3">
        {/* 아바타 — YouTube면 영상 썸네일에 ▶ 오버레이, 일반 글이면 작성자 사진 */}
        {isYouTube && content.thumbnailUrl ? (
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
            <img
              src={content.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play size={12} className="text-white fill-white" />
            </span>
          </div>
        ) : content.authorPhotoURL ? (
          <img
            src={content.authorPhotoURL}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-bold text-white">
            {headerName?.charAt(0) ?? "A"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {/* 작성자·핸들·시간 1줄 (X.com 스타일) */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold text-gray-900 truncate">{headerName}</span>
            {isYouTube && (
              <BadgeCheck size={14} className="shrink-0 text-red-500 fill-red-50" aria-label="YouTube 채널" />
            )}
            {content.isPinned && <Pin size={12} className="shrink-0 text-primary-500" />}
            {headerHandle && (
              <span className="hidden sm:inline text-gray-500 text-xs truncate">{headerHandle}</span>
            )}
            <span className="text-gray-400" aria-hidden>·</span>
            <span className="text-gray-500 text-xs" suppressHydrationWarning>
              {headerTime}
            </span>
          </div>

          {/* 제목 — X.com에선 본문이라 평문 톤 다운 */}
          {content.title && (
            <button
              type="button"
              onClick={() => onClick?.(content)}
              className="mt-1 block text-left text-sm font-semibold text-gray-900 hover:text-primary-600"
            >
              {contentDisplayTitle(content)}
            </button>
          )}

          {/* 본문 — line-clamp 6줄 */}
          {content.body && (
            <p className="mt-1.5 line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {content.body}
            </p>
          )}

          {/* 미디어 임베드 — 영상/이미지/PDF/링크. 상세는 모달에서. */}
          {content.mediaUrl && content.mediaType && content.mediaType !== "none" && (
            <button
              type="button"
              onClick={() => onClick?.(content)}
              className="mt-3 block w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-left"
              aria-label="미디어 열기"
            >
              <div className="relative aspect-video w-full">
                <MediaPreview
                  mediaUrl={content.mediaUrl}
                  mediaType={content.mediaType}
                  thumbnailUrl={content.thumbnailUrl}
                  title={contentDisplayTitle(content)}
                  className="h-full w-full"
                  priority={priority}
                />
                {isYouTube && durationLabel && (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {durationLabel}
                  </span>
                )}
              </div>
            </button>
          )}

          {/* 태그 */}
          {content.tags && content.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {content.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 하단 액션 바 — 인라인 좋아요·북마크·공유 (모달 진입 없이) */}
          <div className="mt-3 flex items-center gap-6 text-xs text-gray-500">
            <button
              type="button"
              onClick={() => onClick?.(content)}
              className="flex items-center gap-1 transition-colors hover:text-primary-600"
              aria-label="댓글"
            >
              <MessageCircle size={14} />
              <span>{content.commentCount}</span>
            </button>
            <button
              type="button"
              onClick={handleLike}
              disabled={busyLike}
              className={cn(
                "flex items-center gap-1 transition-colors hover:text-rose-500 disabled:opacity-50",
                isLiked && "text-rose-500",
              )}
              aria-label="좋아요"
              aria-pressed={isLiked}
            >
              <Heart size={14} className={isLiked ? "fill-current" : ""} />
              <span>{displayLikeCount}</span>
            </button>
            <button
              type="button"
              onClick={handleBookmark}
              disabled={busyBookmark}
              className={cn(
                "flex items-center gap-1 transition-colors hover:text-primary-600 disabled:opacity-50",
                bookmarked && "text-primary-600",
              )}
              aria-label="북마크"
              aria-pressed={bookmarked}
            >
              <Bookmark size={14} className={bookmarked ? "fill-current" : ""} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1 transition-colors hover:text-primary-600"
              aria-label="공유"
            >
              <Share2 size={14} />
            </button>
            <span className="ml-auto flex items-center gap-1">
              <Eye size={14} />
              <span>{content.views}</span>
            </span>
          </div>
        </div>
      </div>

      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </article>
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

export default function ContentCard({ content, board, onClick, variant, priority }: Props) {
  // variant 명시 시 보드 layout 무시 (예: /media에서 instagram 강제)
  const layout: ContentCardVariant = variant ?? board?.layout ?? "grid";

  if (layout === "instagram") return <InstagramCard content={content} onClick={onClick} priority={priority} />;
  if (layout === "timeline") return <TimelineCard content={content} onClick={onClick} priority={priority} />;
  if (layout === "dispatch") return <DispatchCard content={content} onClick={onClick} priority={priority} />;
  if (layout === "faq") return <FaqRow content={content} />;
  if (layout === "list") return <ListRow content={content} onClick={onClick} />;
  return <GridCard content={content} onClick={onClick} priority={priority} />;
}

/**
 * 디스패치 뉴스 스타일 카드 — 가로형 미니 썸네일 + 제목 + 요약 + 메타.
 * 빠른 정보 스캔에 최적화 (모바일·데스크톱 동일 레이아웃, 모바일에선 썸네일 작게).
 */
function DispatchCard({ content, onClick, priority }: Omit<Props, "board" | "variant">) {
  const ms = createdAtMs(content.createdAt);
  const isYouTube = content.mediaType === "youtube" && !!content.channelTitle;
  const headerName = isYouTube ? content.channelTitle! : content.authorName;
  const headerTime = isYouTube && content.publishedAtSource
    ? sourceTimeAgo(content.publishedAtSource)
    : ms > 0
      ? timeAgo(content.createdAt)
      : "";
  const durationLabel = formatDurationBadge(content.durationSeconds);
  const summary = content.body?.trim();

  return (
    <button
      type="button"
      onClick={() => onClick?.(content)}
      className={cn(
        "flex w-full gap-3 border-b border-gray-100 bg-white p-3 text-left transition-colors hover:bg-gray-50",
        content.isPinned && "bg-primary-50/40",
      )}
    >
      {/* 썸네일 — 모바일 96px, sm+ 144px */}
      <div className="relative shrink-0 w-24 sm:w-36 aspect-video overflow-hidden rounded-md bg-gray-100">
        {content.thumbnailUrl ? (
          <img
            src={content.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-300">
            no image
          </div>
        )}
        {isYouTube && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play size={20} className="text-white fill-white drop-shadow" />
          </span>
        )}
        {durationLabel && (
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] font-bold text-white">
            {durationLabel}
          </span>
        )}
        {ms > 0 && Date.now() - ms < 7 * 24 * 60 * 60 * 1000 && (
          <span className="absolute top-1 left-1 rounded bg-rose-500 px-1 py-0.5 text-[9px] font-bold text-white">
            NEW
          </span>
        )}
      </div>

      {/* 본문 — 제목 + 요약 + 메타 */}
      <div className="min-w-0 flex-1 flex flex-col">
        <h3 className="line-clamp-2 text-sm font-bold text-gray-900 leading-snug">
          {content.isPinned && <Pin size={11} className="mr-1 inline text-primary-500" />}
          {contentDisplayTitle(content)}
        </h3>
        {summary && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-600 leading-relaxed">
            {summary}
          </p>
        )}
        <div className="mt-auto pt-1.5 flex items-center gap-2 text-[11px] text-gray-400">
          <span className="flex items-center gap-1 truncate min-w-0">
            <span className="truncate font-medium text-gray-600">{headerName}</span>
            {isYouTube && (
              <BadgeCheck size={11} className="shrink-0 text-red-500 fill-red-50" aria-label="YouTube 채널" />
            )}
          </span>
          {headerTime && (
            <>
              <span className="text-gray-300" aria-hidden>·</span>
              <span className="shrink-0">{headerTime}</span>
            </>
          )}
          <span className="ml-auto flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-0.5"><Eye size={11} />{content.views}</span>
            {content.likeCount > 0 && (
              <span className="flex items-center gap-0.5"><Heart size={11} />{content.likeCount}</span>
            )}
            {content.commentCount > 0 && (
              <span className="flex items-center gap-0.5"><MessageCircle size={11} />{content.commentCount}</span>
            )}
          </span>
        </div>
      </div>
    </button>
  );
}
