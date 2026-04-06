"use client";

import { useState, useRef } from "react";
import {
  Plus, Search, Trash2, Filter, X, Upload, Download, Eye, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTIONS, createDoc, removeDoc, updateDocFields } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  getDriveAccessToken,
  findOrCreateFolder,
  uploadFileToDrive,
  shareFilePublic,
  driveDownloadUrl,
  driveViewUrl,
  formatFileSize,
} from "@/lib/google-drive";
import type { Resource } from "@/types/firestore";

type ResourceDoc = Resource & { id: string };

const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: "📄", doc: "📝", xls: "📊", ppt: "📑", zip: "📦",
  image: "🖼️", video: "🎬", default: "📁",
};

function getFileTypeKey(mimeType: string, name: string): string {
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("word") || name.endsWith(".doc") || name.endsWith(".docx")) return "doc";
  if (mimeType.includes("sheet") || mimeType.includes("excel") || name.endsWith(".xls")) return "xls";
  if (mimeType.includes("presentation") || name.endsWith(".ppt")) return "ppt";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "zip";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "default";
}

export default function AdminResourcesPage() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { data: resources, setData: setResources, loading, error, refresh } =
    useFirestoreCollection<ResourceDoc>(COLLECTIONS.RESOURCES);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 업로드 모달
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredResources = resources.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => {
    if (selectedIds.length === filteredResources.length) setSelectedIds([]);
    else setSelectedIds(filteredResources.map((r) => r.id));
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast("파일을 선택해 주세요.", "info"); return; }
    if (!uploadTitle.trim()) { toast("제목을 입력해 주세요.", "info"); return; }

    setUploading(true);
    try {
      // 1. Google Drive 액세스 토큰 취득
      const accessToken = await getDriveAccessToken();

      // 2. AISH 폴더 찾기/생성
      const folderId = await findOrCreateFolder(accessToken);

      // 3. 파일 업로드
      const driveFile = await uploadFileToDrive(accessToken, file, folderId);

      // 4. 공개 공유 설정
      await shareFilePublic(accessToken, driveFile.id);

      // 5. Firestore에 메타데이터 저장
      const typeKey = getFileTypeKey(driveFile.mimeType, driveFile.name);
      const payload: Omit<Resource, "id"> = {
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        fileType: typeKey,
        fileName: driveFile.name,
        fileSize: formatFileSize(driveFile.size || "0"),
        driveFileId: driveFile.id,
        driveDownloadUrl: driveDownloadUrl(driveFile.id),
        driveViewUrl: driveViewUrl(driveFile.id),
        uploaderId: profile?.uid || "",
        uploaderName: profile?.displayName || profile?.name || "",
        uploaderEmail: profile?.email || "",
        downloads: 0,
        tags: uploadTags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      const id = await createDoc(COLLECTIONS.RESOURCES, payload);
      setResources((prev) => [{ id, ...payload }, ...prev]);

      toast("파일이 Google Drive에 업로드되었습니다.", "success");
      closeUploadModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "업로드 실패";
      toast(msg, "error");
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
    setIsUploadOpen(false);
    setUploadTitle("");
    setUploadDesc("");
    setUploadTags("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("정말 삭제하시겠습니까? (Google Drive의 파일은 수동으로 삭제해 주세요.)")) return;
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
    window.open(res.driveDownloadUrl, "_blank");
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">자료실 관리</h1>
          <p className="text-gray-500 mt-1">파일을 업로드하면 Google Drive에 저장됩니다.</p>
        </div>
        <button onClick={() => setIsUploadOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
          <Plus size={18} />자료 업로드
        </button>
      </div>

      {/* Google Drive API 안내 */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 mb-6 text-sm text-amber-900">
        <p className="font-semibold mb-1">Google Drive API 설정 필요</p>
        <ol className="list-decimal ml-4 space-y-0.5 text-xs text-amber-800">
          <li><a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a>에서 <strong>Google Drive API</strong>를 활성화하세요.</li>
          <li>프로젝트: <strong>aish-web-v2</strong> (Firebase와 동일한 GCP 프로젝트)</li>
          <li>OAuth 동의 화면 → 범위에 <strong>drive.file</strong> 스코프가 자동 추가됩니다.</li>
          <li>최초 업로드 시 Google 로그인 팝업에서 &quot;Drive 파일 접근&quot; 권한을 허용하세요.</li>
        </ol>
      </div>

      {/* 검색 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="자료 검색..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
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
                    checked={selectedIds.length === filteredResources.length && filteredResources.length > 0}
                    onChange={toggleAll} className="rounded border-gray-300" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">자료</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">업로더</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">크기</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">다운로드</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredResources.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">등록된 자료가 없습니다.</td></tr>
              ) : filteredResources.map((res) => (
                <tr key={res.id}
                  className={cn("border-b border-gray-50 hover:bg-gray-50/50 transition-colors",
                    selectedIds.includes(res.id) && "bg-primary-50/30")}>
                  <td className="px-4 py-4">
                    <input type="checkbox" checked={selectedIds.includes(res.id)}
                      onChange={() => toggleSelect(res.id)} className="rounded border-gray-300" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{FILE_TYPE_ICONS[res.fileType] ?? FILE_TYPE_ICONS.default}</span>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{res.title}</div>
                        <div className="text-xs text-gray-400">{res.fileName}</div>
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
                    <span className="text-sm text-gray-600">{res.uploaderName || res.uploaderEmail}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-500">{res.fileSize}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-500">{res.downloads}회</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => window.open(res.driveViewUrl, "_blank")}
                        className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="보기">
                        <Eye size={16} />
                      </button>
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

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-4 px-6 py-3 bg-primary-50 border-t border-primary-100">
            <span className="text-sm text-primary-700 font-medium">{selectedIds.length}개 선택됨</span>
            <button onClick={handleBulkDelete} className="text-sm text-red-600 hover:underline">삭제</button>
          </div>
        )}
      </div>

      {/* 업로드 모달 */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeUploadModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">자료 업로드</h2>
              <button onClick={closeUploadModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
                <Upload size={32} className="mx-auto text-gray-300 mb-2" />
                <input ref={fileRef} type="file" className="text-sm file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-primary-100 file:text-primary-700 file:text-sm file:font-medium" />
                <p className="text-xs text-gray-400 mt-2">파일은 Google Drive &quot;AISH 자료실&quot; 폴더에 저장됩니다.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="자료 제목" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)}
                  rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                  placeholder="자료 설명 (선택)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">태그 (쉼표 구분)</label>
                <input type="text" value={uploadTags} onChange={(e) => setUploadTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="예: 교육자료, AI, 세미나" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeUploadModal}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleUpload} disabled={uploading}
                className="px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
                {uploading ? "업로드 중..." : "업로드"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
