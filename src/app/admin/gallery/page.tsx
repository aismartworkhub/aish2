"use client";

import { useState } from "react";
import { ImageIcon, Plus, Trash2, Edit, X, Save, Search, FolderOpen, ExternalLink, Grid, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DriveOrExternalImage from "@/components/ui/DriveOrExternalImage";
import { COLLECTIONS, createDoc, upsertDoc, removeDoc, getSingletonDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import LegacyMigrationBanner from "@/components/admin/LegacyMigrationBanner";
import { useToast } from "@/components/ui/Toast";

type PhotoCategory = "교육" | "워크톤" | "행사" | "기타";

const CATEGORIES: PhotoCategory[] = ["교육", "워크톤", "행사", "기타"];

const CATEGORY_STYLES: Record<PhotoCategory, string> = {
  교육: "bg-blue-100 text-blue-700",
  워크톤: "bg-purple-100 text-purple-700",
  행사: "bg-green-100 text-green-700",
  기타: "bg-gray-100 text-gray-700",
};

interface Photo {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: PhotoCategory;
  date: string;
  googleDriveId?: string;
}

const emptyPhoto = (): Omit<Photo, "id"> => ({
  title: "",
  description: "",
  imageUrl: "",
  category: "기타",
  date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
  googleDriveId: "",
});

export default function AdminGalleryPage() {
  const { toast } = useToast();
  const { data: photos, setData: setPhotos, loading, error, refresh } = useFirestoreCollection<Photo>(COLLECTIONS.GALLERY);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<PhotoCategory | "전체">("전체");
  const [editingPhoto, setEditingPhoto] = useState<(Omit<Photo, "id"> & { id?: string }) | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [driveFolderId, setDriveFolderId] = useState("");
  const [driveApiKey, setDriveApiKey] = useState("");
  const [driveCategory, setDriveCategory] = useState<PhotoCategory>("기타");
  const [showDriveSection, setShowDriveSection] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveResult, setDriveResult] = useState<{ success: number; failed: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = photos.filter((p) => {
    const matchesSearch = !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "전체" || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const startCreate = () => { setEditingPhoto(emptyPhoto()); setIsCreating(true); };
  const startEdit = (p: Photo) => { setEditingPhoto({ ...p }); setIsCreating(false); };

  const savePhoto = async () => {
    if (!editingPhoto || !editingPhoto.title.trim() || !editingPhoto.imageUrl.trim()) return;
    setSaving(true);
    try {
      const cleaned = { ...editingPhoto, googleDriveId: editingPhoto.googleDriveId?.trim() || "" };
      if (isCreating) {
        const id = await createDoc(COLLECTIONS.GALLERY, cleaned);
        setPhotos((prev) => [{ id, ...cleaned } as Photo, ...prev]);
      } else if (editingPhoto.id) {
        await upsertDoc(COLLECTIONS.GALLERY, editingPhoto.id, cleaned);
        setPhotos((prev) => prev.map((p) => p.id === editingPhoto.id ? { ...cleaned, id: editingPhoto.id } as Photo : p));
      }
      setEditingPhoto(null);
    } catch (e) {
      console.error(e);
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const deletePhoto = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.GALLERY, id);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error(e);
      toast("삭제에 실패했습니다.", "error");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((p) => p.id)));
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개의 사진을 삭제하시겠습니까?`)) return;
    try {
      await Promise.all([...selectedIds].map((id) => removeDoc(COLLECTIONS.GALLERY, id)));
      setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
      toast("삭제에 실패했습니다.", "error");
    }
  };

  const importFromDrive = async () => {
    if (!driveFolderId.trim()) return;
    let apiKey = driveApiKey.trim();
    if (!apiKey) {
      // 설정에서 API 키 가져오기 시도
      try {
        const settings = await getSingletonDoc<{ googleDriveApiKey?: string }>(COLLECTIONS.SETTINGS, "general");
        apiKey = settings?.googleDriveApiKey || "";
      } catch { /* ignore */ }
    }
    if (!apiKey) {
      toast("Google API 키를 입력하거나 설정 페이지에서 등록해 주세요.", "info");
      return;
    }
    setDriveLoading(true);
    setDriveResult(null);
    try {
      const url = `https://www.googleapis.com/drive/v3/files?q='${driveFolderId.trim()}'+in+parents+and+mimeType+contains+'image/'&fields=files(id,name)&key=${apiKey}&pageSize=50`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API 오류: ${res.status}`);
      const data = await res.json();
      const files: { id: string; name: string }[] = data.files || [];
      if (files.length === 0) { toast("폴더에 이미지가 없습니다.", "info"); setDriveLoading(false); return; }
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
      let success = 0;
      for (const file of files) {
        try {
          const imageUrl = `https://lh3.googleusercontent.com/d/${file.id}`;
          const newPhoto: Omit<Photo, "id"> = {
            title: file.name.replace(/\.[^/.]+$/, ""),
            description: "",
            imageUrl,
            category: driveCategory,
            date: today,
            googleDriveId: file.id,
          };
          const id = await createDoc(COLLECTIONS.GALLERY, newPhoto);
          setPhotos((prev) => [{ id, ...newPhoto } as Photo, ...prev]);
          success++;
        } catch { /* skip */ }
      }
      setDriveResult({ success, failed: files.length - success });
    } catch (e) {
      console.error(e);
      toast("Google Drive 연동에 실패했습니다. API 키와 폴더 ID를 확인해 주세요.", "error");
    } finally {
      setDriveLoading(false);
    }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div>
      <LegacyMigrationBanner legacyName="갤러리" targetBoardKey="media-gallery" />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">갤러리 관리</h1>
          <p className="text-gray-500 mt-1">사진을 등록하고 관리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowDriveSection(!showDriveSection)}
            className={cn("inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors",
              showDriveSection ? "bg-primary-50 border-primary-200 text-primary-700" : "border-gray-200 text-gray-600 hover:bg-gray-50")}>
            <FolderOpen size={18} />Google Drive
          </button>
          <button onClick={startCreate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
            <Plus size={18} />사진 등록
          </button>
        </div>
      </div>

      {showDriveSection && (
        <div className="mb-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-50"><FolderOpen size={24} className="text-blue-600" /></div>
            <div className="flex-1 space-y-3">
              <h3 className="font-semibold text-gray-900">Google Drive 폴더 일괄 가져오기</h3>
              <p className="text-sm text-gray-500">Google Drive 폴더의 이미지를 한번에 갤러리로 가져옵니다. 폴더는 &quot;링크가 있는 모든 사용자&quot;로 공유해야 합니다.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">폴더 ID *</label>
                  <input type="text" placeholder="Google Drive 폴더 URL 또는 ID" value={driveFolderId} onChange={(e) => {
                    const val = e.target.value.trim();
                    const match = val.match(/folders\/([a-zA-Z0-9_-]+)/);
                    setDriveFolderId(match ? match[1] : val);
                  }}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Google API 키 (설정에 저장 시 생략 가능)</label>
                  <input type="text" placeholder="AIza..." value={driveApiKey} onChange={(e) => setDriveApiKey(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select value={driveCategory} onChange={(e) => setDriveCategory(e.target.value as PhotoCategory)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={importFromDrive} disabled={!driveFolderId.trim() || driveLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {driveLoading ? <><Loader2 size={16} className="animate-spin" />가져오는 중...</> : <><Upload size={16} />일괄 가져오기</>}
                </button>
              </div>
              {driveResult && (
                <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                  {driveResult.success}장 가져오기 완료{driveResult.failed > 0 && ` (${driveResult.failed}장 실패)`}
                </div>
              )}
              <p className="text-xs text-gray-400">폴더 URL 예: https://drive.google.com/drive/folders/1ABC... → 폴더 ID: 1ABC...</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="사진 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
        </div>
        <div className="flex items-center gap-1.5 bg-white rounded-lg border border-gray-200 p-1">
          {(["전체", ...CATEGORIES] as const).map((cat) => (
            <button key={cat} onClick={() => setFilterCategory(cat)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                filterCategory === cat ? "bg-primary-600 text-white" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50")}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
              <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300" />
              전체 선택 ({selectedIds.size}/{filtered.length})
            </label>
            {selectedIds.size > 0 && (
              <button onClick={bulkDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors">
                <Trash2 size={14} />선택 삭제 ({selectedIds.size})
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-gray-400"><Grid size={16} /><span className="text-xs">{filtered.length}개의 사진</span></div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((photo) => (
          <div key={photo.id} className={cn("bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow group",
            selectedIds.has(photo.id) ? "border-primary-400 ring-2 ring-primary-100" : "border-gray-100")}>
            <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
              {photo.imageUrl ? (
                <DriveOrExternalImage
                  src={photo.imageUrl}
                  alt={photo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  quiet
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><ImageIcon size={32} className="text-gray-300" /></div>
              )}
              <div className="absolute top-2 left-2">
                <input type="checkbox" checked={selectedIds.has(photo.id)} onChange={() => toggleSelect(photo.id)}
                  className="w-5 h-5 rounded border-2 border-white/80 bg-white/60 backdrop-blur-sm cursor-pointer" />
              </div>
              <span className={cn("absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full backdrop-blur-sm", CATEGORY_STYLES[photo.category])}>
                {photo.category}
              </span>
              {photo.googleDriveId && (
                <span className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-white/80 backdrop-blur-sm" title="Google Drive 연동됨">
                  <FolderOpen size={14} className="text-blue-600" />
                </span>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{photo.title}</h3>
              {photo.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{photo.description}</p>}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">{photo.date}</span>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(photo)} className="p-1.5 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors"><Edit size={14} /></button>
                  <button onClick={() => deletePhoto(photo.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-gray-400"><ImageIcon size={32} className="mx-auto mb-2" /><p className="text-sm">사진이 없습니다.</p></div>
      )}

      {editingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{isCreating ? "사진 등록" : "사진 수정"}</h2>
              <button onClick={() => setEditingPhoto(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">이미지 URL</label>
                <input type="text" inputMode="url" value={editingPhoto.imageUrl} onChange={(e) => setEditingPhoto({ ...editingPhoto, imageUrl: e.target.value })}
                  placeholder="https://… 또는 Drive 공유 링크"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <div>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
                  <p className="text-xs text-gray-500">이미지 URL을 위 필드에 입력하세요.</p>
                  <div className="mt-1.5 space-y-1 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                    <p className="font-medium">⚠ Google Drive 공유 설정 필수</p>
                    <p>비회원도 이미지를 볼 수 있으려면 <strong>&quot;링크가 있는 모든 사용자&quot;</strong>로 공유해야 합니다.</p>
                    <p className="text-amber-600">파일 우클릭 → 공유 → 일반 액세스 → &quot;링크가 있는 모든 사용자&quot;</p>
                  </div>
                </div>
              </div>
              {editingPhoto.imageUrl.trim() && (
                <div className="rounded-lg overflow-hidden border border-gray-100 min-h-[160px]">
                  <DriveOrExternalImage
                    src={editingPhoto.imageUrl}
                    alt="미리보기"
                    className="w-full h-40 object-cover"
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">제목</label>
                <input type="text" value={editingPhoto.title} onChange={(e) => setEditingPhoto({ ...editingPhoto, title: e.target.value })}
                  placeholder="사진 제목" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">설명</label>
                <textarea value={editingPhoto.description} onChange={(e) => setEditingPhoto({ ...editingPhoto, description: e.target.value })}
                  placeholder="사진에 대한 설명을 입력하세요" rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">카테고리</label>
                  <select value={editingPhoto.category} onChange={(e) => setEditingPhoto({ ...editingPhoto, category: e.target.value as PhotoCategory })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none">
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">날짜</label>
                  <input type="text" value={editingPhoto.date} onChange={(e) => setEditingPhoto({ ...editingPhoto, date: e.target.value })}
                    placeholder="2026.03.20" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Google Drive 파일 ID <span className="text-gray-400 font-normal">(선택)</span></label>
                <input type="text" value={editingPhoto.googleDriveId || ""} onChange={(e) => setEditingPhoto({ ...editingPhoto, googleDriveId: e.target.value })}
                  placeholder="Google Drive 파일 ID" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setEditingPhoto(null)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={savePhoto} disabled={!editingPhoto.title.trim() || !editingPhoto.imageUrl.trim() || saving}
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
