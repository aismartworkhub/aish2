"use client";

import { useState } from "react";
import {
  ImageIcon,
  Plus,
  Trash2,
  Edit,
  X,
  Save,
  Search,
  FolderOpen,
  ExternalLink,
  Grid,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const INITIAL_PHOTOS: Photo[] = [
  {
    id: "p1",
    title: "AI 기초 교육 현장",
    description: "2026년 3월 AI 기초 교육 수업 장면입니다.",
    imageUrl: "https://placehold.co/600x400/e2e8f0/64748b?text=AI+교육",
    category: "교육",
    date: "2026.03.15",
  },
  {
    id: "p2",
    title: "제4회 스마트워크톤",
    description: "스마트워크톤 참가자 단체 사진",
    imageUrl: "https://placehold.co/600x400/ede9fe/7c3aed?text=워크톤",
    category: "워크톤",
    date: "2026.03.10",
    googleDriveId: "1aBcDeFgHiJkLmNoPqRsT",
  },
  {
    id: "p3",
    title: "2026 봄 세미나",
    description: "봄 세미나 행사 전경",
    imageUrl: "https://placehold.co/600x400/dcfce7/16a34a?text=세미나",
    category: "행사",
    date: "2026.03.05",
  },
  {
    id: "p4",
    title: "프롬프트 엔지니어링 워크숍",
    description: "실습 중인 참가자들",
    imageUrl: "https://placehold.co/600x400/fef3c7/d97706?text=워크숍",
    category: "교육",
    date: "2026.02.28",
  },
  {
    id: "p5",
    title: "팀 빌딩 행사",
    description: "연말 팀 빌딩 행사 사진",
    imageUrl: "https://placehold.co/600x400/fce7f3/db2777?text=팀빌딩",
    category: "기타",
    date: "2026.02.20",
  },
];

const emptyPhoto = (): Photo => ({
  id: `p-${Date.now()}`,
  title: "",
  description: "",
  imageUrl: "",
  category: "기타",
  date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
  googleDriveId: "",
});

export default function AdminGalleryPage() {
  const [photos, setPhotos] = useState<Photo[]>(INITIAL_PHOTOS);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<PhotoCategory | "전체">("전체");
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [driveFolderId, setDriveFolderId] = useState("");
  const [showDriveSection, setShowDriveSection] = useState(false);

  const filtered = photos.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "전체" || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const startCreate = () => {
    setEditingPhoto(emptyPhoto());
    setIsCreating(true);
  };

  const startEdit = (p: Photo) => {
    setEditingPhoto({ ...p });
    setIsCreating(false);
  };

  const savePhoto = () => {
    if (!editingPhoto || !editingPhoto.title.trim() || !editingPhoto.imageUrl.trim()) return;
    const cleaned = {
      ...editingPhoto,
      googleDriveId: editingPhoto.googleDriveId?.trim() || undefined,
    };
    if (isCreating) {
      setPhotos((prev) => [cleaned, ...prev]);
    } else {
      setPhotos((prev) => prev.map((p) => (p.id === cleaned.id ? cleaned : p)));
    }
    setEditingPhoto(null);
  };

  const deletePhoto = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) setPhotos((prev) => prev.filter((p) => p.id !== id));
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
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`선택한 ${selectedIds.size}개의 사진을 삭제하시겠습니까?`)) {
      setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    }
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">갤러리 관리</h1>
          <p className="text-gray-500 mt-1">사진을 등록하고 관리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDriveSection(!showDriveSection)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors",
              showDriveSection
                ? "bg-primary-50 border-primary-200 text-primary-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            <FolderOpen size={18} />
            Google Drive
          </button>
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            <Plus size={18} />
            사진 등록
          </button>
        </div>
      </div>

      {/* Google Drive 연동 섹션 */}
      {showDriveSection && (
        <div className="mb-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-50">
              <FolderOpen size={24} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Google Drive 폴더 연동</h3>
              <p className="text-sm text-gray-500 mt-1">
                Google Drive 폴더 ID를 입력하면 해당 폴더의 이미지를 자동으로 가져올 수 있습니다.
              </p>
              <div className="flex gap-3 mt-4">
                <input
                  type="text"
                  placeholder="Google Drive 폴더 ID를 입력하세요"
                  value={driveFolderId}
                  onChange={(e) => setDriveFolderId(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <button
                  disabled={!driveFolderId.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <ExternalLink size={16} />
                  연동
                </button>
              </div>
              <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                설정 페이지에서 Google API 키를 먼저 등록해야 동기화가 작동합니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 검색 & 필터 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="사진 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-white rounded-lg border border-gray-200 p-1">
          {(["전체", ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                filterCategory === cat
                  ? "bg-primary-600 text-white"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 벌크 액션 바 */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
              <input
                type="checkbox"
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-gray-300"
              />
              전체 선택 ({selectedIds.size}/{filtered.length})
            </label>
            {selectedIds.size > 0 && (
              <button
                onClick={bulkDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
              >
                <Trash2 size={14} />
                선택 삭제 ({selectedIds.size})
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Grid size={16} />
            <span className="text-xs">{filtered.length}개의 사진</span>
          </div>
        </div>
      )}

      {/* 갤러리 그리드 */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((photo) => (
          <div
            key={photo.id}
            className={cn(
              "bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow group",
              selectedIds.has(photo.id) ? "border-primary-400 ring-2 ring-primary-100" : "border-gray-100"
            )}
          >
            {/* 이미지 영역 */}
            <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
              {photo.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.imageUrl}
                  alt={photo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={32} className="text-gray-300" />
                </div>
              )}
              {/* 체크박스 오버레이 */}
              <div className="absolute top-2 left-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(photo.id)}
                  onChange={() => toggleSelect(photo.id)}
                  className="w-5 h-5 rounded border-2 border-white/80 bg-white/60 backdrop-blur-sm cursor-pointer"
                />
              </div>
              {/* 카테고리 뱃지 */}
              <span
                className={cn(
                  "absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full backdrop-blur-sm",
                  CATEGORY_STYLES[photo.category]
                )}
              >
                {photo.category}
              </span>
              {/* Google Drive 아이콘 */}
              {photo.googleDriveId && (
                <span className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-white/80 backdrop-blur-sm" title="Google Drive 연동됨">
                  <FolderOpen size={14} className="text-blue-600" />
                </span>
              )}
            </div>
            {/* 정보 영역 */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{photo.title}</h3>
              {photo.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{photo.description}</p>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">{photo.date}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(photo)}
                    className="p-1.5 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => deletePhoto(photo.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 빈 상태 */}
      {filtered.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          <ImageIcon size={32} className="mx-auto mb-2" />
          <p className="text-sm">사진이 없습니다.</p>
        </div>
      )}

      {/* 생성/수정 모달 */}
      {editingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {isCreating ? "사진 등록" : "사진 수정"}
              </h2>
              <button
                onClick={() => setEditingPhoto(null)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* 이미지 URL */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">이미지 URL</label>
                <input
                  type="url"
                  value={editingPhoto.imageUrl}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              {/* 파일 업로드 placeholder */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">파일 업로드</label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-primary-300 transition-colors cursor-pointer">
                  <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">클릭하여 이미지를 업로드하세요</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP (최대 5MB)</p>
                </div>
              </div>

              {/* 이미지 미리보기 */}
              {editingPhoto.imageUrl && (
                <div className="rounded-lg overflow-hidden border border-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editingPhoto.imageUrl}
                    alt="미리보기"
                    className="w-full h-40 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}

              {/* 제목 */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">제목</label>
                <input
                  type="text"
                  value={editingPhoto.title}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, title: e.target.value })}
                  placeholder="사진 제목"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              {/* 설명 */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">설명</label>
                <textarea
                  value={editingPhoto.description}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, description: e.target.value })}
                  placeholder="사진에 대한 설명을 입력하세요"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                />
              </div>

              {/* 카테고리 & 날짜 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">카테고리</label>
                  <select
                    value={editingPhoto.category}
                    onChange={(e) =>
                      setEditingPhoto({ ...editingPhoto, category: e.target.value as PhotoCategory })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">날짜</label>
                  <input
                    type="text"
                    value={editingPhoto.date}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, date: e.target.value })}
                    placeholder="2026.03.20"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>

              {/* Google Drive ID */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Google Drive 파일 ID{" "}
                  <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <input
                  type="text"
                  value={editingPhoto.googleDriveId || ""}
                  onChange={(e) =>
                    setEditingPhoto({ ...editingPhoto, googleDriveId: e.target.value })
                  }
                  placeholder="Google Drive 파일 ID"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </div>

            {/* 모달 하단 버튼 */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setEditingPhoto(null)}
                className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={savePhoto}
                disabled={!editingPhoto.title.trim() || !editingPhoto.imageUrl.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {isCreating ? "등록" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
