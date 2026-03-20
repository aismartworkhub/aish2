"use client";

import { useState, useEffect } from "react";
import {
  Award,
  Plus,
  Upload,
  Trash2,
  Edit,
  X,
  Save,
  Search,
  Users,
  Mail,
  CheckCircle,
  Clock,
  FileSpreadsheet,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTIONS, getCollection, createDoc, upsertDoc, updateDocFields, removeDoc } from "@/lib/firestore";

// =============================================================================
// Types
// =============================================================================

interface Cohort {
  id: string;
  name: string;
  programTitle: string;
  startDate: string;
  endDate: string;
  graduateCount: number;
}

interface Graduate {
  id: string;
  cohortId: string;
  name: string;
  email: string;
  studentId: string;
  status: "수료" | "졸업" | "미수료";
}

interface CertificateRequest {
  id: string;
  graduateId: string;
  name: string;
  email: string;
  cohortName: string;
  requestDate: string;
  status: "대기" | "승인" | "발급완료" | "거절";
}

type TabKey = "cohorts" | "graduates" | "requests";


// =============================================================================
// Helpers
// =============================================================================

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "cohorts", label: "기수/클래스 관리", icon: <GraduationCap size={16} /> },
  { key: "graduates", label: "졸업자 관리", icon: <Users size={16} /> },
  { key: "requests", label: "수료증 신청", icon: <Award size={16} /> },
];

const STATUS_GRADUATE_COLORS: Record<Graduate["status"], string> = {
  수료: "bg-blue-50 text-blue-700",
  졸업: "bg-green-50 text-green-700",
  미수료: "bg-gray-100 text-gray-500",
};

const STATUS_REQUEST_COLORS: Record<CertificateRequest["status"], string> = {
  대기: "bg-yellow-50 text-yellow-700",
  승인: "bg-blue-50 text-blue-700",
  발급완료: "bg-green-50 text-green-700",
  거절: "bg-red-50 text-red-600",
};

// =============================================================================
// Component
// =============================================================================

