"use client";

import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { VIDEO_CATEGORY_LABELS } from "@/lib/constants";
import { getCollection, COLLECTIONS } from "@/lib/firestore";
import YouTubeThumbnailImage from "@/components/ui/YouTubeThumbnailImage";

const FALLBACK_VIDEOS: VideoItem[] = [
  { id: "v1", title: "AI 기초 정규과정 OT", category: "LECTURE", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", publishedAt: "2026-03-01" },
  { id: "v2", title: "제3회 스마트워크톤 하이라이트", category: "WORKATHON", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", publishedAt: "2025-12-15" },
  { id: "v3", title: "김상용 강사 인터뷰", category: "INTERVIEW", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", publishedAt: "2026-01-10" },
  { id: "v4", title: "AISH 홍보 영상", category: "PROMO", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", publishedAt: "2025-09-01" },
];

interface VideoItem {
  id: string;
  title: string;
  category: string;
  youtubeUrl: string;
  thumbnailUrl?: string;
  publishedAt: string;
  /** 관리자 영상 목록의 날짜 필드와 호환 */
  date?: string;
}

export default function VideosPage() {
  const [filter, setFilter] = useState("ALL");
  const [videos, setVideos] = useState<VideoItem[]>(FALLBACK_VIDEOS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCollection<VideoItem>(COLLECTIONS.VIDEOS)
      .then((data) => {
        if (data.length === 0) return;
        const withUrl = data.filter((v) => v.youtubeUrl?.trim());
        const list = withUrl.length > 0 ? withUrl : data;
        const sorted = [...list].sort((a, b) => {
          const da = a.publishedAt || a.date || "";
          const db = b.publishedAt || b.date || "";
          return db.localeCompare(da);
        });
        setVideos(sorted);
      })
      .catch((err) => console.error('[VideosPage] Firestore fetch failed:', err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "ALL" ? videos : videos.filter((v) => v.category === filter);

  return (
    <div className="py-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-brand-dark uppercase tracking-tight mb-3">영상 콘텐츠</h1>
          <p className="text-lg text-gray-500">AISH의 다양한 영상 콘텐츠를 만나보세요.</p>
        </div>

        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors ${
              filter === "ALL" ? "bg-brand-blue text-white" : "bg-brand-gray text-gray-600 hover:bg-gray-200"
            }`}
          >
            전체
          </button>
          {Object.entries(VIDEO_CATEGORY_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors ${
                filter === key ? "bg-brand-blue text-white" : "bg-brand-gray text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-border border-t-brand-blue rounded-full animate-spin" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {!loading && filtered.map((video) => {
            const hasUrl = !!video.youtubeUrl?.trim();
            const Wrapper = hasUrl ? "a" : "div";
            const wrapperProps = hasUrl
              ? { href: video.youtubeUrl, target: "_blank" as const, rel: "noopener noreferrer" }
              : {};
            return (
              <Wrapper
                key={video.id}
                {...wrapperProps}
                className={`group bg-white rounded-sm border border-brand-border overflow-hidden transition-shadow ${
                  hasUrl ? "hover:shadow-md cursor-pointer" : "opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="aspect-video bg-brand-gray relative overflow-hidden">
                  <YouTubeThumbnailImage
                    videoUrl={video.youtubeUrl}
                    alt={video.title}
                    preferredThumbnailUrl={video.thumbnailUrl}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="text-brand-blue ml-1" size={28} />
                    </div>
                  </div>
                  {!hasUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded">영상 준비 중</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <span className="text-xs bg-brand-gray text-brand-blue px-2 py-0.5 rounded-full">
                    {VIDEO_CATEGORY_LABELS[video.category] || video.category}
                  </span>
                  <h3 className="font-semibold text-gray-900 mt-2 group-hover:text-brand-blue transition-colors">
                    {video.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">{video.publishedAt || video.date}</p>
                </div>
              </Wrapper>
            );
          })}
        </div>
      </div>
    </div>
  );
}
