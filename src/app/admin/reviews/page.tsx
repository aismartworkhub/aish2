"use client";

import { useState, useMemo } from "react";
import { Star, Trash2, CheckCircle, XCircle, Award, Plus, Pencil, Upload, Search, X, Filter } from "lucide-react";
import { COLLECTIONS, createDoc, upsertDoc, updateDocFields, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";

interface Review {
  id: string;
  authorName: string;
  authorCohort: string;
  content: string;
  rating: number;
  programTitle: string;
  isApproved: boolean;
  isFeatured: boolean;
  date: string;
}

type ModalMode = "create" | "edit" | "bulk" | null;
type FilterStatus = "all" | "approved" | "pending";

const emptyReview: Omit<Review, "id"> = {
  authorName: "",
  authorCohort: "",
  content: "",
  rating: 5,
  programTitle: "",
  isApproved: false,
  isFeatured: false,
  date: new Date().toISOString().split("T")[0],
};

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <button key={i} type="button" onClick={() => onChange(i + 1)} className="focus:outline-none">
          <Star size={20} className={i < value ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-300"} />
        </button>
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const { data: reviews, setData: setReviews, loading, error, refresh } = useFirestoreCollection<Review>(COLLECTIONS.REVIEWS);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formData, setFormData] = useState<Omit<Review, "id">>(emptyReview);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkCsv, setBulkCsv] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterFeatured, setFilterFeatured] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (filterStatus === "approved" && !r.isApproved) return false;
      if (filterStatus === "pending" && r.isApproved) return false;
      if (filterFeatured && !r.isFeatured) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return r.authorName.toLowerCase().includes(q) || r.content.toLowerCase().includes(q) || r.programTitle.toLowerCase().includes(q) || r.authorCohort.toLowerCase().includes(q);
      }
      return true;
    });
  }, [reviews, searchQuery, filterStatus, filterFeatured]);

  const toggleApproval = async (id: string) => {
    const review = reviews.find((r) => r.id === id);
    if (!review) return;
    const newVal = !review.isApproved;
    try {
      await updateDocFields(COLLECTIONS.REVIEWS, id, { isApproved: newVal });
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, isApproved: newVal } : r));
    } catch (e) { console.error(e); }
  };

  const toggleFeatured = async (id: string) => {
    const review = reviews.find((r) => r.id === id);
    if (!review) return;
    const newVal = !review.isFeatured;
    try {
      await updateDocFields(COLLECTIONS.REVIEWS, id, { isFeatured: newVal });
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, isFeatured: newVal } : r));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.REVIEWS, id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { console.error(e); alert("삭제에 실패했습니다."); }
  };

  const openCreate = () => {
    setFormData({ ...emptyReview, date: new Date().toISOString().split("T")[0] });
    setEditingId(null);
    setModalMode("create");
  };

  const openEdit = (review: Review) => {
    const { id, ...rest } = review;
    setFormData(rest);
    setEditingId(id);
    setModalMode("edit");
  };

  const openBulk = () => { setBulkCsv(""); setBulkError(""); setModalMode("bulk"); };

  const closeModal = () => { setModalMode(null); setEditingId(null); setBulkCsv(""); setBulkError(""); };

  const handleFormSubmit = async () => {
    if (!formData.authorName.trim() || !formData.content.trim()) return;
    setSaving(true);
    try {
      if (modalMode === "create") {
        const id = await createDoc(COLLECTIONS.REVIEWS, formData);
        setReviews((prev) => [{ id, ...formData }, ...prev]);
      } else if (modalMode === "edit" && editingId) {
        await upsertDoc(COLLECTIONS.REVIEWS, editingId, formData);
        setReviews((prev) => prev.map((r) => r.id === editingId ? { ...r, ...formData } : r));
      }
      closeModal();
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpload = async () => {
    setBulkError("");
    const lines = bulkCsv.trim().split("\n").filter((l) => l.trim());
    if (lines.length < 2) { setBulkError("CSV에 헤더와 최소 1개의 데이터 행이 필요합니다."); return; }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const requiredFields = ["authorname", "content", "rating"];
    const missing = requiredFields.filter((f) => !header.includes(f));
    if (missing.length > 0) { setBulkError(`필수 열 누락: ${missing.join(", ")}`); return; }

    const newReviews: Omit<Review, "id">[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      if (values.length < header.length) continue;
      const row: Record<string, string> = {};
      header.forEach((h, idx) => { row[h] = values[idx] || ""; });
      const rating = parseInt(row["rating"] || "5", 10);
      newReviews.push({
        authorName: row["authorname"] || "",
        authorCohort: row["authorcohort"] || "",
        content: row["content"] || "",
        rating: isNaN(rating) ? 5 : Math.min(5, Math.max(1, rating)),
        programTitle: row["programtitle"] || "",
        isApproved: (row["isapproved"] || "false").toLowerCase() === "true",
        isFeatured: (row["isfeatured"] || "false").toLowerCase() === "true",
        date: row["date"] || new Date().toISOString().split("T")[0],
      });
    }

    if (newReviews.length === 0) { setBulkError("유효한 데이터 행을 찾을 수 없습니다."); return; }

    setSaving(true);
    try {
      const created = await Promise.all(newReviews.map(async (r) => {
        const id = await createDoc(COLLECTIONS.REVIEWS, r);
        return { id, ...r };
      }));
      setReviews((prev) => [...created, ...prev]);
      closeModal();
    } catch (e) {
      console.error(e);
      setBulkError("일괄 업로드에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">후기 관리</h1>
          <p className="text-gray-500 mt-1">수강 후기를 승인/관리합니다. 총 {reviews.length}건</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openBulk} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            <Upload size={16} />일괄 업로드
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 transition">
            <Plus size={16} />새 후기
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="이름, 내용, 과정명으로 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20" />
            {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none">
              <option value="all">전체 상태</option>
              <option value="approved">승인됨</option>
              <option value="pending">미승인</option>
            </select>
            <button onClick={() => setFilterFeatured(!filterFeatured)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border transition ${filterFeatured ? "border-yellow-300 bg-yellow-50 text-yellow-700" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}>
              <Award size={14} />추천만
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredReviews.map((review) => (
          <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900">{review.authorName}</p>
                <p className="text-xs text-gray-400">{review.authorCohort} &middot; {review.programTitle}</p>
                <p className="text-xs text-gray-300 mt-0.5">{review.date}</p>
              </div>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={14} className={i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} />
                ))}
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">{review.content}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleApproval(review.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${review.isApproved ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {review.isApproved ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {review.isApproved ? "승인됨" : "미승인"}
              </button>
              <button onClick={() => toggleFeatured(review.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${review.isFeatured ? "bg-yellow-50 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                <Award size={14} />{review.isFeatured ? "추천" : "일반"}
              </button>
              <button onClick={() => openEdit(review)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Pencil size={14} /></button>
              <button onClick={() => handleDelete(review.id)} className="ml-auto p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {filteredReviews.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">조건에 맞는 후기가 없습니다.</div>
        )}
      </div>

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {(modalMode === "create" || modalMode === "edit") && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-gray-900">{modalMode === "create" ? "새 후기 작성" : "후기 수정"}</h2>
                  <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={20} /></button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">작성자 이름 *</label>
                      <input type="text" value={formData.authorName} onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20" placeholder="김○○" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">기수</label>
                      <input type="text" value={formData.authorCohort} onChange={(e) => setFormData({ ...formData, authorCohort: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20" placeholder="10기 수강생" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">과정명</label>
                    <input type="text" value={formData.programTitle} onChange={(e) => setFormData({ ...formData, programTitle: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" placeholder="AI 기초 정규과정 10기" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">후기 내용 *</label>
                    <textarea value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 resize-none" placeholder="수강 후기를 입력하세요." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">평점</label>
                      <StarPicker value={formData.rating} onChange={(v) => setFormData({ ...formData, rating: v })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                      <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={formData.isApproved} onChange={(e) => setFormData({ ...formData, isApproved: e.target.checked })} className="rounded border-gray-300" />승인
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={formData.isFeatured} onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })} className="rounded border-gray-300" />추천
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">취소</button>
                  <button onClick={handleFormSubmit} disabled={!formData.authorName.trim() || !formData.content.trim() || saving}
                    className="px-4 py-2 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    {saving ? "저장중..." : modalMode === "create" ? "등록" : "저장"}
                  </button>
                </div>
              </div>
            )}

            {modalMode === "bulk" && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-gray-900">일괄 업로드 (CSV)</h2>
                  <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={20} /></button>
                </div>
                <p className="text-sm text-gray-500 mb-2">CSV 형식의 텍스트를 붙여넣기 하세요. 첫 번째 행은 헤더여야 합니다.</p>
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <p className="text-xs text-gray-500 font-mono">필수 열: authorName, content, rating</p>
                  <p className="text-xs text-gray-400 font-mono mt-1">선택 열: authorCohort, programTitle, isApproved, isFeatured, date</p>
                </div>
                <textarea value={bulkCsv} onChange={(e) => setBulkCsv(e.target.value)} rows={8}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-600/20 resize-none"
                  placeholder="CSV 텍스트를 여기에 붙여넣기..." />
                {bulkError && <p className="text-sm text-red-500 mt-2">{bulkError}</p>}
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">취소</button>
                  <button onClick={handleBulkUpload} disabled={!bulkCsv.trim() || saving}
                    className="px-4 py-2 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    {saving ? "업로드중..." : "업로드"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