export default function AdminCertificatesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("cohorts");
  const [loading, setLoading] = useState(true);

  // --- Cohort state ---
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
  const [cohortForm, setCohortForm] = useState({ name: "", programTitle: "", startDate: "", endDate: "" });

  // --- Graduate state ---
  const [graduates, setGraduates] = useState<Graduate[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  const [gradSearch, setGradSearch] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [gradModalOpen, setGradModalOpen] = useState(false);
  const [editingGrad, setEditingGrad] = useState<Graduate | null>(null);
  const [gradForm, setGradForm] = useState({ name: "", email: "", studentId: "", status: "수료" as Graduate["status"] });

  // --- Request state ---
  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [reqSearch, setReqSearch] = useState("");
  const [reqStatusFilter, setReqStatusFilter] = useState<string>("ALL");
  const [detailRequest, setDetailRequest] = useState<CertificateRequest | null>(null);

  useEffect(() => {
    Promise.all([
      getCollection<Cohort>(COLLECTIONS.CERTIFICATES_COHORTS),
      getCollection<Graduate>(COLLECTIONS.CERTIFICATES_GRADUATES),
      getCollection<CertificateRequest>(COLLECTIONS.CERTIFICATES_REQUESTS),
    ]).then(([c, g, r]) => {
      setCohorts(c);
      setGraduates(g);
      setRequests(r);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  // =========================================================================
  // Tab 1 - Cohort CRUD
  // =========================================================================

  const openCohortCreate = () => {
    setEditingCohort(null);
    setCohortForm({ name: "", programTitle: "", startDate: "", endDate: "" });
    setCohortModalOpen(true);
  };

  const openCohortEdit = (c: Cohort) => {
    setEditingCohort(c);
    setCohortForm({ name: c.name, programTitle: c.programTitle, startDate: c.startDate, endDate: c.endDate });
    setCohortModalOpen(true);
  };

  const closeCohortModal = () => {
    setCohortModalOpen(false);
    setEditingCohort(null);
  };

  const saveCohort = async () => {
    if (!cohortForm.name.trim()) return;
    try {
      if (editingCohort) {
        await upsertDoc(COLLECTIONS.CERTIFICATES_COHORTS, editingCohort.id, cohortForm);
        setCohorts((prev) =>
          prev.map((c) =>
            c.id === editingCohort.id
              ? { ...c, ...cohortForm }
              : c
          )
        );
      } else {
        const data = { ...cohortForm, graduateCount: 0 };
        const id = await createDoc(COLLECTIONS.CERTIFICATES_COHORTS, data);
        setCohorts((prev) => [{ id, ...data }, ...prev]);
      }
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다.");
    }
    closeCohortModal();
  };

  const deleteCohort = async (id: string) => {
    if (!window.confirm("이 기수를 삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.CERTIFICATES_COHORTS, id);
      setCohorts((prev) => prev.filter((c) => c.id !== id));
      setGraduates((prev) => prev.filter((g) => g.cohortId !== id));
      if (selectedCohortId === id) setSelectedCohortId("");
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했습니다.");
    }
  };

  // =========================================================================
  // Tab 2 - Graduate management
  // =========================================================================

  const filteredGraduates = graduates.filter((g) => {
    if (!selectedCohortId) return false;
    const matchCohort = g.cohortId === selectedCohortId;
    const matchSearch =
      g.name.toLowerCase().includes(gradSearch.toLowerCase()) ||
      g.email.toLowerCase().includes(gradSearch.toLowerCase()) ||
      g.studentId.toLowerCase().includes(gradSearch.toLowerCase());
    return matchCohort && matchSearch;
  });

  const openGradCreate = () => {
    if (!selectedCohortId) return;
    setEditingGrad(null);
    setGradForm({ name: "", email: "", studentId: "", status: "수료" });
    setGradModalOpen(true);
  };

  const openGradEdit = (g: Graduate) => {
    setEditingGrad(g);
    setGradForm({ name: g.name, email: g.email, studentId: g.studentId, status: g.status });
    setGradModalOpen(true);
  };

  const closeGradModal = () => {
    setGradModalOpen(false);
    setEditingGrad(null);
  };

  const saveGrad = async () => {
    if (!gradForm.name.trim()) return;
    try {
      if (editingGrad) {
        await upsertDoc(COLLECTIONS.CERTIFICATES_GRADUATES, editingGrad.id, gradForm);
        setGraduates((prev) =>
          prev.map((g) =>
            g.id === editingGrad.id ? { ...g, ...gradForm } : g
          )
        );
      } else {
        const data = { ...gradForm, cohortId: selectedCohortId };
        const id = await createDoc(COLLECTIONS.CERTIFICATES_GRADUATES, data);
        setGraduates((prev) => [...prev, { id, ...data }]);
        const cohort = cohorts.find((c) => c.id === selectedCohortId);
        if (cohort) {
          const newCount = cohort.graduateCount + 1;
          await updateDocFields(COLLECTIONS.CERTIFICATES_COHORTS, selectedCohortId, { graduateCount: newCount });
          setCohorts((prev) =>
            prev.map((c) => (c.id === selectedCohortId ? { ...c, graduateCount: newCount } : c))
          );
        }
      }
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다.");
    }
    closeGradModal();
  };

  const deleteGrad = async (id: string) => {
    if (!window.confirm("이 졸업자를 삭제하시겠습니까?")) return;
    const grad = graduates.find((g) => g.id === id);
    try {
      await removeDoc(COLLECTIONS.CERTIFICATES_GRADUATES, id);
      setGraduates((prev) => prev.filter((g) => g.id !== id));
      if (grad) {
        const cohort = cohorts.find((c) => c.id === grad.cohortId);
        if (cohort) {
          const newCount = Math.max(0, cohort.graduateCount - 1);
          await updateDocFields(COLLECTIONS.CERTIFICATES_COHORTS, grad.cohortId, { graduateCount: newCount });
          setCohorts((prev) =>
            prev.map((c) => (c.id === grad.cohortId ? { ...c, graduateCount: newCount } : c))
          );
        }
      }
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했습니다.");
    }
  };

  const changeGradStatus = async (id: string, status: Graduate["status"]) => {
    try {
      await updateDocFields(COLLECTIONS.CERTIFICATES_GRADUATES, id, { status });
      setGraduates((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkUpload = async () => {
    if (!selectedCohortId || !bulkInput.trim()) return;
    const lines = bulkInput.trim().split("\n");
    const newGrads: Omit<Graduate, "id">[] = [];
    for (const line of lines) {
      const parts = line.split(",").map((s) => s.trim());
      if (parts.length >= 3) {
        newGrads.push({
          cohortId: selectedCohortId,
          name: parts[0],
          email: parts[1],
          studentId: parts[2],
          status: "수료",
        });
      }
    }
    if (newGrads.length === 0) {
      alert("유효한 데이터가 없습니다. 형식: 이름,이메일,학번 (한 줄에 한 명)");
      return;
    }
    try {
      const created = await Promise.all(
        newGrads.map(async (g) => {
          const id = await createDoc(COLLECTIONS.CERTIFICATES_GRADUATES, g);
          return { id, ...g } as Graduate;
        })
      );
      setGraduates((prev) => [...prev, ...created]);
      const cohort = cohorts.find((c) => c.id === selectedCohortId);
      if (cohort) {
        const newCount = cohort.graduateCount + created.length;
        await updateDocFields(COLLECTIONS.CERTIFICATES_COHORTS, selectedCohortId, { graduateCount: newCount });
        setCohorts((prev) =>
          prev.map((c) => (c.id === selectedCohortId ? { ...c, graduateCount: newCount } : c))
        );
      }
      setBulkInput("");
      setShowBulkUpload(false);
      alert(`${created.length}명의 졸업자가 등록되었습니다.`);
    } catch (e) {
      console.error(e);
      alert("일괄 등록에 실패했습니다.");
    }
  };

  // =========================================================================
  // Tab 3 - Certificate requests
  // =========================================================================

  const filteredRequests = requests.filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(reqSearch.toLowerCase()) ||
      r.email.toLowerCase().includes(reqSearch.toLowerCase()) ||
      r.cohortName.toLowerCase().includes(reqSearch.toLowerCase());
    const matchStatus = reqStatusFilter === "ALL" || r.status === reqStatusFilter;
    return matchSearch && matchStatus;
  });

  const changeReqStatus = async (id: string, status: CertificateRequest["status"]) => {
    try {
      await updateDocFields(COLLECTIONS.CERTIFICATES_REQUESTS, id, { status });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      if (status === "승인") {
        alert("수료증이 등록된 이메일로 발송됩니다 (이메일 연동 설정 필요)");
      }
    } catch (e) {
      console.error(e);
      alert("상태 변경에 실패했습니다.");
    }
  };

  // =========================================================================
  // Render
  // =========================================================================

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm">불러오는 중...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">수료증 관리</h1>
          <p className="text-gray-500 mt-1">기수/클래스, 졸업자, 수료증 신청을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2 text-primary-600">
          <Award size={28} />
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 mb-6 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <Mail size={18} className="mt-0.5 shrink-0" />
        <p>
          Google 로그인 인증 및 이메일 발송 기능은 관리자 설정에서 연동 설정 시 활성화됩니다.
          현재는 데이터 관리만 가능합니다.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-white text-primary-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================== */}
      {/* Tab 1: 기수/클래스 관리 */}
      {/* ============================================================== */}
      {activeTab === "cohorts" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">기수/클래스 목록</h2>
            <button
              onClick={openCohortCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              <Plus size={18} />
              새 기수 등록
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">기수명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">프로그램</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">기간</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">졸업자 수</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                        등록된 기수가 없습니다.
                      </td>
                    </tr>
                  )}
                  {cohorts.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4">
                        <span className="font-medium text-gray-900 text-sm">{c.name}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{c.programTitle}</td>
                      <td className="px-4 py-4 text-xs text-gray-500">
                        {c.startDate} ~ {c.endDate}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                          <Users size={14} />
                          {c.graduateCount}명
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openCohortEdit(c)}
                            className="p-2 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => deleteCohort(c.id)}
                            className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          >
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

          {/* Cohort Modal */}
          {cohortModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={closeCohortModal} />
              <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">
                    {editingCohort ? "기수 수정" : "새 기수 등록"}
                  </h2>
                  <button onClick={closeCohortModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">기수명</label>
                    <input
                      type="text"
                      value={cohortForm.name}
                      onChange={(e) => setCohortForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="예: 1기, AI 기초 정규과정 11기"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">프로그램명</label>
                    <input
                      type="text"
                      value={cohortForm.programTitle}
                      onChange={(e) => setCohortForm((p) => ({ ...p, programTitle: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="예: AI 기초 정규과정"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                      <input
                        type="date"
                        value={cohortForm.startDate}
                        onChange={(e) => setCohortForm((p) => ({ ...p, startDate: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                      <input
                        type="date"
                        value={cohortForm.endDate}
                        onChange={(e) => setCohortForm((p) => ({ ...p, endDate: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                  <button
                    onClick={closeCohortModal}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={saveCohort}
                    disabled={!cohortForm.name.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={16} />
                    {editingCohort ? "저장" : "등록"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* Tab 2: 졸업자 관리 */}
      {/* ============================================================== */}
      {activeTab === "graduates" && (
        <div>
          {/* Cohort selector */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <GraduationCap size={16} className="text-gray-400" />
                <select
                  value={selectedCohortId}
                  onChange={(e) => setSelectedCohortId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">기수 선택...</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.programTitle}
                    </option>
                  ))}
                </select>
              </div>
              {selectedCohortId && (
                <>
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="이름, 이메일, 학번 검색..."
                      value={gradSearch}
                      onChange={(e) => setGradSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowBulkUpload(!showBulkUpload)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <Upload size={16} />
                      일괄 등록
                    </button>
                    <button
                      onClick={openGradCreate}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
                    >
                      <Plus size={18} />
                      졸업자 추가
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bulk upload panel */}
          {showBulkUpload && selectedCohortId && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <FileSpreadsheet size={18} className="text-primary-600" />
                <h3 className="font-semibold text-gray-900 text-sm">CSV/Excel 일괄 등록</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                한 줄에 한 명씩 <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">이름,이메일,학번</span> 형식으로 입력하세요.
              </p>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none mb-3"
                placeholder={`김민수,minsu@example.com,STU-2025-001\n이서연,seoyeon@example.com,STU-2025-002\n박지호,jiho@example.com,STU-2025-003`}
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => { setShowBulkUpload(false); setBulkInput(""); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleBulkUpload}
                  disabled={!bulkInput.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload size={16} />
                  등록하기
                </button>
              </div>
            </div>
          )}

          {!selectedCohortId ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <GraduationCap size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">기수를 선택하면 졸업자 목록이 표시됩니다.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">이름</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">이메일</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">학번</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGraduates.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                          졸업자가 없습니다.
                        </td>
                      </tr>
                    )}
                    {filteredGraduates.map((g) => (
                      <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <span className="font-medium text-gray-900 text-sm">{g.name}</span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">{g.email}</td>
                        <td className="px-4 py-4 text-sm text-gray-500 font-mono">{g.studentId}</td>
                        <td className="px-4 py-4">
                          <select
                            value={g.status}
                            onChange={(e) => changeGradStatus(g.id, e.target.value as Graduate["status"])}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer",
                              STATUS_GRADUATE_COLORS[g.status]
                            )}
                          >
                            <option value="수료">수료</option>
                            <option value="졸업">졸업</option>
                            <option value="미수료">미수료</option>
                          </select>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openGradEdit(g)}
                              className="p-2 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => deleteGrad(g.id)}
                              className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredGraduates.length > 0 && (
                <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500">
                  총 {filteredGraduates.length}명
                </div>
              )}
            </div>
          )}

          {/* Graduate Modal */}
          {gradModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={closeGradModal} />
              <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">
                    {editingGrad ? "졸업자 수정" : "졸업자 추가"}
                  </h2>
                  <button onClick={closeGradModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                    <input
                      type="text"
                      value={gradForm.name}
                      onChange={(e) => setGradForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="졸업자 이름"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                    <input
                      type="email"
                      value={gradForm.email}
                      onChange={(e) => setGradForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="example@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">학번</label>
                    <input
                      type="text"
                      value={gradForm.studentId}
                      onChange={(e) => setGradForm((p) => ({ ...p, studentId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="STU-2025-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                    <select
                      value={gradForm.status}
                      onChange={(e) => setGradForm((p) => ({ ...p, status: e.target.value as Graduate["status"] }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                      <option value="수료">수료</option>
                      <option value="졸업">졸업</option>
                      <option value="미수료">미수료</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                  <button
                    onClick={closeGradModal}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={saveGrad}
                    disabled={!gradForm.name.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={16} />
                    {editingGrad ? "저장" : "등록"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* Tab 3: 수료증 신청 */}
      {/* ============================================================== */}
      {activeTab === "requests" && (
        <div>
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="이름, 이메일, 기수 검색..."
                  value={reqSearch}
                  onChange={(e) => setReqSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <select
                value={reqStatusFilter}
                onChange={(e) => setReqStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="ALL">전체 상태</option>
                <option value="대기">대기</option>
                <option value="승인">승인</option>
                <option value="발급완료">발급완료</option>
                <option value="거절">거절</option>
              </select>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {(["대기", "승인", "발급완료", "거절"] as const).map((status) => {
              const count = requests.filter((r) => r.status === status).length;
              const icons = { 대기: <Clock size={18} />, 승인: <CheckCircle size={18} />, 발급완료: <Award size={18} />, 거절: <X size={18} /> };
              return (
                <div key={status} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("p-1.5 rounded-lg", STATUS_REQUEST_COLORS[status])}>{icons[status]}</span>
                    <span className="text-2xl font-bold text-gray-900">{count}</span>
                  </div>
                  <span className="text-xs text-gray-500">{status}</span>
                </div>
              );
            })}
          </div>

          {/* Request table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신청자</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">이메일</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">기수</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">신청일</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                        수료증 신청이 없습니다.
                      </td>
                    </tr>
                  )}
                  {filteredRequests.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4">
                        <span className="font-medium text-gray-900 text-sm">{r.name}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{r.email}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{r.cohortName}</td>
                      <td className="px-4 py-4 text-xs text-gray-500">{r.requestDate}</td>
                      <td className="px-4 py-4">
                        <select
                          value={r.status}
                          onChange={(e) => changeReqStatus(r.id, e.target.value as CertificateRequest["status"])}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer",
                            STATUS_REQUEST_COLORS[r.status]
                          )}
                        >
                          <option value="대기">대기</option>
                          <option value="승인">승인</option>
                          <option value="발급완료">발급완료</option>
                          <option value="거절">거절</option>
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => setDetailRequest(r)}
                            className="p-2 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors"
                          >
                            <Search size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredRequests.length > 0 && (
              <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500">
                총 {filteredRequests.length}건
              </div>
            )}
          </div>

          {/* Detail modal */}
          {detailRequest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setDetailRequest(null)} />
              <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">수료증 신청 상세</h2>
                  <button onClick={() => setDetailRequest(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-gray-400">신청자</span>
                      <p className="text-sm font-medium text-gray-900">{detailRequest.name}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">기수</span>
                      <p className="text-sm font-medium text-gray-900">{detailRequest.cohortName}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">이메일</span>
                      <p className="text-sm text-gray-600">{detailRequest.email}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">신청일</span>
                      <p className="text-sm text-gray-600">{detailRequest.requestDate}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">상태</span>
                    <div className="mt-1">
                      <span className={cn("inline-block px-2.5 py-1 rounded-full text-xs font-medium", STATUS_REQUEST_COLORS[detailRequest.status])}>
                        {detailRequest.status}
                      </span>
                    </div>
                  </div>
                  {detailRequest.status === "승인" && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                      <Mail size={14} className="mt-0.5 shrink-0" />
                      <span>수료증이 등록된 이메일로 발송됩니다 (이메일 연동 설정 필요)</span>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">상태 변경</label>
                    <select
                      value={detailRequest.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as CertificateRequest["status"];
                        changeReqStatus(detailRequest.id, newStatus);
                        setDetailRequest({ ...detailRequest, status: newStatus });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                      <option value="대기">대기</option>
                      <option value="승인">승인</option>
                      <option value="발급완료">발급완료</option>
                      <option value="거절">거절</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end px-6 py-4 border-t border-gray-100">
                  <button
                    onClick={() => setDetailRequest(null)}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
