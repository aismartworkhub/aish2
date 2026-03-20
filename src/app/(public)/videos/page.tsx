"use client";

import { useState } from "react";
import { Play, ExternalLink } from "lucide-react";
import { VIDEO_CATEGORY_LABELS } from "@/lib/constants";

const DEMO_VIDEOS = [
  { id: "v1", title: "AI 기초 정규과정 OT", category: "LECTURE", youtubeUrl: "https://youtube.com/watch?v=example1", thumbnailUrl: "", publishedAt: "2026-03-01" },
  { id: "v2", title: "제3회 스마트워크톤 하이라이트", category: "WORKATHON", youtubeUrl: "https://youtube.com/watch?v=example2", thumbnailUrl: "", publishedAt: "2025-12-15" },
  { id: "v3", title: "김상용 강사 인터뷰", category: "INTERVIEW", youtubeUrl: "https://youtube.com/watch?v=example3", thumbnailUrl: "", publishedAt: "2026-01-10" },
  { id: "v4", title: "AISH 홍보 영상", category: "PROMO", youtubeUrl: "https://youtube.com/watch?v=example4", thumbnailUrl: "", publishedAt: "2025-09-01" },
];

export default function VideosPage() {
  const [filter, setFilter] = useState("ALL");
  const filtered = filter === "ALL" ? DEMO_VIDEOS : DEMO_VIDEOS.filter((v) => v.category === filter);

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((video) => (
            <a
              key={video.id}
              href={video.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="text-primary-600 ml-1" size={28} />
                </div>
              </div>
              <div className="p-4">
                <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                  {VIDEO_CATEGORY_LABELS[video.category]}
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
