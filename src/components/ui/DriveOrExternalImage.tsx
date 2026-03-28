"use client";

import { useMemo, useState, useEffect } from "react";
import { ImageIcon } from "lucide-react";
import {
  cn,
  toDirectImageUrl,
  extractGoogleDriveFileId,
  googleDriveThumbnailUrl,
} from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
  /** 로드 실패 시 안내 박스 대신 빈 영역만 */
  quiet?: boolean;
};

/**
 * Google Drive 공유 링크·직접 URL을 표시한다.
 * googleusercontent 실패 시 Drive thumbnail API로 순차 폴백한다.
 */
export default function DriveOrExternalImage({ src, alt, className, quiet }: Props) {
  const urls = useMemo(() => {
    const t = src.trim();
    if (!t) return [];
    const primary = toDirectImageUrl(t);
    const list: string[] = [primary];
    const fileId = extractGoogleDriveFileId(t) ?? extractGoogleDriveFileId(primary);
    if (fileId) {
      const thumb = googleDriveThumbnailUrl(fileId);
      if (!list.includes(thumb)) list.push(thumb);
    }
    return list;
  }, [src]);

  const [index, setIndex] = useState(0);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    setIndex(0);
    setDead(false);
  }, [src]);

  if (!src.trim() || urls.length === 0) {
    return (
      <div className={cn("flex items-center justify-center bg-gray-100 text-gray-300", className)}>
        <ImageIcon size={28} />
      </div>
    );
  }

  if (dead) {
    if (quiet) {
      return <div className={cn("bg-gray-100", className)} aria-hidden />;
    }
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-amber-50 text-amber-900 text-[11px] leading-snug p-2 text-center",
          className
        )}
      >
        <ImageIcon size={22} className="opacity-50 shrink-0" />
        <span>
          미리보기를 불러올 수 없습니다. Drive 파일은 &quot;링크가 있는 모든 사용자&quot;로 공개했는지 확인하세요.
        </span>
      </div>
    );
  }

  const url = urls[Math.min(index, urls.length - 1)];

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => {
        if (index < urls.length - 1) setIndex((i) => i + 1);
        else setDead(true);
      }}
    />
  );
}
