"use client";

import { useState } from "react";
import {
  Plus, Search, Edit, Trash2, X, Save, Download, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTIONS, createDoc, upsertDoc, updateDocFields, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/contexts/AuthContext";
import DriveFileUploader from "@/components/admin/DriveFileUploader";
import type { Resource, DriveAttachment } from "@/types/firestore";

type ResourceDoc = Resource & { id: string };

const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: "📄", doc: "📝", xls: "📊", ppt: "📑", zip: "📦",
  image: "🖼️", video: "🎬", drive: "💾", default: "📁",
};

interface ResourceForm {
  title: string;
  description: string;
  tags: string;
  author: string;
  attachments: DriveAttachment[];
}

const emptyForm = (authorName: string): ResourceForm => ({
  title: "",
  description: "",
  tags: "",
  author: authorName || "관리자",
  attachments: [],
});

function formFromResource(r: ResourceDoc): ResourceForm {
  const att: DriveAttachment[] = r.driveFileId
    ? [{
        name: r.fileName,
        url: r.driveDownloadUrl,
        size: r.fileSize,
        type: "drive",
        driveFileId: r.driveFileId,
        driveDownloadUrl: r.driveDownloadUrl,
        driveViewUrl: r.driveViewUrl,
      }]
    : [];
  return {
    title: r.title,
    description: r.description || r.content || "",
    tags: r.tags.join(", "),
    author: r.author || r.uploaderName || "",
    attachments: att,
  };
}

