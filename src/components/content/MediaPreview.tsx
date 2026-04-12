"use client";

import { useMemo, useState, useEffect } from "react";
import { Play, Image as ImageIcon, FileText, Link2, File } from "lucide-react";
import {
  cn,
  extractGoogleDriveFileId,
  googleDriveThumbnailUrl,
  googleDriveUcExportViewUrl,
} from "@/lib/utils";
import type { MediaType } from "@/types/content";
import { detectMediaType } from "@/lib/content-engine";
import { youtubeThumbnailUrls } from "@/lib/youtube";

type Props = {
  mediaUrl?: string;
  mediaType?: MediaType;
  thumbnailUrl?: string;
  title: string;
  className?: string;
  /** true면 YouTube iframe 임베드, false면 썸네일만 */
  embed?: boolean;
};

const FALLBACK_ICON: Record<MediaType, typeof Play> = {
  youtube: Play,
  image: ImageIcon,
  gif: ImageIcon,
  pdf: FileText,
  link: Link2,
  none: ImageIcon,
};

const FILE_EXT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pdf:  { bg: "from-red-500 to-red-700",    text: "text-red-100",    label: "PDF" },
  doc:  { bg: "from-blue-500 to-blue-700",   text: "text-blue-100",   label: "DOC" },
  docx: { bg: "from-blue-500 to-blue-700",   text: "text-blue-100",   label: "DOCX" },
  ppt:  { bg: "from-orange-500 to-orange-700", text: "text-orange-100", label: "PPT" },
  pptx: { bg: "from-orange-500 to-orange-700", text: "text-orange-100", label: "PPTX" },
  xls:  { bg: "from-green-500 to-green-700",  text: "text-green-100",  label: "XLS" },
  xlsx: { bg: "from-green-500 to-green-700",  text: "text-green-100",  label: "XLSX" },
  hwp:  { bg: "from-sky-500 to-sky-700",     text: "text-sky-100",    label: "HWP" },
  hwpx: { bg: "from-sky-500 to-sky-700",     text: "text-sky-100",    label: "HWPX" },
};

function extractExtension(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/\.(\w{2,5})(?:[?#]|$)/);
  return m ? m[1].toLowerCase() : null;
}

function isDocumentType(mediaType: MediaType, url?: string): boolean {
  if (mediaType === "pdf") return true;
  if (mediaType === "link" && url) {
    const ext = extractExtension(url);
    if (ext && ext in FILE_EXT_STYLE) return true;
    if (/docs\.google\.com\/(document|spreadsheets|presentation)/.test(url)) return true;
  }
  return false;
}

function getFileStyle(mediaType: MediaType, url?: string) {
  if (mediaType === "pdf") return FILE_EXT_STYLE.pdf;
  const ext = extractExtension(url);
  if (ext && ext in FILE_EXT_STYLE) return FILE_EXT_STYLE[ext];
  if (url) {
    if (/docs\.google\.com\/presentation/.test(url)) return FILE_EXT_STYLE.pptx;
    if (/docs\.google\.com\/spreadsheets/.test(url)) return FILE_EXT_STYLE.xlsx;
    if (/docs\.google\.com\/document/.test(url)) return FILE_EXT_STYLE.docx;
  }
  return null;
}

/** mediaUrl / thumbnailUrl에서 시도할 이미지 URL 후보 목록을 생성 */
function buildImageCandidates(mediaUrl?: string, thumbnailUrl?: string, mediaType?: MediaType): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (u: string) => {
    if (u && !seen.has(u)) { seen.add(u); candidates.push(u); }
  };

  // YouTube: mqdefault → hqdefault → default 다단계 폴백
  if (mediaType === "youtube" && mediaUrl) {
    for (const ytUrl of youtubeThumbnailUrls(mediaUrl)) add(ytUrl);
    return candidates;
  }

  const driveFileIds = new Set<string>();
  for (const raw of [mediaUrl, thumbnailUrl]) {
    if (!raw) continue;
    const id = extractGoogleDriveFileId(raw);
    if (id) driveFileIds.add(id);
  }

  // Google Drive: 비로그인 사용자는 lh3.googleusercontent.com이 자주 차단됨.
  // thumbnail API → uc export=view → 원본 URL 순으로 시도.
  if (driveFileIds.size > 0) {
    for (const fileId of driveFileIds) {
      add(googleDriveThumbnailUrl(fileId, 400));
      add(googleDriveThumbnailUrl(fileId, 800));
      add(googleDriveUcExportViewUrl(fileId));
    }
    if (thumbnailUrl) add(thumbnailUrl);
    if (mediaUrl && mediaUrl !== thumbnailUrl) add(mediaUrl);
    return candidates;
  }

  if (thumbnailUrl) add(thumbnailUrl);

  // 일반 이미지 URL (YouTube/Drive가 아닌 경우만)
  if (mediaUrl && !extractGoogleDriveFileId(mediaUrl)) {
    const isDoc = mediaType && isDocumentType(mediaType, mediaUrl);
    if (!isDoc) add(mediaUrl);
  }

  return candidates;
}

/** 문서(PDF/DOC/PPT 등) 가상 썸네일 */
function DocumentThumbnail({ title, mediaType, mediaUrl, className }: {
  title: string; mediaType: MediaType; mediaUrl?: string; className?: string;
}) {
  const style = getFileStyle(mediaType, mediaUrl);
  const gradientBg = style?.bg ?? "from-gray-500 to-gray-700";
  const textColor = style?.text ?? "text-gray-100";
  const extLabel = style?.label ?? "FILE";

  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-2 bg-gradient-to-br p-4",
      gradientBg,
      className,
    )}>
      <File size={28} className={cn("opacity-80", textColor)} />
      <span className={cn(
        "rounded-md bg-white/20 px-3 py-1 text-xs font-bold tracking-wider backdrop-blur-sm",
        textColor,
      )}>
        {extLabel}
      </span>
      <p className={cn(
        "mt-1 line-clamp-2 text-center text-xs font-medium leading-snug",
        textColor,
      )}>
        {title}
      </p>
    </div>
  );
}

