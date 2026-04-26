"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Eye, Heart, Bookmark, Download, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, googleDriveUcExportViewUrl, extractGoogleDriveFileId } from "@/lib/utils";
import { extractYouTubeVideoId } from "@/lib/youtube";
import type { Content } from "@/types/content";
import { contentDisplayTitle, contentDisplayBody } from "@/lib/content-display";
import {
  incrementContentViews,
  incrementContentDownloads,
  getRelatedContents,
} from "@/lib/content-engine";
import MediaPreview from "@/components/content/MediaPreview";

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
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-gray-900">{title}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span>{content.authorName}</span>
              <span className="flex items-center gap-1"><Eye size={12} />{content.views}</span>
              <span className="flex items-center gap-1"><Heart size={12} />{content.likeCount}</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{content.boardKey}</span>
              {dlBadge && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    dlBadge.tone === "new"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-amber-100 text-amber-800",
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

          {/* 본문 텍스트 */}
          {(body || content.tags?.length) && (
            <div className="px-5 py-4">
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

          {/* 관련 콘텐츠 4개 */}
          {related.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                관련 콘텐츠
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {related.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelectRelated?.(r)}
                    className="group overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition-shadow hover:shadow-md"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-gray-100">
                      <MediaPreview
                        mediaUrl={r.mediaUrl}
                        mediaType={r.mediaType}
                        thumbnailUrl={r.thumbnailUrl}
                        title={contentDisplayTitle(r)}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="p-2">
                      <p className="line-clamp-2 text-xs font-medium text-gray-800 group-hover:text-primary-600">
                        {contentDisplayTitle(r)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
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
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
              aria-label="북마크 (곧 활성화)"
              disabled
            >
              <Bookmark size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
