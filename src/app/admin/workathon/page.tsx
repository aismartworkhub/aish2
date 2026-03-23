"use client";

import { useState } from "react";
import {
  CalendarDays, MapPin, Users, Download, Edit, CheckCircle,
  Clock, XCircle, Save, Plus, Trash2, ChevronRight,
  Eye, FileText, ArrowLeft, Search, LayoutList,
} from "lucide-react";
import { cn, calculateDDay } from "@/lib/utils";
import { COLLECTIONS, createDoc, upsertDoc, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "list" | "detail" | "participants";
type EventStatus = "DRAFT" | "OPEN" | "CLOSED" | "COMPLETED";
type RegStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "ATTENDED";

interface ScheduleItem {
  time: string;
  title: string;
  speaker: string | null;
}

interface Registration {
  id: string;
  name: string;
  email: string;
  phone: string;
  org: string;
  status: RegStatus;
  date: string;
}

interface EventData {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  venue: string;
  maxParticipants: number;
  status: EventStatus;
  schedule: ScheduleItem[];
  registrations: Registration[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: "초안",
  OPEN: "모집중",
  CLOSED: "마감",
  COMPLETED: "완료",
};

const EVENT_STATUS_COLORS: Record<EventStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  OPEN: "bg-green-100 text-green-700",
  CLOSED: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-blue-100 text-blue-700",
};

const REG_STATUS_LABELS: Record<RegStatus, string> = {
  PENDING: "대기",
  CONFIRMED: "확정",
  CANCELLED: "취소",
  ATTENDED: "출석",
};

const REG_STATUS_COLORS: Record<RegStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  ATTENDED: "bg-blue-100 text-blue-700",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminWorkathonPage() {
  const [activeTab, setActiveTab] = useState<Tab>("list");
  const { data: events, setData: setEvents, loading, error, refresh } = useFirestoreCollection<EventData>(COLLECTIONS.EVENTS);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const filteredEvents = events.filter(
    (e) =>
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ─── Event CRUD ──────────────────────────────────────────────────────────

  const selectEvent = (id: string, tab: Tab = "detail") => {
    setSelectedEventId(id);
    setSelectedIds([]);
    setActiveTab(tab);
  };

  const createEvent = async () => {
    const newEventData: Omit<EventData, "id"> = {
      title: "새 이벤트",
      description: "",
      eventDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      venue: "",
      maxParticipants: 50,
      status: "DRAFT",
      schedule: [],
      registrations: [],
    };
    try {
      const id = await createDoc(COLLECTIONS.EVENTS, newEventData);
      const newEvent: EventData = { id, ...newEventData };
      setEvents((prev) => [newEvent, ...prev]);
      selectEvent(id, "detail");
    } catch (e) {
      console.error(e);
      alert("이벤트 생성에 실패했습니다.");
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("이 이벤트를 삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.EVENTS, id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      if (selectedEventId === id) {
        setSelectedEventId(null);
        setActiveTab("list");
      }
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했습니다.");
    }
  };

  const updateEvent = (id: string, patch: Partial<EventData>) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  // ─── Schedule helpers ────────────────────────────────────────────────────

  const updateScheduleItem = (eventId: string, index: number, field: keyof ScheduleItem, value: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, schedule: e.schedule.map((s, i) => (i === index ? { ...s, [field]: value } : s)) }
          : e,
      ),
    );
  };

  const addScheduleItem = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, schedule: [...e.schedule, { time: "", title: "", speaker: "" }] } : e,
      ),
    );
  };

  const removeScheduleItem = (eventId: string, index: number) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, schedule: e.schedule.filter((_, i) => i !== index) } : e,
      ),
    );
  };

  const saveEvent = async () => {
    if (!selectedEvent) return;
    try {
      const { id, ...data } = selectedEvent;
      await upsertDoc(COLLECTIONS.EVENTS, id, data);
      setSaveMessage("저장되었습니다");
      setTimeout(() => setSaveMessage(""), 2000);
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다.");
    }
  };

  // ─── Registration helpers ────────────────────────────────────────────────

  const changeRegStatus = async (eventId: string, regId: string, status: RegStatus) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const updatedRegs = event.registrations.map((r) => (r.id === regId ? { ...r, status } : r));
    try {
      await upsertDoc(COLLECTIONS.EVENTS, eventId, { ...event, registrations: updatedRegs });
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, registrations: updatedRegs }
            : e,
        ),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const deleteRegistration = async (eventId: string, regId: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const updatedRegs = event.registrations.filter((r) => r.id !== regId);
    try {
      await upsertDoc(COLLECTIONS.EVENTS, eventId, { ...event, registrations: updatedRegs });
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, registrations: updatedRegs } : e,
        ),
      );
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했습니다.");
    }
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const toggleSelectAll = (regs: Registration[]) =>
    setSelectedIds(selectedIds.length === regs.length ? [] : regs.map((r) => r.id));

  const bulkConfirm = async (eventId: string) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const updatedRegs = event.registrations.map((r) =>
      selectedIds.includes(r.id) ? { ...r, status: "CONFIRMED" as RegStatus } : r
    );
    try {
      await upsertDoc(COLLECTIONS.EVENTS, eventId, { ...event, registrations: updatedRegs });
      setEvents((prev) =>
        prev.map((e) => e.id === eventId ? { ...e, registrations: updatedRegs } : e)
      );
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다.");
    }
  };

  const exportCSV = (event: EventData) => {
    const header = "이름,이메일,연락처,소속,상태,신청일";
    const rows = event.registrations.map(
      (r) => `${r.name},${r.email},${r.phone},${r.org},${REG_STATUS_LABELS[r.status]},${r.date}`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title}_참가자_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Derived data for selected event ─────────────────────────────────────

  const confirmed = selectedEvent?.registrations.filter((r) => r.status === "CONFIRMED").length ?? 0;
  const pending = selectedEvent?.registrations.filter((r) => r.status === "PENDING").length ?? 0;

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">이벤트 관리</h1>
          <p className="text-gray-500 mt-1">이벤트 생성, 일정 편집, 참가자를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("list")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === "list" ? "bg-primary-600 text-white" : "bg-white text-gray-600 border border-gray-200",
            )}
          >
            이벤트 목록
          </button>
          <button
            onClick={() => selectedEventId && setActiveTab("detail")}
            disabled={!selectedEventId}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === "detail" ? "bg-primary-600 text-white" : "bg-white text-gray-600 border border-gray-200",
              !selectedEventId && "opacity-40 cursor-not-allowed",
            )}
          >
            이벤트 상세
          </button>
          <button
            onClick={() => selectedEventId && setActiveTab("participants")}
            disabled={!selectedEventId}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === "participants"
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-600 border border-gray-200",
              !selectedEventId && "opacity-40 cursor-not-allowed",
            )}
          >
            참가자 관리{selectedEvent ? ` (${selectedEvent.registrations.length})` : ""}
          </button>
        </div>
      </div>

      {/* ───────── TAB: 이벤트 목록 ───────── */}
      {activeTab === "list" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="이벤트 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-72"
              />
            </div>
            <button
              onClick={createEvent}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              <Plus size={16} />
              새 이벤트
            </button>
          </div>

          {/* Event cards */}
          {filteredEvents.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <LayoutList size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">이벤트가 없습니다.</p>
            </div>
          )}

          <div className="grid gap-4">
            {filteredEvents.map((evt) => {
              const evtConfirmed = evt.registrations.filter((r) => r.status === "CONFIRMED").length;
              const dDay = calculateDDay(evt.eventDate);
              return (
                <div
                  key={evt.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-gray-900 text-lg truncate">{evt.title}</h3>
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0",
                            EVENT_STATUS_COLORS[evt.status],
                          )}
                        >
                          {EVENT_STATUS_LABELS[evt.status]}
                        </span>
                        <span className="text-xs font-semibold text-primary-600 shrink-0">{dDay}</span>
                      </div>
                      {evt.description && (
                        <p className="text-sm text-gray-500 mb-3 line-clamp-1">{evt.description}</p>
                      )}
                      <div className="flex items-center gap-5 text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={14} />
                          {evt.eventDate}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin size={14} />
                          {evt.venue || "미정"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users size={14} />
                          {evtConfirmed}/{evt.maxParticipants}명
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <FileText size={14} />
                          일정 {evt.schedule.length}개
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4 shrink-0">
                      <button
                        onClick={() => selectEvent(evt.id, "detail")}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary-600 transition-colors"
                        title="상세 보기"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => selectEvent(evt.id, "participants")}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary-600 transition-colors"
                        title="참가자 관리"
                      >
                        <Users size={16} />
                      </button>
                      <button
                        onClick={() => deleteEvent(evt.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ───────── TAB: 이벤트 상세 ───────── */}
      {activeTab === "detail" && selectedEvent && (
        <div className="space-y-6">
          {/* Back link */}
          <button
            onClick={() => setActiveTab("list")}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors"
          >
            <ArrowLeft size={14} />
            목록으로
          </button>

          {/* Hero banner */}
          <div className="bg-gradient-to-r from-purple-600 to-primary-600 rounded-2xl p-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <CalendarDays size={22} className="text-white/70" />
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-medium",
                  selectedEvent.status === "OPEN"
                    ? "bg-white/20 text-white"
                    : selectedEvent.status === "DRAFT"
                      ? "bg-white/10 text-white/70"
                      : "bg-white/15 text-white/80",
                )}
              >
                {EVENT_STATUS_LABELS[selectedEvent.status]}
              </span>
            </div>
            <h2 className="text-2xl font-bold mb-1">{selectedEvent.title}</h2>
            {selectedEvent.description && (
              <p className="text-white/70 text-sm mb-4">{selectedEvent.description}</p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
              <div>
                <p className="text-white/60 text-sm">D-Day</p>
                <p className="text-2xl font-bold">{calculateDDay(selectedEvent.eventDate)}</p>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-white/60" />
                <div>
                  <p className="text-white/60 text-sm">일시</p>
                  <p className="font-semibold">{selectedEvent.eventDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-white/60" />
                <div>
                  <p className="text-white/60 text-sm">장소</p>
                  <p className="font-semibold">{selectedEvent.venue || "미정"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users size={18} className="text-white/60" />
                <div>
                  <p className="text-white/60 text-sm">참가자</p>
                  <p className="font-semibold">
                    {confirmed}/{selectedEvent.maxParticipants}명
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Event info form */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4">이벤트 정보 수정</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
                <input
                  type="text"
                  value={selectedEvent.title}
                  onChange={(e) => updateEvent(selectedEvent.id, { title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">상태</label>
                <select
                  value={selectedEvent.status}
                  onChange={(e) => updateEvent(selectedEvent.id, { status: e.target.value as EventStatus })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  {Object.entries(EVENT_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">일시</label>
                <input
                  type="date"
                  value={selectedEvent.eventDate}
                  onChange={(e) => updateEvent(selectedEvent.id, { eventDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">장소</label>
                <input
                  type="text"
                  value={selectedEvent.venue}
                  onChange={(e) => updateEvent(selectedEvent.id, { venue: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">최대 참가자</label>
                <input
                  type="number"
                  value={selectedEvent.maxParticipants}
                  onChange={(e) =>
                    updateEvent(selectedEvent.id, { maxParticipants: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">설명</label>
                <textarea
                  value={selectedEvent.description}
                  onChange={(e) => updateEvent(selectedEvent.id, { description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={saveEvent}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
              >
                <Save size={16} />
                저장하기
              </button>
              {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
            </div>
          </div>

          {/* Schedule editor */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">행사 일정표</h3>
              <button
                onClick={() => addScheduleItem(selectedEvent.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors"
              >
                <Plus size={14} />
                추가
              </button>
            </div>
            {selectedEvent.schedule.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">일정 항목이 없습니다. 위의 추가 버튼을 클릭하세요.</p>
            )}
            <div className="space-y-3">
              {selectedEvent.schedule.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
                  <input
                    type="text"
                    value={item.time}
                    onChange={(e) => updateScheduleItem(selectedEvent.id, index, "time", e.target.value)}
                    placeholder="시간"
                    className="w-36 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateScheduleItem(selectedEvent.id, index, "title", e.target.value)}
                    placeholder="프로그램"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <input
                    type="text"
                    value={item.speaker || ""}
                    onChange={(e) => updateScheduleItem(selectedEvent.id, index, "speaker", e.target.value)}
                    placeholder="발표자"
                    className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <button
                    onClick={() => removeScheduleItem(selectedEvent.id, index)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            {selectedEvent.schedule.length > 0 && (
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={saveEvent}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
                >
                  <Save size={16} />
                  저장하기
                </button>
                {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────── TAB: 참가자 관리 ───────── */}
      {activeTab === "participants" && selectedEvent && (
        <div>
          {/* Back link */}
          <button
            onClick={() => setActiveTab("list")}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors mb-4"
          >
            <ArrowLeft size={14} />
            목록으로
          </button>

          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-lg font-bold text-gray-900">{selectedEvent.title}</h2>
            <ChevronRight size={16} className="text-gray-400" />
            <span className="text-lg text-gray-500">참가자 관리</span>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500">총 신청자</p>
              <p className="text-2xl font-bold text-gray-900">{selectedEvent.registrations.length}명</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500">확정</p>
              <p className="text-2xl font-bold text-green-600">{confirmed}명</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500">대기</p>
              <p className="text-2xl font-bold text-yellow-600">{pending}명</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500">정원</p>
              <p className="text-2xl font-bold text-gray-900">{selectedEvent.maxParticipants}명</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => exportCSV(selectedEvent)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors"
            >
              <Download size={16} />
              CSV 내보내기
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={() => bulkConfirm(selectedEvent.id)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100 transition-colors"
              >
                <CheckCircle size={16} />
                {selectedIds.length}명 확정
              </button>
            )}
          </div>

          {/* Table */}
          {selectedEvent.registrations.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
              <Users size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">아직 참가 신청이 없습니다.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.length === selectedEvent.registrations.length &&
                          selectedEvent.registrations.length > 0
                        }
                        onChange={() => toggleSelectAll(selectedEvent.registrations)}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">이름</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">이메일</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">연락처</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">소속</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvent.registrations.map((reg) => (
                    <tr key={reg.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(reg.id)}
                          onChange={() => toggleSelect(reg.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{reg.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{reg.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{reg.phone}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{reg.org}</td>
                      <td className="px-4 py-3">
                        <select
                          value={reg.status}
                          onChange={(e) =>
                            changeRegStatus(selectedEvent.id, reg.id, e.target.value as RegStatus)
                          }
                          className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer",
                            REG_STATUS_COLORS[reg.status],
                          )}
                        >
                          {Object.entries(REG_STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteRegistration(selectedEvent.id, reg.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* No event selected fallback for detail/participants tabs */}
      {(activeTab === "detail" || activeTab === "participants") && !selectedEvent && (
        <div className="text-center py-20 text-gray-400">
          <CalendarDays size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">이벤트를 먼저 선택해주세요.</p>
          <button
            onClick={() => setActiveTab("list")}
            className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            목록으로 이동
          </button>
        </div>
      )}
    </div>
  );
}
