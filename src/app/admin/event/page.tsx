"use client";

import { useState, useRef } from "react";
import {
  Plus, Search, Edit, Trash2, Filter, X, Sparkles, Link, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENT_STATUS_LABELS, EVENT_STATUS_COLORS } from "@/lib/constants";
import { COLLECTIONS, createDoc, upsertDoc, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { useToast } from "@/components/ui/Toast";
import {
  getGeminiApiKey, saveGeminiApiKey, analyzeUrl, analyzeFile,
  type GeminiEventResult,
} from "@/lib/gemini";
import type { AdminEvent } from "@/types/firestore";

type Event = AdminEvent & { id: string };

interface EventFormData {
  title: string;
  tags: string;
  startDate: string;
  endDate: string;
  status: string;
  organizer: string;
  contactPerson: string;
  phone: string;
  email: string;
  summary: string;
  thumbnailUrl: string;
}

const emptyForm: EventFormData = {
  title: "",
  tags: "",
  startDate: "",
  endDate: "",
  status: "UPCOMING",
  organizer: "",
  contactPerson: "",
  phone: "",
  email: "",
  summary: "",
  thumbnailUrl: "",
};

function formFromEvent(e: Event): EventFormData {
  return {
    title: e.title,
    tags: e.tags.join(", "),
    startDate: e.startDate,
    endDate: e.endDate,
    status: e.status,
    organizer: e.organizer,
    contactPerson: e.contactPerson,
    phone: e.phone,
    email: e.email,
    summary: e.summary,
    thumbnailUrl: e.thumbnailUrl,
  };
}

const MAX_THUMB_KB = 500;

export default function AdminEventPage() {
  const { toast } = useToast();
  const { data: events, setData: setEvents, loading, error, refresh } =
    useFirestoreCollection<Event>(COLLECTIONS.ADMIN_EVENTS);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 모달
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<EventFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  // AI 분석
  const [aiSource, setAiSource] = useState<"url" | "file">("url");
  const [aiUrl, setAiUrl] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 필터
  const filteredEvents = events.filter((e) => {
    const matchSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = selectedStatus === "ALL" || e.status === selectedStatus;
    return matchSearch && matchStatus;
  });

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () => {
    if (selectedIds.length === filteredEvents.length) setSelectedIds([]);
    else setSelectedIds(filteredEvents.map((e) => e.id));
  };

  // 모달 열기/닫기
  const openCreateModal = () => {
    setIsCreating(true);
    setEditingEvent(null);
    setFormData(emptyForm);
    setAiUrl("");
    setIsModalOpen(true);
  };
  const openEditModal = (event: Event) => {
    setIsCreating(false);
    setEditingEvent(event);
    setFormData(formFromEvent(event));
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setIsCreating(false);
    setFormData(emptyForm);
  };

  // 필드 업데이트
  const updateField = (field: keyof EventFormData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // AI 분석 결과 → 폼 병합
  const mergeAiResult = (result: GeminiEventResult) => {
    setFormData((prev) => ({
      ...prev,
      ...(result.title ? { title: result.title } : {}),
      ...(result.tags ? { tags: result.tags.join(", ") } : {}),
      ...(result.startDate ? { startDate: result.startDate } : {}),
      ...(result.endDate ? { endDate: result.endDate } : {}),
      ...(result.organizer ? { organizer: result.organizer } : {}),
      ...(result.contactPerson ? { contactPerson: result.contactPerson } : {}),
      ...(result.phone ? { phone: result.phone } : {}),
      ...(result.email ? { email: result.email } : {}),
      ...(result.summary ? { summary: result.summary } : {}),
      ...(result.thumbnailUrl ? { thumbnailUrl: result.thumbnailUrl } : {}),
    }));
  };

  // AI 분석 실행
  const handleAiAnalyze = async () => {
    let apiKey = await getGeminiApiKey();
    if (!apiKey) {
      setShowApiKeyPrompt(true);
      return;
    }
    setAiLoading(true);
    try {
      let result: GeminiEventResult;
      if (aiSource === "url") {
        if (!aiUrl.trim()) { toast("URL을 입력해 주세요.", "info"); setAiLoading(false); return; }
        result = await analyzeUrl(apiKey, aiUrl.trim());
      } else {
        const file = fileInputRef.current?.files?.[0];
        if (!file) { toast("파일을 선택해 주세요.", "info"); setAiLoading(false); return; }
        const base64 = await readFileAsBase64(file);
        result = await analyzeFile(apiKey, base64, file.type);
      }
      const fieldCount = Object.keys(result).length;
      if (fieldCount === 0) {
        toast("분석 결과를 추출하지 못했습니다.", "info");
      } else {
        mergeAiResult(result);
        toast(`AI 분석 완료 (${fieldCount}개 필드 추출)`, "success");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI 분석 실패";
      toast(msg, "error");
    } finally {
      setAiLoading(false);
    }
  };

  // API 키 저장
  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    await saveGeminiApiKey(apiKeyInput.trim());
    setShowApiKeyPrompt(false);
    setApiKeyInput("");
    toast("Gemini API 키가 저장되었습니다.", "success");
    handleAiAnalyze();
  };

  // 파일 → base64
  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 썸네일 업로드
  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_THUMB_KB * 1024) {
      toast(`썸네일은 ${MAX_THUMB_KB}KB 이하로 업로드해 주세요.`, "info");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateField("thumbnailUrl", reader.result as string);
    reader.readAsDataURL(file);
  };

  // 저장
  const handleSave = async () => {
    if (!formData.title.trim()) { toast("제목을 입력해 주세요.", "info"); return; }
    setSaving(true);
    try {
      const tagsArray = formData.tags.split(",").map((s) => s.trim()).filter(Boolean);
      const payload: Omit<AdminEvent, "id"> = {
        title: formData.title,
        tags: tagsArray,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        organizer: formData.organizer,
        contactPerson: formData.contactPerson,
        phone: formData.phone,
        email: formData.email,
        summary: formData.summary,
        thumbnailUrl: formData.thumbnailUrl,
      };
      if (isCreating) {
        const id = await createDoc(COLLECTIONS.ADMIN_EVENTS, payload);
        setEvents((prev) => [{ id, ...payload }, ...prev]);
      } else if (editingEvent) {
        await upsertDoc(COLLECTIONS.ADMIN_EVENTS, editingEvent.id, payload);
        setEvents((prev) => prev.map((e) => e.id === editingEvent.id ? { ...editingEvent, ...payload } : e));
      }
      closeModal();
    } catch {
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const handleDelete = async (id: string) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.ADMIN_EVENTS, id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch {
      toast("삭제에 실패했습니다.", "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`선택된 ${selectedIds.length}개를 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(selectedIds.map((id) => removeDoc(COLLECTIONS.ADMIN_EVENTS, id)));
      setEvents((prev) => prev.filter((e) => !selectedIds.includes(e.id)));
      setSelectedIds([]);
    } catch {
      toast("삭제에 실패했습니다.", "error");
    }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event 관리</h1>
          <p className="text-gray-500 mt-1">이벤트·행사를 등록하고 관리합니다. AI 자동분석을 지원합니다.</p>
        </div>
        <button onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
          <Plus size={18} />새 이벤트 등록
        </button>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="이벤트 검색..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none">
              <option value="ALL">전체 상태</option>
              {Object.entries(EVENT_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
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
                    checked={selectedIds.length === filteredEvents.length && filteredEvents.length > 0}
                    onChange={toggleAll} className="rounded border-gray-300" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">제목</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">태그</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">주관</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">기간</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">등록된 이벤트가 없습니다.</td></tr>
              ) : filteredEvents.map((event) => (
                <tr key={event.id}
                  className={cn("border-b border-gray-50 hover:bg-gray-50/50 transition-colors",
                    selectedIds.includes(event.id) && "bg-primary-50/30")}>
                  <td className="px-4 py-4">
                    <input type="checkbox" checked={selectedIds.includes(event.id)}
                      onChange={() => toggleSelect(event.id)} className="rounded border-gray-300" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {event.thumbnailUrl ? (
                        <img src={event.thumbnailUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-50 to-blue-50 flex items-center justify-center shrink-0">
                          <span className="text-base">📋</span>
                        </div>
                      )}
                      <div className="font-medium text-gray-900 text-sm">{event.title}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {event.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                      EVENT_STATUS_COLORS[event.status] ?? "bg-gray-100 text-gray-600")}>
                      {EVENT_STATUS_LABELS[event.status] ?? event.status}
                    </span>
                  </td>
                  <td className="px-4 py-4"><span className="text-sm text-gray-600">{event.organizer}</span></td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-gray-500">{event.startDate}<br />~ {event.endDate}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditModal(event)}
                        className="p-2 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(event.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
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

      {/* API 키 입력 프롬프트 */}
      {showApiKeyPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowApiKeyPrompt(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Gemini API 키 설정</h3>
            <p className="text-sm text-gray-500 mb-4">
              AI 자동분석을 위해 Google AI Studio에서 발급한 Gemini API 키를 입력하세요.
              한 번만 설정하면 이후 자동으로 사용됩니다.
            </p>
            <input type="text" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AIza..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowApiKeyPrompt(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 등록/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{isCreating ? "새 이벤트 등록" : "이벤트 수정"}</h2>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* AI 자동분석 섹션 */}
              {isCreating && (
                <div className="rounded-xl border border-primary-100 bg-primary-50/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary-700 font-semibold text-sm">
                    <Sparkles size={16} />AI 자동분석
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setAiSource("url")}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        aiSource === "url" ? "bg-primary-600 text-white" : "bg-white text-gray-600 border border-gray-200")}>
                      <Link size={14} />URL
                    </button>
                    <button onClick={() => setAiSource("file")}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        aiSource === "file" ? "bg-primary-600 text-white" : "bg-white text-gray-600 border border-gray-200")}>
                      <Upload size={14} />파일
                    </button>
                  </div>
                  {aiSource === "url" ? (
                    <div className="flex gap-2">
                      <input type="url" value={aiUrl} onChange={(e) => setAiUrl(e.target.value)}
                        placeholder="https://example.com/event-page"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                      <button onClick={handleAiAnalyze} disabled={aiLoading}
                        className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap">
                        {aiLoading ? "분석중..." : "분석"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.html"
                        className="flex-1 text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-primary-100 file:text-primary-700 file:text-xs file:font-medium" />
                      <button onClick={handleAiAnalyze} disabled={aiLoading}
                        className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap">
                        {aiLoading ? "분석중..." : "분석"}
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">URL 또는 공문·카탈로그 파일을 입력하면 AI가 이벤트 정보를 자동으로 추출합니다.</p>
                </div>
              )}

              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input type="text" value={formData.title} onChange={(e) => updateField("title", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="이벤트 제목" />
              </div>

              {/* 태그 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">태그 (쉼표로 구분)</label>
                <input type="text" value={formData.tags} onChange={(e) => updateField("tags", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="예: AI, 세미나, 교육" />
              </div>

              {/* 기간 + 상태 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                  <select value={formData.status} onChange={(e) => updateField("status", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none">
                    {Object.entries(EVENT_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 주관 + 담당자 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">주관</label>
                  <input type="text" value={formData.organizer} onChange={(e) => updateField("organizer", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    placeholder="주관 기관/단체" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">담당자</label>
                  <input type="text" value={formData.contactPerson} onChange={(e) => updateField("contactPerson", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    placeholder="담당자 이름" />
                </div>
              </div>

              {/* 연락처 + 이메일 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
                  <input type="tel" value={formData.phone} onChange={(e) => updateField("phone", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    placeholder="02-1234-5678" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                  <input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    placeholder="contact@example.com" />
                </div>
              </div>

              {/* 요약 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">요약</label>
                <textarea value={formData.summary} onChange={(e) => updateField("summary", e.target.value)}
                  rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                  placeholder="이벤트 요약 설명" />
              </div>

              {/* 썸네일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">썸네일</label>
                <div className="flex items-center gap-3">
                  {formData.thumbnailUrl && (
                    <img src={formData.thumbnailUrl} alt="thumb" className="w-16 h-16 rounded-lg object-cover" />
                  )}
                  <div className="flex-1">
                    <input type="file" accept="image/*" onChange={handleThumbnailUpload}
                      className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:text-xs file:font-medium" />
                    <p className="text-xs text-gray-400 mt-1">또는 URL 직접 입력:</p>
                    <input type="text" value={formData.thumbnailUrl} onChange={(e) => updateField("thumbnailUrl", e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="https://..." />
                  </div>
                </div>
              </div>
            </div>

            {/* 하단 버튼 */}
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
