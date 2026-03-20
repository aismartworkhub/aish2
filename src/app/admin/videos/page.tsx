"use client";

import { useState } from "react";
import { Plus, Search, Play, Edit, Trash2, X, Save, Star, ExternalLink, Youtube, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { VIDEO_CATEGORY_LABELS } from "@/lib/constants";

type VideoCategory = "LECTURE" | "WORKATHON" | "INTERVIEW" | "PROMO";

interface Video {
  id: string;
  title: string;
  category: VideoCategory;
  duration: string;
  instructor: string;
  date: string;
  featured: boolean;
  youtubeUrl: string;
  description: string;
}

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getYoutubeThumbnail(url: string): string | null {
  const id = extractYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

const INITIAL_VIDEOS: Video[] = [
  { id: "v1", title: "AI 기초 강의 1주차 - 인공지능이란?", category: "LECTURE", duration: "15:30", instructor: "김상용", date: "2026.03.14", featured: true, youtubeUrl: "https://youtu.be/dQw4w9WgXcQ", description: "AI 기초 과정 1주차 강의 영상입니다." },
  { id: "v2", title: "프롬프트 엔지니어링 실전 가이드", category: "LECTURE", duration: "22:15", instructor: "김상용", date: "2026.03.12", featured: false, youtubeUrl: "https://youtu.be/example2", description: "" },
  { id: "v3", title: "제3회 스마트워크톤 현장 스케치", category: "WORKATHON", duration: "08:45", instructor: "-", date: "2026.02.28", featured: true, youtubeUrl: "https://youtu.be/example3", description: "" },
  { id: "v4", title: "바이브 코딩으로 만드는 인터랙티브 아트", category: "LECTURE", duration: "18:20", instructor: "제갈정", date: "2026.02.20", featured: false, youtubeUrl: "https://youtu.be/example4", description: "" },
  { id: "v5", title: "김상용 디렉터 인터뷰", category: "INTERVIEW", duration: "12:00", instructor: "김상용", date: "2026.02.15", featured: false, youtubeUrl: "https://youtu.be/example5", description: "" },
];

const emptyVideo = (): Video => ({
  id: `v-${Date.now()}`,
  title: "",
  category: "LECTURE",
  duration: "00:00",
  instructor: "",
  date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
  featured: false,
  youtubeUrl: "",
  description: "",
});

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<Video[]>(INITIAL_VIDEOS);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | VideoCategory>("ALL");
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");

  const filtered = videos.filter((v) => {
    const matchSearch = !searchQuery || v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.instructor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = categoryFilter === "ALL" || v.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const startCreate = () => { setEditingVideo(emptyVideo()); setIsCreating(true); };
  const startEdit = (v: Video) => { setEditingVideo({ ...v }); setIsCreating(false); };

  const saveVideo = () => {
    if (!editingVideo || !editingVideo.title.trim()) return;
    if (isCreating) {
      setVideos((prev) => [editingVideo, ...prev]);
    } else {
      setVideos((prev) => prev.map((v) => (v.id === editingVideo.id ? editingVideo : v)));
    }
    setEditingVideo(null);
  };

  const deleteVideo = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) setVideos((prev) => prev.filter((v) => v.id !== id));
  };

  const toggleFeatured = (id: string) => {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, featured: !v.featured } : v)));
  };

  const handleBulkAdd = () => {
    const urls = bulkUrls.split("\n").map((u) => u.trim()).filter((u) => u.length > 0);
    if (urls.length === 0) return;
    const newVideos: Video[] = urls.map((url, i) => ({
      id: `v-bulk-${Date.now()}-${i}`,
      title: `새 영상 ${i + 1}`,
      category: "LECTURE" as VideoCategory,
      duration: "00:00",
      instructor: "",
      date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
      featured: false,
      youtubeUrl: url,
      description: "",
    }));
    setVideos((prev) => [...newVideos, ...prev]);
    setBulkUrls("");
    setBulkMode(false);
  };

  // Auto-fill title from YouTube URL when URL changes in modal
  const handleUrlChange = (url: string) => {
    if (!editingVideo) return;
    setEditingVideo({ ...editingVideo, youtubeUrl: url });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">영상 관리</h1>
          <p className="text-gray-500 mt-1">YouTube 영상을 등록하고 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBulkMode(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            <Youtube size={18} />
            대량 등록
          </button>
          <button onClick={startCreate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
            <Plus size={18} />
            영상 등록
          </button>
        </div>
      </div>

      {/* 검색 + 카테고리 필터 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="영상 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
        </div>
        <div className="flex gap-1">
          {([{ key: "ALL", label: "전체" }, ...Object.entries(VIDEO_CATEGORY_LABELS).map(([k, v]) => ({ key: k, label: v }))] as { key: string; label: string }[]).map((tab) => (
            <button key={tab.key} onClick={() => setCategoryFilter(tab.key as "ALL" | VideoCategory)}
              className={cn("px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                categoryFilter === tab.key ? "bg-primary-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50")}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">전체 영상</p>
          <p className="text-2xl font-bold text-gray-900">{videos.length}개</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">추천 영상</p>
          <p className="text-2xl font-bold text-yellow-600">{videos.filter((v) => v.featured).length}개</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">강의 영상</p>
          <p className="text-2xl font-bold text-blue-600">{videos.filter((v) => v.category === "LECTURE").length}개</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">카테고리</p>
          <p className="text-2xl font-bold text-gray-900">{Object.keys(VIDEO_CATEGORY_LABELS).length}종</p>
        </div>
      </div>

      {/* 영상 목록 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((video) => {
          const thumbnail = getYoutubeThumbnail(video.youtubeUrl);
          return (
            <div key={video.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center overflow-hidden">
                {thumbnail ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbnail} alt={video.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center">
                        <Play size={20} className="text-white ml-0.5" fill="white" />
                      </div>
                    </div>
                  </>
                ) : (
                  <Play size={32} className="text-white/50" />
                )}
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-mono">{video.duration}</span>
                {video.featured && <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-yellow-500 text-white text-xs font-medium">추천</span>}
              </div>
              <div className="p-4">
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                  video.category === "LECTURE" ? "bg-blue-100 text-blue-700" :
                  video.category === "WORKATHON" ? "bg-purple-100 text-purple-700" :
                  video.category === "INTERVIEW" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                )}>{VIDEO_CATEGORY_LABELS[video.category]}</span>
                <h3 className="font-semibold text-gray-900 mt-2 text-sm line-clamp-2">{video.title}</h3>
                {video.youtubeUrl && (
                  <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-xs text-red-500 hover:text-red-600">
                    <Youtube size={12} />YouTube에서 보기 <ExternalLink size={10} />
                  </a>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-400"><span>{video.instructor}</span> · <span>{video.date}</span></div>
                  <div className="flex gap-1">
                    <button onClick={() => toggleFeatured(video.id)} className={cn("p-1.5 rounded-lg transition-colors", video.featured ? "bg-yellow-50 text-yellow-600" : "text-gray-400 hover:text-yellow-600 hover:bg-yellow-50")}>
                      <Star size={14} />
                    </button>
                    <button onClick={() => startEdit(video)} className="p-1.5 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => deleteVideo(video.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-gray-400"><Play size={32} className="mx-auto mb-2" /><p className="text-sm">영상이 없습니다.</p></div>
      )}

      {/* 대량 등록 모달 */}
      {bulkMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">YouTube 대량 등록</h2>
              <button onClick={() => setBulkMode(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-lg">
                YouTube URL을 한 줄에 하나씩 입력하세요. 등록 후 제목과 정보를 수정할 수 있습니다.
              </div>
              <textarea rows={8} value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)}
                placeholder={"https://youtu.be/abc123\nhttps://youtube.com/watch?v=def456\nhttps://youtu.be/ghi789"}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none font-mono" />
              <p className="text-xs text-gray-500">
                {bulkUrls.split("\n").filter((u) => u.trim().length > 0).length}개 URL 입력됨
              </p>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setBulkMode(false)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleBulkAdd} disabled={bulkUrls.trim().length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50">
                <Plus size={16} />일괄 등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 등록/수정 모달 */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{isCreating ? "영상 등록" : "영상 수정"}</h2>
              <button onClick={() => setEditingVideo(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* YouTube URL + 미리보기 */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">YouTube URL</label>
                <div className="flex gap-3">
                  <input type="url" value={editingVideo.youtubeUrl} onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://youtu.be/... 또는 https://youtube.com/watch?v=..."
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                  {editingVideo.youtubeUrl && (
                    <a href={editingVideo.youtubeUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-2.5 rounded-lg bg-red-50 text-red-600 text-sm hover:bg-red-100 transition-colors shrink-0">
                      <ExternalLink size={14} />열기
                    </a>
                  )}
                </div>
                {/* 썸네일 미리보기 */}
                {editingVideo.youtubeUrl && getYoutubeThumbnail(editingVideo.youtubeUrl) && (
                  <div className="mt-3 relative w-48 aspect-video rounded-lg overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getYoutubeThumbnail(editingVideo.youtubeUrl)!} alt="썸네일" className="w-full h-full object-cover" />
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs flex items-center gap-1">
                      <Youtube size={10} />미리보기
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">제목</label>
                <input type="text" value={editingVideo.title} onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">설명</label>
                <textarea rows={3} value={editingVideo.description} onChange={(e) => setEditingVideo({ ...editingVideo, description: e.target.value })}
                  placeholder="영상에 대한 설명을 입력하세요..."
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">카테고리</label>
                  <select value={editingVideo.category} onChange={(e) => setEditingVideo({ ...editingVideo, category: e.target.value as VideoCategory })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20">
                    {Object.entries(VIDEO_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">강사</label>
                  <input type="text" value={editingVideo.instructor} onChange={(e) => setEditingVideo({ ...editingVideo, instructor: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">재생시간</label>
                  <input type="text" value={editingVideo.duration} onChange={(e) => setEditingVideo({ ...editingVideo, duration: e.target.value })}
                    placeholder="00:00" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editingVideo.featured} onChange={(e) => setEditingVideo({ ...editingVideo, featured: e.target.checked })} className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">추천 영상</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setEditingVideo(null)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={saveVideo} disabled={!editingVideo.title.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50">
                <Save size={16} />{isCreating ? "등록" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
