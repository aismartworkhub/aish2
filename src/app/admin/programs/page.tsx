"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import { PROGRAM_CATEGORY_LABELS, PROGRAM_STATUS_LABELS } from "@/lib/constants";
import { COLLECTIONS, getCollection, createDoc, upsertDoc, removeDoc } from "@/lib/firestore";

interface Program {
  id: string;
  title: string;
  category: string;
  status: string;
  cohort: string;
  summary: string;
  schedule: string;
  startDate: string;
  endDate: string;
  instructors: string[];
  thumbnailUrl?: string;
}

interface ProgramFormData {
  title: string;
  category: string;
  status: string;
  cohort: string;
  summary: string;
  schedule: string;
  startDate: string;
  endDate: string;
  instructors: string;
}

const emptyForm: ProgramFormData = {
  title: "",
  category: "REGULAR_FREE",
  status: "SOON",
  cohort: "",
  summary: "",
  schedule: "",
  startDate: "",
  endDate: "",
  instructors: "",
};

function formFromProgram(p: Program): ProgramFormData {
  return {
    title: p.title,
    category: p.category,
    status: p.status,
    cohort: p.cohort ?? "",
    summary: p.summary,
    schedule: p.schedule,
    startDate: p.startDate,
    endDate: p.endDate,
    instructors: p.instructors.join(", "),
  };
}

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState<ProgramFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      const data = await getCollection<Program>(COLLECTIONS.PROGRAMS);
      setPrograms(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredPrograms = programs.filter((p) => {
    const matchSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory === "ALL" || p.category === selectedCategory;
    const matchStatus = selectedStatus === "ALL" || p.status === selectedStatus;
    return matchSearch && matchCategory && matchStatus;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredPrograms.length) setSelectedIds([]);
    else setSelectedIds(filteredPrograms.map((p) => p.id));
  };

  const openCreateModal = () => {
    setIsCreating(true);
    setEditingProgram(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (program: Program) => {
    setIsCreating(false);
    setEditingProgram(program);
    setFormData(formFromProgram(program));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProgram(null);
    setIsCreating(false);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    const instructorsArray = formData.instructors.split(",").map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      if (isCreating) {
        const newProgram: Omit<Program, "id"> = {
          title: formData.title,
          category: formData.category,
          status: formData.status,
          cohort: formData.cohort,
          summary: formData.summary,
          schedule: formData.schedule,
          startDate: formData.startDate,
          endDate: formData.endDate,
          instructors: instructorsArray,
          thumbnailUrl: "/images/placeholder-program.jpg",
        };
        const id = await createDoc(COLLECTIONS.PROGRAMS, newProgram);
        setPrograms((prev) => [{ id, ...newProgram }, ...prev]);
      } else if (editingProgram) {
        const updated: Partial<Program> = {
          title: formData.title,
          category: formData.category,
          status: formData.status,
          cohort: formData.cohort,
          summary: formData.summary,
          schedule: formData.schedule,
          startDate: formData.startDate,
          endDate: formData.endDate,
          instructors: instructorsArray,
        };
        await upsertDoc(COLLECTIONS.PROGRAMS, editingProgram.id, updated);
        setPrograms((prev) => prev.map((p) => p.id === editingProgram.id ? { ...p, ...updated } : p));
      }
      closeModal();
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("정말 이 프로그램을 삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.PROGRAMS, id);
      setPrograms((prev) => prev.filter((p) => p.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했습니다.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`선택된 ${selectedIds.length}개 프로그램을 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(selectedIds.map((id) => removeDoc(COLLECTIONS.PROGRAMS, id)));
      setPrograms((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했습니다.");
    }
  };

  const updateField = (field: keyof ProgramFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm">불러오는 중...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">교육 프로그램 관리</h1>
          <p className="text-gray-500 mt-1">프로그램을 등록하고 관리합니다.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} />새 프로그램 등록
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="프로그램 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none">
              <option value="ALL">전체 카테고리</option>
              {Object.entries(PROGRAM_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none">
              <option value="ALL">전체 상태</option>
              {Object.entries(PROGRAM_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left">
                  <input type="checkbox"
                    checked={selectedIds.length === filteredPrograms.length && filteredPrograms.length > 0}
                    onChange={toggleAll} className="rounded border-gray-300" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">제목</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">카테고리</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">강사</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">기간</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrograms.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">등록된 프로그램이 없습니다.</td></tr>
              ) : (
                filteredPrograms.map((program) => (
                  <tr key={program.id}
                    className={cn("border-b border-gray-50 hover:bg-gray-50/50 transition-colors",
                      selectedIds.includes(program.id) && "bg-primary-50/30")}>
                    <td className="px-4 py-4">
                      <input type="checkbox" checked={selectedIds.includes(program.id)}
                        onChange={() => toggleSelect(program.id)} className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900 text-sm">{program.title}</div>
                      {program.cohort && <div className="text-xs text-gray-400 mt-0.5">{program.cohort}</div>}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">{PROGRAM_CATEGORY_LABELS[program.category]}</span>
                    </td>
                    <td className="px-4 py-4"><StatusBadge status={program.status} /></td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">{program.instructors.join(", ")}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-500">{program.startDate}<br />~ {program.endDate}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditModal(program)}
                          className="p-2 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(program.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{isCreating ? "새 프로그램 등록" : "프로그램 수정"}</h2>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input type="text" value={formData.title} onChange={(e) => updateField("title", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="프로그램 제목" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                  <select value={formData.category} onChange={(e) => updateField("category", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none">
                    {Object.entries(PROGRAM_CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                  <select value={formData.status} onChange={(e) => updateField("status", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none">
                    {Object.entries(PROGRAM_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">기수 (cohort)</label>
                <input type="text" value={formData.cohort} onChange={(e) => updateField("cohort", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="예: 11기" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">요약</label>
                <textarea value={formData.summary} onChange={(e) => updateField("summary", e.target.value)}
                  rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                  placeholder="프로그램 요약 설명" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">일정</label>
                <input type="text" value={formData.schedule} onChange={(e) => updateField("schedule", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="예: 매주 화요일 19:00-21:00" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                  <input type="date" value={formData.startDate} onChange={(e) => updateField("startDate", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                  <input type="date" value={formData.endDate} onChange={(e) => updateField("endDate", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">강사 (쉼표로 구분)</label>
                <input type="text" value={formData.instructors} onChange={(e) => updateField("instructors", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="예: 김상용, 박준혁" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
              <button onClick={handleSave} disabled={!formData.title.trim() || saving}
                className="px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? "저장중..." : isCreating ? "등록" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