/** 이미지 실패 시 제목 오버레이 폴백 */
function TitleFallback({ title, mediaType, className }: {
  title: string; mediaType: MediaType; className?: string;
}) {
  const Icon = FALLBACK_ICON[mediaType];
  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-200 to-gray-300 p-4",
      className,
    )}>
      <Icon size={28} className="text-gray-400" />
      <p className="line-clamp-2 text-center text-xs font-medium leading-snug text-gray-500">
        {title}
      </p>
    </div>
  );
}

/** 갤러리 이미지 로드 실패 시 — 문서 썸네일과 톤 맞춘 가상 카드 */
function ImageGalleryFallback({ title, mediaUrl, className }: {
  title: string; mediaUrl?: string; className?: string;
}) {
  const looksLikeDrive =
    !!mediaUrl &&
    /drive\.google\.com|googleusercontent\.com|docs\.google\.com/.test(mediaUrl);

  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-500 to-indigo-700 p-4",
      className,
    )}>
      <ImageIcon size={28} className="text-white/80" />
      <span className="rounded-md bg-white/20 px-3 py-1 text-xs font-bold tracking-wider text-white backdrop-blur-sm">
        이미지
      </span>
      <p className="mt-1 line-clamp-2 text-center text-xs font-medium leading-snug text-white">
        {title}
      </p>
      {looksLikeDrive && (
        <p className="line-clamp-2 text-center text-[10px] leading-tight text-white/70">
          비공개 Google 파일은 비회원에게 표시되지 않습니다. Drive에서 &quot;링크가 있는 모든 사용자&quot;로 공유해 주세요.
        </p>
      )}
    </div>
  );
}

export default function MediaPreview({
  mediaUrl,
  mediaType: typeProp,
  thumbnailUrl: thumbProp,
  title,
  className,
  embed = false,
}: Props) {
  const detected = useMemo(
    () => (mediaUrl ? detectMediaType(mediaUrl) : null),
    [mediaUrl],
  );

  const mediaType = typeProp ?? detected?.mediaType ?? "none";
  const thumbnailUrl = thumbProp || detected?.thumbnailUrl;
  const embedUrl = detected?.embedUrl;

  const isDoc = useMemo(
    () => isDocumentType(mediaType, mediaUrl),
    [mediaType, mediaUrl],
  );

  const candidates = useMemo(
    () => buildImageCandidates(mediaUrl, thumbnailUrl, mediaType),
    [mediaUrl, thumbnailUrl, mediaType],
  );

  const [imgIdx, setImgIdx] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  useEffect(() => {
    setImgIdx(0);
    setAllFailed(false);
  }, [mediaUrl, thumbnailUrl]);

  const handleImgError = () => {
    if (imgIdx < candidates.length - 1) setImgIdx((i) => i + 1);
    else setAllFailed(true);
  };

  // YouTube 임베드
  if (embed && mediaType === "youtube" && embedUrl) {
    return (
      <div className={cn("relative aspect-video w-full overflow-hidden rounded-lg bg-black", className)}>
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }

  // PDF 임베드
  if (mediaType === "pdf" && mediaUrl && embed) {
    return (
      <div className={cn("relative aspect-[4/3] w-full overflow-hidden rounded-lg", className)}>
        <iframe src={mediaUrl} title={title} className="absolute inset-0 h-full w-full" />
      </div>
    );
  }

  // 이미지 후보가 있고 아직 모두 실패하지 않았으면 순차 시도
  if (candidates.length > 0 && !allFailed) {
    const currentSrc = candidates[Math.min(imgIdx, candidates.length - 1)];
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <img
          src={currentSrc}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleImgError}
        />
        {mediaType === "youtube" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full",
              "bg-red-600/90 text-white shadow-lg",
            )}>
              <Play size={22} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // 문서(PDF/DOC/PPT 등) → 확장자별 색상 가상 썸네일
  if (isDoc) {
    return <DocumentThumbnail title={title} mediaType={mediaType} mediaUrl={mediaUrl} className={className} />;
  }

  // 갤러리 이미지/GIF 로드 실패 → 가상 썸네일 + Drive 안내
  if (mediaType === "image" || mediaType === "gif") {
    return <ImageGalleryFallback title={title} mediaUrl={mediaUrl} className={className} />;
  }

  // 최종 폴백: 제목 + 아이콘 오버레이
  return <TitleFallback title={title} mediaType={mediaType} className={className} />;
}
