"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Eye, Heart, Bookmark, Download, ExternalLink, ChevronLeft, ChevronRight, MessageCircle, Share2, Play, BadgeCheck } from "lucide-react";
import { cn, googleDriveUcExportViewUrl, extractGoogleDriveFileId } from "@/lib/utils";
import { extractYouTubeVideoId } from "@/lib/youtube";
import type { Content } from "@/types/content";
import { contentDisplayTitle, contentDisplayBody } from "@/lib/content-display";
import {
  incrementContentViews,
  incrementContentDownloads,
  getRelatedContents,
  toggleReaction,
} from "@/lib/content-engine";
import MediaPreview from "@/components/content/MediaPreview";
import CommentSection from "@/components/content/CommentSection";
import { useAuth } from "@/contexts/AuthContext";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import LoginModal from "@/components/public/LoginModal";
import { useToast } from "@/components/ui/Toast";

/** publishedAtSource 같은 ISO 시간을 한국어 상대 시간으로 */
function relativeTime(iso: string | undefined): string {
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

type Props = {
  content: Content | null;
  onClose: () => void;
  /** 관련 콘텐츠 카드 클릭 시 핸들러 (모달 내부 전환) */
  onSelectRelated?: (c: Content) => void;
  /**
   * 풀스크린 스와이프 갤러리.
   * 호출자가 현재 피드 items 배열을 전달하면 좌/우 키보드 + 모바일 터치 스와이프로
   * 다음/이전 콘텐츠로 이동. 미전달 시 단일 콘텐츠 모달로 동작.
   */
  galleryItems?: Content[];
  onNavigate?: (next: Content) => void;
};

/** 등록 7일 이내. createdAt이 Firestore Timestamp 또는 문자열 모두 처리. */
function isNewWithin7Days(createdAt: unknown): boolean {
  if (!createdAt) return false;
  let ms = 0;
  if (typeof createdAt === "string") {
    ms = new Date(createdAt).getTime();
  } else if (typeof createdAt === "object" && createdAt !== null) {
    const ts = createdAt as { toDate?: () => Date; seconds?: number };
    if (typeof ts.toDate === "function") ms = ts.toDate().getTime();
    else if (typeof ts.seconds === "number") ms = ts.seconds * 1000;
  }
  if (!ms) return false;
  return Date.now() - ms < 7 * 24 * 60 * 60 * 1000;
}

/**
 * 다운로드 카운터 배지 정책:
 * - 등록 7일 이내 → "NEW" 배지
 * - downloadCount ≥ 10 → 숫자 노출 (군중심리)
 * - 그 사이 → 숨김 (저카운트 노출은 역효과)
 */
function downloadBadge(content: Content): { label: string; tone: "new" | "count" } | null {
  if (isNewWithin7Days(content.createdAt)) return { label: "NEW", tone: "new" };
  const n = content.downloadCount ?? 0;
  if (n >= 10) return { label: `${n.toLocaleString()}회 다운로드`, tone: "count" };
  return null;
}

/**
 * 콘텐츠 상세 모달.
 * - 영상: YouTube iframe inline 재생
 * - 이미지/GIF: 큰 미리보기
 * - PDF: Google Drive viewer 링크 + 다운로드 버튼
 * - 일반 링크: 외부 이동 버튼
 * - 닫기: 우상단 X · 배경 클릭 · ESC
 */
export default function ContentDetailModal({
  content,
  onClose,
  onSelectRelated,
  galleryItems,
  onNavigate,
}: Props) {
  const [viewIncremented, setViewIncremented] = useState<string | null>(null);
  const [related, setRelated] = useState<Content[]>([]);
  const touchStartX = useRef<number | null>(null);
  const { user } = useAuth();
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const { toast } = useToast();
  // 낙관적 좋아요·북마크·댓글 카운트 — DB 반영 직후 인디케이터 즉시 갱신
  const [likedDelta, setLikedDelta] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [busyLike, setBusyLike] = useState(false);
  const [busyBookmark, setBusyBookmark] = useState(false);
  const [commentDelta, setCommentDelta] = useState(0);

  // 콘텐츠 변경 시 토글 상태 초기화
  useEffect(() => {
    setLikedDelta(0);
    setBookmarked(false);
    setCommentDelta(0);
  }, [content?.id]);

  // 갤러리 모드 — 현재 인덱스 + 이동 핸들러
  const galleryIndex = useMemo(() => {
    if (!content || !galleryItems || galleryItems.length === 0) return -1;
    return galleryItems.findIndex((c) => c.id === content.id);
  }, [content, galleryItems]);
  const hasGallery = galleryIndex >= 0 && galleryItems !== undefined;
  const canPrev = hasGallery && galleryIndex > 0;
  const canNext = hasGallery && galleryItems !== undefined && galleryIndex < galleryItems.length - 1;

  const goPrev = () => {
    if (!canPrev || !galleryItems || !onNavigate) return;
    onNavigate(galleryItems[galleryIndex - 1]);
  };
  const goNext = () => {
    if (!canNext || !galleryItems || !onNavigate) return;
    onNavigate(galleryItems[galleryIndex + 1]);
  };

  useEffect(() => {
    if (!content) return;
    if (viewIncremented === content.id) return;
    void incrementContentViews(content.id).catch(() => {});
    setViewIncremented(content.id);
  }, [content, viewIncremented]);

  useEffect(() => {
    if (!content) {
      setRelated([]);
      return;
    }
    let cancelled = false;
    getRelatedContents({
      excludeId: content.id,
      boardKey: content.boardKey,
      tags: content.tags,
      limit: 4,
    })
      .then((items) => { if (!cancelled) setRelated(items); })
      .catch(() => { if (!cancelled) setRelated([]); });
    return () => { cancelled = true; };
  }, [content]);

  useEffect(() => {
    if (!content) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && canPrev) goPrev();
      else if (e.key === "ArrowRight" && canNext) goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, onClose, canPrev, canNext]);

  // 모바일 터치 스와이프 — 가로 60px 이상 이동 시 prev/next
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null) return;
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;
    if (Math.abs(delta) < 60) return;
    if (delta > 0 && canPrev) goPrev();
    else if (delta < 0 && canNext) goNext();
  };

  if (!content) return null;

  const title = contentDisplayTitle(content);
  const body = contentDisplayBody(content);
  const mediaType = content.mediaType ?? "none";
  const mediaUrl = content.mediaUrl ?? "";
  const youtubeId = mediaUrl ? extractYouTubeVideoId(mediaUrl) : null;
  const driveId = mediaUrl ? extractGoogleDriveFileId(mediaUrl) : null;
  const isImage = mediaType === "image" || mediaType === "gif";
  const isPdf = mediaType === "pdf";
  const isLink = mediaType === "link";

  const downloadHref = driveId ? googleDriveUcExportViewUrl(driveId) : mediaUrl;
  const dlBadge = downloadBadge(content);

  const handleDownload = () => {
    void incrementContentDownloads(content.id).catch(() => {});
  };

  // YouTube 채널 헤더 매핑 (X.com 스타일)
  const isYouTube = content.mediaType === "youtube" && !!content.channelTitle;
  const headerName = isYouTube ? content.channelTitle! : content.authorName;
  const headerHandle = isYouTube && content.channelId ? `@${content.channelId.slice(0, 14)}` : undefined;
  const headerTime = isYouTube && content.publishedAtSource
    ? relativeTime(content.publishedAtSource)
    : "";
  const displayLikeCount = Math.max(0, content.likeCount + likedDelta);
  const isLiked = likedDelta > 0;

  const handleLike = async () => {
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
      /* 실패 시 원복 */
    } finally {
      setBusyLike(false);
    }
  };

  const handleBookmark = async () => {
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
      /* 실패 무시 */
    } finally {
      setBusyBookmark(false);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/media?id=${content.id}`
      : `/media?id=${content.id}`;
    try {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav && "share" in nav && typeof nav.share === "function") {
        await nav.share({ title, text: body?.slice(0, 100) ?? "", url });
      } else if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
        toast("링크가 복사되었습니다.", "success");
      }
    } catch {
      /* 사용자 취소 등 */
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      {/* 갤러리 좌우 화살표 (데스크톱) — 모달 외부에 위치하여 콘텐츠 가리지 않음 */}
      {canPrev && (
        <button
          type="button"
          onClick={goPrev}
          aria-label="이전 콘텐츠"
          className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-700 shadow-lg hover:bg-white sm:block"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      {canNext && (
        <button
          type="button"
          onClick={goNext}
          aria-label="다음 콘텐츠"
          className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-700 shadow-lg hover:bg-white sm:block"
        >
          <ChevronRight size={20} />
        </button>
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onTouchStart={hasGallery ? onTouchStart : undefined}
        onTouchEnd={hasGallery ? onTouchEnd : undefined}
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl",
        )}
      >
        {/* 헤더 — X.com 스타일 (아바타 + 채널/작성자 + 인증마크 + 시간) */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
          {/* 아바타 */}
          {isYouTube && content.thumbnailUrl ? (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
              <img src={content.thumbnailUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play size={12} className="text-white fill-white" />
              </span>
            </div>
          ) : content.authorPhotoURL ? (
            <img src={content.authorPhotoURL} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-bold text-white">
              {headerName?.charAt(0) ?? "A"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold text-gray-900 truncate">{headerName}</span>
              {isYouTube && (
                <BadgeCheck size={14} className="shrink-0 text-red-500 fill-red-50" aria-label="YouTube 채널" />
              )}
              {headerHandle && (
                <span className="hidden sm:inline text-gray-500 text-xs truncate">{headerHandle}</span>
              )}
              {headerTime && (
                <>
                  <span className="text-gray-400" aria-hidden>·</span>
                  <span className="text-gray-500 text-xs">{headerTime}</span>
                </>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
              <span className="rounded bg-gray-100 px-1.5 py-0.5">{content.boardKey}</span>
              {dlBadge && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-bold",
                    dlBadge.tone === "new" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800",
                  )}
                >
                  {dlBadge.label}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">
          {/* 미디어 영역 */}
          <div className="bg-gray-50">
            {youtubeId ? (
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
                  title={title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            ) : isImage && mediaUrl ? (
              <div className="flex justify-center bg-gray-900 p-2">
                <img
                  src={mediaUrl}
                  alt={title}
                  className="max-h-[60vh] w-auto object-contain"
                  loading="lazy"
                />
              </div>
            ) : isPdf && driveId ? (
              <div className="aspect-[4/3] w-full bg-white">
                <iframe
                  src={`https://drive.google.com/file/d/${driveId}/preview`}
                  title={title}
                  className="h-full w-full border-0"
                  allow="autoplay"
                />
              </div>
            ) : content.thumbnailUrl ? (
              <div className="flex justify-center bg-gray-900 p-2">
                <img
                  src={content.thumbnailUrl}
                  alt={title}
                  className="max-h-[40vh] w-auto object-contain"
                  loading="lazy"
                />
              </div>
            ) : null}
          </div>

          {/* 제목 + 본문 텍스트 + 태그 */}
          {(title || body || content.tags?.length) && (
            <div className="px-5 py-4 border-t border-gray-100">
              {title && (
                <h1 className="text-lg font-bold text-gray-900 leading-snug mb-2">{title}</h1>
              )}
              {body && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{body}</p>
              )}
              {content.tags && content.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {content.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* X.com 스타일 액션바 — 댓글·좋아요·북마크·공유·조회수 */}
          <div className="flex items-center gap-6 border-y border-gray-100 px-5 py-3 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <MessageCircle size={16} />
              <span>{Math.max(0, (content.commentCount ?? 0) + commentDelta)}</span>
            </span>
            <button
              type="button"
              onClick={handleLike}
              disabled={busyLike}
              className={cn(
                "flex items-center gap-1.5 transition-colors hover:text-rose-500 disabled:opacity-50",
                isLiked && "text-rose-500",
              )}
              aria-label="좋아요"
              aria-pressed={isLiked}
            >
              <Heart size={16} className={isLiked ? "fill-current" : ""} />
              <span>{displayLikeCount}</span>
            </button>
            <button
              type="button"
              onClick={handleBookmark}
              disabled={busyBookmark}
              className={cn(
                "flex items-center gap-1.5 transition-colors hover:text-primary-600 disabled:opacity-50",
                bookmarked && "text-primary-600",
              )}
              aria-label="북마크"
              aria-pressed={bookmarked}
            >
              <Bookmark size={16} className={bookmarked ? "fill-current" : ""} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 transition-colors hover:text-primary-600"
              aria-label="공유"
            >
              <Share2 size={16} />
            </button>
            <span className="ml-auto flex items-center gap-1.5">
              <Eye size={16} />
              <span>{content.views}</span>
            </span>
          </div>

          {/* 댓글 섹션 — 답글 스레드 */}
          <div className="px-5 py-4">
            <CommentSection
              contentId={content.id}
              contentAuthorUid={content.authorUid}
              contentTitle={title}
              onCountChange={(delta) => setCommentDelta((d) => d + delta)}
            />
          </div>

          {/* 관련 콘텐츠 — 답글처럼 세로 카드 (X.com 스레드 스타일) */}
          {related.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                관련 콘텐츠
              </h3>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRelated?.(r)}
                      className="flex gap-3 w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition-shadow hover:shadow-md p-2"
                    >
                      <div className="w-32 aspect-video shrink-0 overflow-hidden bg-gray-100 rounded">
                        <MediaPreview
                          mediaUrl={r.mediaUrl}
                          mediaType={r.mediaType}
                          thumbnailUrl={r.thumbnailUrl}
                          title={contentDisplayTitle(r)}
                          className="h-full w-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-gray-900 hover:text-primary-600">
                          {contentDisplayTitle(r)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 truncate">
                          {r.channelTitle ?? r.authorName}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 하단 액션 */}
        {(mediaUrl || isLink) && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
            {(isPdf || isLink) && downloadHref && (
              <a
                href={downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                <Download size={14} />
                다운로드
              </a>
            )}
            {mediaUrl && !isPdf && (
              <a
                href={mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <ExternalLink size={14} />
                원본 열기
              </a>
            )}
          </div>
        )}
      </div>
      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </div>
  );
}
