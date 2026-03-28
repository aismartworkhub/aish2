"use client";

import { useMemo, useState, useEffect } from "react";
import { Play } from "lucide-react";
import { youtubeThumbnailUrls } from "@/lib/youtube";
import { cn } from "@/lib/utils";

type Props = {
  videoUrl: string;
  alt: string;
  className?: string;
  /** Firestore 등에 저장된 커스텀 썸네일이 있으면 최우선 */
  preferredThumbnailUrl?: string | null;
};

/**
 * YouTube 썸네일 표시. referrer 제한·없는 해상도 대비 mq→hq→default 순 폴백.
 */
export default function YouTubeThumbnailImage({
  videoUrl,
  alt,
  className,
  preferredThumbnailUrl,
}: Props) {
  const urls = useMemo(() => {
    const custom = preferredThumbnailUrl?.trim();
    const yt = youtubeThumbnailUrls(videoUrl);
    if (custom) return [custom, ...yt.filter((u) => u !== custom)];
    return yt;
  }, [videoUrl, preferredThumbnailUrl]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [videoUrl, preferredThumbnailUrl]);

  if (urls.length === 0) {
    return (
      <div className={cn("flex items-center justify-center bg-gray-900/40", className)}>
        <Play className="text-white/45" size={32} />
      </div>
    );
  }

  const src = urls[Math.min(index, urls.length - 1)];

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => {
        if (index < urls.length - 1) setIndex((i) => i + 1);
      }}
    />
  );
}