export default function AdminResourcesPage() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { data: resources, setData: setResources, loading, error, refresh } =
    useFirestoreCollection<ResourceDoc>(COLLECTIONS.RESOURCES);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 모달
  const [editingResource, setEditingResource] = useState<ResourceForm & { id?: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = resources.filter((r) =>
    !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map((r) => r.id));
  };

  const openCreateModal = () => {
    setIsCreating(true);
    setEditingResource(emptyForm(profile?.displayName || profile?.name || ""));
  };
  const openEditModal = (r: ResourceDoc) => {
    setIsCreating(false);
    setEditingResource({ ...formFromResource(r), id: r.id });
  };

  const saveResource = async () => {
    if (!editingResource || !editingResource.title.trim()) {
      toast("제목을 입력해 주세요.", "info");
      return;
    }
    setSaving(true);
    try {
      const att = editingResource.attachments[0];
      const tagsArray = editingResource.tags.split(",").map((t) => t.trim()).filter(Boolean);

      const payload: Omit<Resource, "id"> = {
        title: editingResource.title,
        description: editingResource.description,
        content: editingResource.description,
        author: editingResource.author,
        fileType: att?.type === "drive" ? "drive" : "link",
        fileName: att?.name || "",
        fileSize: att?.size || "",
        driveFileId: att?.driveFileId || "",
        driveDownloadUrl: att?.driveDownloadUrl || att?.url || "",
        driveViewUrl: att?.driveViewUrl || "",
        uploaderId: profile?.uid || "",
        uploaderName: editingResource.author || profile?.displayName || "",
        uploaderEmail: profile?.email || "",
        downloads: 0,
        tags: tagsArray,
      };

      if (isCreating) {
        const id = await createDoc(COLLECTIONS.RESOURCES, payload);
        setResources((prev) => [{ id, ...payload }, ...prev]);
      } else if (editingResource.id) {
        const existing = resources.find((r) => r.id === editingResource.id);
        await upsertDoc(COLLECTIONS.RESOURCES, editingResource.id, {
          ...payload,
          downloads: existing?.downloads ?? 0,
          uploaderId: existing?.uploaderId ?? payload.uploaderId,
          uploaderEmail: existing?.uploaderEmail ?? payload.uploaderEmail,
        });
        setResources((prev) => prev.map((r) =>
          r.id === editingResource.id ? { ...r, ...payload, downloads: existing?.downloads ?? 0 } : r
        ));
      }
      setEditingResource(null);
      toast(isCreating ? "자료가 등록되었습니다." : "자료가 수정되었습니다.", "success");
    } catch {
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.RESOURCES, id);
      setResources((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch {
      toast("삭제에 실패했습니다.", "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`선택된 ${selectedIds.length}개를 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(selectedIds.map((id) => removeDoc(COLLECTIONS.RESOURCES, id)));
      setResources((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
      setSelectedIds([]);
    } catch {
      toast("삭제에 실패했습니다.", "error");
    }
  };

  const handleDownloadCount = async (res: ResourceDoc) => {
    await updateDocFields(COLLECTIONS.RESOURCES, res.id, { downloads: (res.downloads || 0) + 1 });
    setResources((prev) => prev.map((r) => r.id === res.id ? { ...r, downloads: (r.downloads || 0) + 1 } : r));
    window.open(res.driveDownloadUrl || res.driveViewUrl, "_blank");
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">교육자료 관리</h1>
          <p className="text-gray-500 mt-1">파일을 업로드하면 Google Drive에 저장됩니다.</p>
        </div>
        <button onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
          <Plus size={18} />새 자료 등록
        </button>
      </div>

      {/* 검색 + 일괄삭제 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="자료 검색..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
          </div>
          {selectedIds.length > 0 && (
            <button onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-600 border border-red-200 hover:bg-red-50 transition-colors">
              <Trash2 size={14} />{selectedIds.length}개 삭제
            </button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left">
                  <input type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={toggleAll} className="rounded border-gray-300" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">자료</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">작성자</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">크기</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">다운로드</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">등록된 자료가 없습니다.</td></tr>
              ) : filtered.map((res) => (
                <tr key={res.id}
                  className={cn("border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer",
                    selectedIds.includes(res.id) && "bg-primary-50/30")}
                  onClick={() => openEditModal(res)}>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(res.id)}
                      onChange={() => toggleSelect(res.id)} className="rounded border-gray-300" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{FILE_TYPE_ICONS[res.fileType] ?? FILE_TYPE_ICONS.default}</span>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{res.title}</div>
                        {res.fileName && <div className="text-xs text-gray-400">{res.fileName}</div>}
                        {res.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {res.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600">{res.author || res.uploaderName}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-500">{res.fileSize || "-"}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-500">{res.downloads}회</span>
                  </td>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditModal(res)}
                        className="p-2 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors" title="수정">
                        <Edit size={16} />
                      </button>
                      {res.driveViewUrl && (
                        <button onClick={() => window.open(res.driveViewUrl, "_blank")}
                          className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="보기">
                          <Eye size={16} />
                        </button>
                      )}
                      <button onClick={() => handleDownloadCount(res)}
                        className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors" title="다운로드">
                        <Download size={16} />
                      </button>
                      <button onClick={() => handleDelete(res.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title="삭제">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 등록/수정 모달 */}
      {editingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingResource(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{isCreating ? "새 자료 등록" : "자료 수정"}</h2>
              <button onClick={() => setEditingResource(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input type="text" value={editingResource.title}
                  onChange={(e) => setEditingResource({ ...editingResource, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="자료 제목" />
              </div>
              {/* 작성자 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">작성자</label>
                <input type="text" value={editingResource.author}
                  onChange={(e) => setEditingResource({ ...editingResource, author: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="작성자" />
              </div>
              {/* 설명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea value={editingResource.description}
                  onChange={(e) => setEditingResource({ ...editingResource, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                  placeholder="자료 설명" />
              </div>
              {/* 태그 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">태그 (쉼표 구분)</label>
                <input type="text" value={editingResource.tags}
                  onChange={(e) => setEditingResource({ ...editingResource, tags: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="예: 교육자료, AI, 세미나" />
              </div>
              {/* 첨부파일 (Drive) */}
              <DriveFileUploader
                attachments={editingResource.attachments}
                onChange={(atts) => setEditingResource({ ...editingResource, attachments: atts })}
                maxFiles={3}
                maxFileSizeMB={500}
                allowLinks
              />
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setEditingResource(null)}
                className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={saveResource} disabled={!editingResource.title.trim() || saving}
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
