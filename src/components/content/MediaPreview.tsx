"use client";

import { useMemo, useState, useEffect } from "react";
import { Play, Image as ImageIcon, FileText, Link2 } from "lucide-react";
import { cn, extractGoogleDriveFileId, googleDriveThumbnailUrl, toDirectImageUrl } from "@/lib/utils";
import type { MediaType } from "@/types/content";
import { detectMediaType } from "@/lib/content-engine";

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

/** mediaUrl / thumbnailUrl에서 시도할 이미지 URL 후보 목록을 생성 */
function buildImageCandidates(mediaUrl?: string, thumbnailUrl?: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (u: string) => {
    if (u && !seen.has(u)) { seen.add(u); candidates.push(u); }
  };

  if (thumbnailUrl) add(thumbnailUrl);

  for (const raw of [mediaUrl, thumbnailUrl]) {
    if (!raw) continue;
    const fileId = extractGoogleDriveFileId(raw);
    if (fileId) {
      add(toDirectImageUrl(raw));
      add(googleDriveThumbnailUrl(fileId, 800));
    }
  }

  if (mediaUrl && !extractGoogleDriveFileId(mediaUrl)) {
    add(mediaUrl);
  }

  return candidates;
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

  const candidates = useMemo(
    () => buildImageCandidates(mediaUrl, thumbnailUrl),
    [mediaUrl, thumbnailUrl],
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
    const Icon = FALLBACK_ICON[mediaType];
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
              <Icon size={22} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // 최종 폴백: 타입별 아이콘
  const Icon = FALLBACK_ICON[mediaType];
  return (
    <div className={cn(
      "flex items-center justify-center bg-gray-100 dark:bg-gray-800",
      className,
    )}>
      <Icon size={32} className="text-gray-400" />
    </div>
  );
}
