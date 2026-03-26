"use client";

import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { VIDEO_CATEGORY_LABELS } from "@/lib/constants";
import { getCollection, COLLECTIONS } from "@/lib/firestore";

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?&#]+)/,
    /youtube\.com\/embed\/([^?&#]+)/,
    /youtube\.com\/shorts\/([^?&#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getYoutubeThumbnail(video: VideoItem): string {
  if (video.thumbnailUrl) return video.thumbnailUrl;
  const id = extractYouTubeId(video.youtubeUrl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

const FALLBACK_VIDEOS: VideoItem[] = [
  { id: "v1", title: "AI 기초 정규과정 OT", category: "LECTURE", youtubeUrl: "", publishedAt: "2026-03-01" },
  { id: "v2", title: "제3회 스마트워크톤 하이라이트", category: "WORKATHON", youtubeUrl: "", publishedAt: "2025-12-15" },
  { id: "v3", title: "김상용 강사 인터뷰", category: "INTERVIEW", youtubeUrl: "", publishedAt: "2026-01-10" },
  { id: "v4", title: "AISH 홍보 영상", category: "PROMO", youtubeUrl: "", publishedAt: "2025-09-01" },
];

interface VideoItem {
  id: string;
  title: string;
  category: string;
  youtubeUrl: string;
  thumbnailUrl?: string;
  publishedAt: string;
}

export default function VideosPage() {
  const [filter, setFilter] = useState("ALL");
  const [videos, setVideos] = useState<VideoItem[]>(FALLBACK_VIDEOS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCollection<VideoItem>(COLLECTIONS.VIDEOS)
      .then((data) => { if (data.length > 0) setVideos(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "ALL" ? videos : videos.filter((v) => v.category === filter);

  return (
    <div className="py-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">영상 콘텐츠</h1>
          <p className="text-lg text-gray-500">AISH의 다양한 영상 콘텐츠를 만나보세요.</p>
        </div>

        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === "ALL" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            전체
          </button>
          {Object.entries(VIDEO_CATEGORY_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === key ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {!loading && filtered.map((video) => (
            <a
              key={video.id}
              href={video.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gray-100 relative overflow-hidden">
                {getYoutubeThumbnail(video) && (
                   
                  <img
                    src={getYoutubeThumbnail(video)}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="text-primary-600 ml-1" size={28} />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                  {VIDEO_CATEGORY_LABELS[video.category] || video.category}
                </span>
                <h3 className="font-semibold text-gray-900 mt-2 group-hover:text-primary-600 transition-colors">
                  {video.title}
                </h3>
                <p className="text-xs text-gray-400 mt-1">{video.publishedAt}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
