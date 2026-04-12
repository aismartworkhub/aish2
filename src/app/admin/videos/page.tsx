"use client";

import { useState } from "react";
import { Plus, Search, Play, Edit, Trash2, X, Save, Star, ExternalLink, Youtube, Filter } from "lucide-react";
import LegacyMigrationBanner from "@/components/admin/LegacyMigrationBanner";
import { cn } from "@/lib/utils";
import { VIDEO_CATEGORY_LABELS } from "@/lib/constants";
import { COLLECTIONS, createDoc, upsertDoc, updateDocFields, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { useToast } from "@/components/ui/Toast";
import YouTubeThumbnailImage from "@/components/ui/YouTubeThumbnailImage";

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

const emptyVideo = (): Omit<Video, "id"> => ({
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
  const { toast } = useToast();
  const { data: videos, setData: setVideos, loading, error, refresh } = useFirestoreCollection<Video>(COLLECTIONS.VIDEOS);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | VideoCategory>("ALL");
  const [editingVideo, setEditingVideo] = useState<(Omit<Video, "id"> & { id?: string }) | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = videos.filter((v) => {
    const matchSearch = !searchQuery || v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.instructor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = categoryFilter === "ALL" || v.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const startCreate = () => { setEditingVideo(emptyVideo()); setIsCreating(true); };
  const startEdit = (v: Video) => { setEditingVideo({ ...v }); setIsCreating(false); };

  const saveVideo = async () => {
    if (!editingVideo || !editingVideo.title.trim()) return;
    setSaving(true);
    try {
      if (isCreating) {
        const id = await createDoc(COLLECTIONS.VIDEOS, editingVideo);
        setVideos((prev) => [{ id, ...editingVideo } as Video, ...prev]);
      } else if (editingVideo.id) {
        await upsertDoc(COLLECTIONS.VIDEOS, editingVideo.id, editingVideo);
        setVideos((prev) => prev.map((v) => v.id === editingVideo.id ? { ...editingVideo } as Video : v));
      }
      setEditingVideo(null);
    } catch (e) {
      console.error(e);
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteVideo = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.VIDEOS, id);
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (e) {
      console.error(e);
      toast("삭제에 실패했습니다.", "error");
    }
  };

  const toggleFeatured = async (id: string) => {
    const video = videos.find((v) => v.id === id);
    if (!video) return;
    const newFeatured = !video.featured;
    try {
      await updateDocFields(COLLECTIONS.VIDEOS, id, { featured: newFeatured });
      setVideos((prev) => prev.map((v) => v.id === id ? { ...v, featured: newFeatured } : v));
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkAdd = async () => {
    const urls = bulkUrls.split("\n").map((u) => u.trim()).filter((u) => u.length > 0);
    if (urls.length === 0) return;
    setSaving(true);
    try {
      const newVideos = await Promise.all(
        urls.map(async (url, i) => {
          const data = {
            title: `새 영상 ${i + 1}`,
            category: "LECTURE" as VideoCategory,
            duration: "00:00",
            instructor: "",
            date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
            featured: false,
            youtubeUrl: url,
            description: "",
          };
          const id = await createDoc(COLLECTIONS.VIDEOS, data);
          return { id, ...data };
        })
      );
      setVideos((prev) => [...newVideos, ...prev]);
      setBulkUrls("");
      setBulkMode(false);
    } catch (e) {
      console.error(e);
      toast("대량 등록에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div>
      <LegacyMigrationBanner legacyName="영상 관리" targetBoardKey="media-lecture" />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">영상 관리</h1>
          <p className="text-gray-500 mt-1">YouTube 영상을 등록하고 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBulkMode(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            <Youtube size={18} />대량 등록
          </button>
          <button onClick={startCreate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
            <Plus size={18} />영상 등록
          </button>
        </div>
      </div>

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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((video) => (
            <div key={video.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center overflow-hidden">
                <>
                  <YouTubeThumbnailImage
                    videoUrl={video.youtubeUrl}
                    alt={video.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center">
                      <Play size={20} className="text-white ml-0.5" fill="white" />
                    </div>
                  </div>
                </>
                <span className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-mono">{video.duration}</span>
                {video.featured && <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-yellow-500 text-white text-xs font-medium">추천</span>}
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
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="py-12 text-center text-gray-400"><Play size={32} className="mx-auto mb-2" /><p className="text-sm">영상이 없습니다.</p></div>
      )}

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
                placeholder={"https://youtu.be/abc123\nhttps://youtube.com/watch?v=def456"}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none font-mono" />
              <p className="text-xs text-gray-500">{bulkUrls.split("\n").filter((u) => u.trim().length > 0).length}개 URL 입력됨</p>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setBulkMode(false)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleBulkAdd} disabled={bulkUrls.trim().length === 0 || saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50">
                <Plus size={16} />{saving ? "등록중..." : "일괄 등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{isCreating ? "영상 등록" : "영상 수정"}</h2>
              <button onClick={() => setEditingVideo(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">YouTube URL</label>
                <div className="flex gap-3">
                  <input type="text" inputMode="url" value={editingVideo.youtubeUrl}
                    onChange={(e) => setEditingVideo({ ...editingVideo, youtubeUrl: e.target.value })}
                    placeholder="https://youtu.be/... 또는 watch?v=... (뒤에 다른 파라미터 있어도 됨)"
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                  {editingVideo.youtubeUrl && (
                    <a href={editingVideo.youtubeUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-2.5 rounded-lg bg-red-50 text-red-600 text-sm hover:bg-red-100 transition-colors shrink-0">
                      <ExternalLink size={14} />열기
                    </a>
                  )}
                </div>
                {editingVideo.youtubeUrl.trim() && (
                  <div className="mt-3 relative w-48 aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-900">
                    <YouTubeThumbnailImage
                      videoUrl={editingVideo.youtubeUrl}
                      alt="썸네일 미리보기"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">제목</label>
                <input type="text" value={editingVideo.title}
                  onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">설명</label>
                <textarea rows={3} value={editingVideo.description}
                  onChange={(e) => setEditingVideo({ ...editingVideo, description: e.target.value })}
                  placeholder="영상에 대한 설명을 입력하세요..."
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">카테고리</label>
                  <select value={editingVideo.category}
                    onChange={(e) => setEditingVideo({ ...editingVideo, category: e.target.value as VideoCategory })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none">
                    {Object.entries(VIDEO_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">강사</label>
                  <input type="text" value={editingVideo.instructor}
                    onChange={(e) => setEditingVideo({ ...editingVideo, instructor: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">재생시간</label>
                  <input type="text" value={editingVideo.duration}
                    onChange={(e) => setEditingVideo({ ...editingVideo, duration: e.target.value })}
                    placeholder="00:00" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editingVideo.featured}
                      onChange={(e) => setEditingVideo({ ...editingVideo, featured: e.target.checked })}
                      className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">추천 영상</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setEditingVideo(null)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={saveVideo} disabled={!editingVideo.title.trim() || saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50">
                <Save size={16} />{saving ? "저장중..." : isCreating ? "등록" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
