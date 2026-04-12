"use client";

import { useMemo, useState } from "react";
import { Play, Image as ImageIcon, FileText, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
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

  const [imgError, setImgError] = useState(false);

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

  if (mediaType === "image" || mediaType === "gif") {
    const src = mediaUrl || thumbnailUrl;
    if (src && !imgError) {
      return (
        <img
          src={src}
          alt={title}
          className={cn("h-full w-full object-cover", className)}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      );
    }
  }

  if (mediaType === "pdf" && mediaUrl && embed) {
    return (
      <div className={cn("relative aspect-[4/3] w-full overflow-hidden rounded-lg", className)}>
        <iframe src={mediaUrl} title={title} className="absolute inset-0 h-full w-full" />
      </div>
    );
  }

  if (thumbnailUrl && !imgError) {
    const Icon = FALLBACK_ICON[mediaType];
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <img
          src={thumbnailUrl}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
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
