"use client";

import { useState, useMemo } from "react";
import {
  Star,
  Trash2,
  CheckCircle,
  XCircle,
  Award,
  Plus,
  Pencil,
  Upload,
  Search,
  X,
  Filter,
} from "lucide-react";

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

const initialReviews: Review[] = [
  {
    id: "1",
    authorName: "김○○",
    authorCohort: "10기 수강생",
    content:
      "AI가 막연히 어렵게만 느껴졌는데, AISH 과정을 통해 자신감을 얻었습니다.",
    rating: 5,
    programTitle: "AI 기초 정규과정 10기",
    isApproved: true,
    isFeatured: true,
    date: "2025-12-01",
  },
  {
    id: "2",
    authorName: "이○○",
    authorCohort: "9기 수강생",
    content:
      "강사님들의 열정이 대단합니다. 질문에 항상 친절하게 답변해 주셔서 초보자도 따라갈 수 있었습니다.",
    rating: 5,
    programTitle: "AI 기초 정규과정 9기",
    isApproved: true,
    isFeatured: false,
    date: "2025-11-15",
  },
  {
    id: "3",
    authorName: "박○○",
    authorCohort: "데이터분석 2기",
    content: "실무에서 바로 쓸 수 있는 기술을 배웠습니다.",
    rating: 4,
    programTitle: "데이터분석 실무 2기",
    isApproved: false,
    isFeatured: false,
    date: "2025-11-10",
  },
  {
    id: "4",
    authorName: "최○○",
    authorCohort: "10기 수강생",
    content: "무료 과정인데도 이렇게 퀄리티가 높다니 놀랍습니다.",
    rating: 5,
    programTitle: "AI 기초 정규과정 10기",
    isApproved: true,
    isFeatured: false,
    date: "2025-10-20",
  },
];

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

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formData, setFormData] = useState<Omit<Review, "id">>(emptyReview);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkCsv, setBulkCsv] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterFeatured, setFilterFeatured] = useState(false);

  // --- Filtering & Search ---
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (filterStatus === "approved" && !r.isApproved) return false;
      if (filterStatus === "pending" && r.isApproved) return false;
      if (filterFeatured && !r.isFeatured) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.authorName.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          r.programTitle.toLowerCase().includes(q) ||
          r.authorCohort.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reviews, searchQuery, filterStatus, filterFeatured]);

  // --- CRUD ---
  const toggleApproval = (id: string) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isApproved: !r.isApproved } : r))
    );
  };

  const toggleFeatured = (id: string) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isFeatured: !r.isFeatured } : r))
    );
  };

  const handleDelete = (id: string) => {
    if (confirm("삭제하시겠습니까?")) {
      setReviews((prev) => prev.filter((r) => r.id !== id));
    }
  };

  // --- Modal open helpers ---
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

  const openBulk = () => {
    setBulkCsv("");
    setBulkError("");
    setModalMode("bulk");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
    setBulkCsv("");
    setBulkError("");
  };

  // --- Form submit ---
  const handleFormSubmit = () => {
    if (!formData.authorName.trim() || !formData.content.trim()) return;
    if (modalMode === "create") {
      setReviews((prev) => [{ id: generateId(), ...formData }, ...prev]);
    } else if (modalMode === "edit" && editingId) {
      setReviews((prev) =>
        prev.map((r) => (r.id === editingId ? { ...r, ...formData } : r))
      );
    }
    closeModal();
  };

  // --- Bulk CSV parsing ---
  const handleBulkUpload = () => {
    setBulkError("");
    const lines = bulkCsv
      .trim()
      .split("\n")
      .filter((l) => l.trim());
    if (lines.length < 2) {
      setBulkError("CSV에 헤더와 최소 1개의 데이터 행이 필요합니다.");
      return;
    }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const requiredFields = ["authorname", "content", "rating"];
    const missing = requiredFields.filter((f) => !header.includes(f));
    if (missing.length > 0) {
      setBulkError(`필수 열 누락: ${missing.join(", ")}`);
      return;
    }

    const newReviews: Review[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      if (values.length < header.length) continue;

      const row: Record<string, string> = {};
      header.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });

      const rating = parseInt(row["rating"] || "5", 10);
      newReviews.push({
        id: generateId(),
        authorName: row["authorname"] || "",
        authorCohort: row["authorcohort"] || "",
        content: row["content"] || "",
        rating: isNaN(rating) ? 5 : Math.min(5, Math.max(1, rating)),
        programTitle: row["programtitle"] || "",
        isApproved: (row["isapproved"] || "false").toLowerCase() === "true",
        isFeatured: (row["isfeatured"] || "false").toLowerCase() === "true",
        date:
          row["date"] || new Date().toISOString().split("T")[0],
      });
    }

    if (newReviews.length === 0) {
      setBulkError("유효한 데이터 행을 찾을 수 없습니다.");
      return;
    }

    setReviews((prev) => [...newReviews, ...prev]);
    closeModal();
  };

  // --- Star rating picker ---
  const StarPicker = ({
    value,
    onChange,
  }: {
    value: number;
    onChange: (v: number) => void;
  }) => (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          className="focus:outline-none"
        >
          <Star
            size={20}
            className={
              i < value
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-300 hover:text-yellow-300"
            }
          />
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">후기 관리</h1>
          <p className="text-gray-500 mt-1">
            수강 후기를 승인/관리합니다. 총 {reviews.length}건
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openBulk}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <Upload size={16} />
            일괄 업로드
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 transition"
          >
            <Plus size={16} />
            새 후기
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="이름, 내용, 과정명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
            >
              <option value="all">전체 상태</option>
              <option value="approved">승인됨</option>
              <option value="pending">미승인</option>
            </select>
            <button
              onClick={() => setFilterFeatured(!filterFeatured)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border transition ${
                filterFeatured
                  ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              <Award size={14} />
              추천만
            </button>
          </div>
        </div>
        {(searchQuery || filterStatus !== "all" || filterFeatured) && (
          <p className="text-xs text-gray-400 mt-2">
            {filteredReviews.length}건의 결과
          </p>
        )}
      </div>

      {/* Review cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredReviews.map((review) => (
          <div
            key={review.id}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900">
                  {review.authorName}
                </p>
                <p className="text-xs text-gray-400">
                  {review.authorCohort} &middot; {review.programTitle}
                </p>
                <p className="text-xs text-gray-300 mt-0.5">{review.date}</p>
              </div>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={
                      i < review.rating
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-gray-200"
                    }
                  />
                ))}
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">{review.content}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleApproval(review.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  review.isApproved
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {review.isApproved ? (
                  <CheckCircle size={14} />
                ) : (
                  <XCircle size={14} />
                )}
                {review.isApproved ? "승인됨" : "미승인"}
              </button>
              <button
                onClick={() => toggleFeatured(review.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  review.isFeatured
                    ? "bg-yellow-50 text-yellow-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                <Award size={14} />
                {review.isFeatured ? "추천" : "일반"}
              </button>
              <button
                onClick={() => openEdit(review)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(review.id)}
                className="ml-auto p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {filteredReviews.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            조건에 맞는 후기가 없습니다.
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Create / Edit Modal */}
            {(modalMode === "create" || modalMode === "edit") && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-gray-900">
                    {modalMode === "create" ? "새 후기 작성" : "후기 수정"}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        작성자 이름 *
                      </label>
                      <input
                        type="text"
                        value={formData.authorName}
                        onChange={(e) =>
                          setFormData({ ...formData, authorName: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                        placeholder="김○○"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        기수
                      </label>
                      <input
                        type="text"
                        value={formData.authorCohort}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            authorCohort: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                        placeholder="10기 수강생"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      과정명
                    </label>
                    <input
                      type="text"
                      value={formData.programTitle}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          programTitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                      placeholder="AI 기초 정규과정 10기"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      후기 내용 *
                    </label>
                    <textarea
                      value={formData.content}
                      onChange={(e) =>
                        setFormData({ ...formData, content: e.target.value })
                      }
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 resize-none"
                      placeholder="수강 후기를 입력하세요."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        평점
                      </label>
                      <StarPicker
                        value={formData.rating}
                        onChange={(v) =>
                          setFormData({ ...formData, rating: v })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        날짜
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) =>
                          setFormData({ ...formData, date: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={formData.isApproved}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isApproved: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                      />
                      승인
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={formData.isFeatured}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isFeatured: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                      />
                      추천
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleFormSubmit}
                    disabled={
                      !formData.authorName.trim() || !formData.content.trim()
                    }
                    className="px-4 py-2 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {modalMode === "create" ? "등록" : "저장"}
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Upload Modal */}
            {modalMode === "bulk" && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-gray-900">
                    일괄 업로드 (CSV)
                  </h2>
                  <button
                    onClick={closeModal}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  CSV 형식의 텍스트를 붙여넣기 하세요. 첫 번째 행은 헤더여야
                  합니다.
                </p>
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <p className="text-xs text-gray-500 font-mono">
                    필수 열: authorName, content, rating
                  </p>
                  <p className="text-xs text-gray-400 font-mono mt-1">
                    선택 열: authorCohort, programTitle, isApproved, isFeatured,
                    date
                  </p>
                  <p className="text-xs text-gray-400 font-mono mt-2">
                    예시:
                    <br />
                    authorName,authorCohort,content,rating,programTitle,isApproved,date
                    <br />
                    홍길동,11기 수강생,정말 좋은 과정이었습니다,5,AI 기초 11기,true,2025-12-01
                  </p>
                </div>
                <textarea
                  value={bulkCsv}
                  onChange={(e) => setBulkCsv(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 resize-none"
                  placeholder="CSV 텍스트를 여기에 붙여넣기..."
                />
                {bulkError && (
                  <p className="text-sm text-red-500 mt-2">{bulkError}</p>
                )}
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleBulkUpload}
                    disabled={!bulkCsv.trim()}
                    className="px-4 py-2 rounded-lg bg-primary-600 text-sm font-medium text-white hover:bg-primary-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    업로드
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
