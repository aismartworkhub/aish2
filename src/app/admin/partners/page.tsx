"use client";

import { useState } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Building2,
  GripVertical,
  ExternalLink,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTIONS, createDoc, upsertDoc, updateDocFields, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";

// ─── Types ───────────────────────────────────────────────────────────────────

type PartnerCategory = "정부기관" | "대학교" | "기업" | "스타트업" | "기타";

interface Partner {
  id: string;
  name: string;
  logoUrl: string;
  category: PartnerCategory;
  website: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
}

type ApplicationStatus = "신규" | "검토중" | "승인" | "거절";

interface PartnerApplication {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
  status: ApplicationStatus;
  date: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES: PartnerCategory[] = ["정부기관", "대학교", "기업", "스타트업", "기타"];

const CATEGORY_COLORS: Record<PartnerCategory, string> = {
  정부기관: "bg-blue-100 text-blue-700",
  대학교: "bg-purple-100 text-purple-700",
  기업: "bg-emerald-100 text-emerald-700",
  스타트업: "bg-orange-100 text-orange-700",
  기타: "bg-gray-100 text-gray-600",
};

const STATUS_CONFIG: Record<ApplicationStatus, { color: string; icon: React.ElementType }> = {
  신규: { color: "bg-red-100 text-red-700", icon: Mail },
  검토중: { color: "bg-yellow-100 text-yellow-700", icon: Clock },
  승인: { color: "bg-green-100 text-green-700", icon: CheckCircle },
  거절: { color: "bg-gray-100 text-gray-600", icon: XCircle },
};

const APPLICATION_STATUSES: ApplicationStatus[] = ["신규", "검토중", "승인", "거절"];


const EMPTY_PARTNER: Omit<Partner, "id"> = {
  name: "",
  logoUrl: "",
  category: "기타",
  website: "",
  description: "",
  isActive: true,
  displayOrder: 0,
};


// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminPartnersPage() {
  const [activeTab, setActiveTab] = useState<"partners" | "applications">("partners");
  const [saving, setSaving] = useState(false);

  // ── Partners state ──
  const { data: partners, setData: setPartners, loading: loadingPartners } = useFirestoreCollection<Partner>(COLLECTIONS.PARTNERS);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<PartnerCategory | "ALL">("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<Omit<Partner, "id">>(EMPTY_PARTNER);

  // ── Applications state ──
  const { data: applications, setData: setApplications, loading: loadingApps } = useFirestoreCollection<PartnerApplication>(COLLECTIONS.PARTNER_APPLICATIONS);
  const [appSearch, setAppSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "ALL">("ALL");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  const loading = loadingPartners || loadingApps;

  // ── Partners CRUD ──
  const filteredPartners = partners.filter((p) => {
    const matchSearch = !partnerSearch || p.name.includes(partnerSearch) || p.description.includes(partnerSearch);
    const matchCategory = categoryFilter === "ALL" || p.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const openCreateModal = () => {
    setEditingPartner(null);
    setFormData({ ...EMPTY_PARTNER, displayOrder: partners.length + 1 });
    setIsModalOpen(true);
  };

  const openEditModal = (partner: Partner) => {
    setEditingPartner(partner);
    const { id, ...rest } = partner;
    setFormData(rest);
    setIsModalOpen(true);
  };

  const handleSavePartner = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      if (editingPartner) {
        await upsertDoc(COLLECTIONS.PARTNERS, editingPartner.id, formData);
        setPartners((prev) => prev.map((p) => p.id === editingPartner.id ? { ...p, ...formData } : p));
      } else {
        const id = await createDoc(COLLECTIONS.PARTNERS, { ...formData, displayOrder: partners.length + 1 });
        setPartners((prev) => [...prev, { id, ...formData }]);
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const deletePartner = async (id: string) => {
    if (!confirm("이 파트너사를 삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.PARTNERS, id);
      setPartners((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했습니다.");
    }
  };

  const togglePartnerActive = async (id: string) => {
    const partner = partners.find((p) => p.id === id);
    if (!partner) return;
    const newActive = !partner.isActive;
    try {
      await updateDocFields(COLLECTIONS.PARTNERS, id, { isActive: newActive });
      setPartners((prev) => prev.map((p) => p.id === id ? { ...p, isActive: newActive } : p));
    } catch (e) {
      console.error(e);
    }
  };

  // ── Applications ──
  const filteredApplications = applications.filter((a) => {
    const matchSearch =
      !appSearch ||
      a.companyName.includes(appSearch) ||
      a.contactName.includes(appSearch) ||
      a.email.includes(appSearch);
    const matchStatus = statusFilter === "ALL" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const selectedApp = applications.find((a) => a.id === selectedAppId) ?? null;

  const changeAppStatus = async (id: string, status: ApplicationStatus) => {
    try {
      await updateDocFields(COLLECTIONS.PARTNER_APPLICATIONS, id, { status });
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    } catch (e) {
      console.error(e);
      alert("상태 변경에 실패했습니다.");
    }
  };

  const deleteApplication = async (id: string) => {
    if (!confirm("이 문의를 삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.PARTNER_APPLICATIONS, id);
      setApplications((prev) => prev.filter((a) => a.id !== id));
      if (selectedAppId === id) setSelectedAppId(null);
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했습니다.");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">파트너 관리</h1>
        <p className="text-gray-500 mt-1">파트너사를 관리하고 협력 문의를 처리합니다.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("partners")}
          className={cn(
            "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "partners"
              ? "border-primary-600 text-primary-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <Building2 size={16} className="inline-block mr-1.5 -mt-0.5" />
          파트너사 관리
        </button>
        <button
          onClick={() => setActiveTab("applications")}
          className={cn(
            "px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px relative",
            activeTab === "applications"
              ? "border-primary-600 text-primary-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <Mail size={16} className="inline-block mr-1.5 -mt-0.5" />
          협력 문의
          {applications.filter((a) => a.status === "신규").length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
              {applications.filter((a) => a.status === "신규").length}
            </span>
          )}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: Partners Management                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "partners" && (
        <div className="space-y-5">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="파트너사 검색..."
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as PartnerCategory | "ALL")}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
            >
              <option value="ALL">전체 카테고리</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={openCreateModal}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <Plus size={16} />
              파트너사 추가
            </button>
          </div>

          {/* Grid */}
          {filteredPartners.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Building2 size={48} className="mx-auto mb-3 opacity-40" />
              <p>등록된 파트너사가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPartners
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((partner) => (
                  <div
                    key={partner.id}
                    className={cn(
                      "bg-white rounded-xl border border-gray-200 p-5 group relative transition-shadow hover:shadow-md",
                      !partner.isActive && "opacity-60"
                    )}
                  >
                    {/* Drag handle + order badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1 text-gray-300">
                      <GripVertical size={14} />
                      <span className="text-xs font-mono">{partner.displayOrder}</span>
                    </div>

                    {/* Action buttons */}
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => togglePartnerActive(partner.id)}
                        title={partner.isActive ? "비활성화" : "활성화"}
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      >
                        {partner.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        onClick={() => openEditModal(partner)}
                        title="수정"
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-primary-600"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => deletePartner(partner.id)}
                        title="삭제"
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Logo */}
                    <div className="w-20 h-20 mx-auto mt-4 mb-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                      {partner.logoUrl ? (
                        <img
                          src={partner.logoUrl}
                          alt={partner.name}
                          className="w-full h-full object-contain p-2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <Building2 size={28} className={cn("text-gray-300", partner.logoUrl && "hidden")} />
                    </div>

                    {/* Info */}
                    <div className="text-center">
                      <h3 className="font-semibold text-gray-900 text-sm">{partner.name}</h3>
                      <span
                        className={cn(
                          "inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                          CATEGORY_COLORS[partner.category]
                        )}
                      >
                        {partner.category}
                      </span>
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{partner.description}</p>
                      {partner.website && (
                        <a
                          href={partner.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 mt-2"
                        >
                          <ExternalLink size={12} />
                          웹사이트
                        </a>
                      )}
                    </div>

                    {/* Active badge */}
                    {!partner.isActive && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">비활성</span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* ── Create / Edit Modal ── */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setIsModalOpen(false)} />
              <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">
                    {editingPartner ? "파트너사 수정" : "새 파트너사 추가"}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-md hover:bg-gray-100 text-gray-400">
                    <X size={20} />
                  </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      파트너사명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                      placeholder="파트너사 이름"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value as PartnerCategory }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Logo URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">로고 URL</label>
                    <input
                      type="text"
                      value={formData.logoUrl}
                      onChange={(e) => setFormData((f) => ({ ...f, logoUrl: e.target.value }))}
                      placeholder="/images/partners/logo.png"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                    />
                  </div>

                  {/* Website */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">웹사이트</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData((f) => ({ ...f, website: e.target.value }))}
                      placeholder="https://example.com"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                      rows={3}
                      placeholder="파트너사에 대한 설명을 입력하세요."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 resize-none"
                    />
                  </div>

                  {/* Display Order */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">표시 순서</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.displayOrder}
                      onChange={(e) => setFormData((f) => ({ ...f, displayOrder: Number(e.target.value) }))}
                      className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                    />
                  </div>

                  {/* Active toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData((f) => ({ ...f, isActive: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                    />
                    <span className="text-sm text-gray-700">사이트에 표시</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSavePartner}
                    disabled={!formData.name.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save size={16} />
                    {editingPartner ? "수정" : "추가"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: Partner Applications / Inquiries                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "applications" && (
        <div className="space-y-5">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">Google Calendar &amp; Email 연동 안내</p>
              <p className="mt-0.5 text-blue-600">
                관리자 설정에서 Google API 키를 설정하면, 협력 문의 승인 시 자동으로 Google Calendar 일정을 생성하고 이메일 알림을 전송할 수 있습니다.
                <span className="font-medium"> 설정 &gt; API 연동</span>에서 구성하세요.
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="회사명, 담당자, 이메일 검색..."
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "ALL")}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
            >
              <option value="ALL">전체 상태</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* List + Detail panel */}
          <div className="flex gap-5">
            {/* List */}
            <div className={cn("flex-1 space-y-2", selectedApp && "max-w-[55%]")}>
              {filteredApplications.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Mail size={48} className="mx-auto mb-3 opacity-40" />
                  <p>접수된 협력 문의가 없습니다.</p>
                </div>
              ) : (
                filteredApplications.map((app) => {
                  const StatusIcon = STATUS_CONFIG[app.status].icon;
                  return (
                    <div
                      key={app.id}
                      onClick={() => setSelectedAppId(app.id)}
                      className={cn(
                        "bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-sm",
                        selectedAppId === app.id
                          ? "border-primary-600 ring-1 ring-primary-600/20"
                          : "border-gray-200"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 text-sm truncate">{app.companyName}</h3>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                                STATUS_CONFIG[app.status].color
                              )}
                            >
                              <StatusIcon size={12} />
                              {app.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {app.contactName} &middot; {app.email}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-1">{app.message}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">{app.date}</span>
                          <ChevronRight size={14} className="text-gray-300" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Detail panel */}
            {selectedApp && (
              <div className="w-[45%] shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Detail header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">{selectedApp.companyName}</h3>
                  <button
                    onClick={() => setSelectedAppId(null)}
                    className="p-1 rounded-md hover:bg-gray-100 text-gray-400"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="px-5 py-5 space-y-5">
                  {/* Status */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">상태 변경</label>
                    <div className="flex flex-wrap gap-1.5">
                      {APPLICATION_STATUSES.map((s) => {
                        const SIcon = STATUS_CONFIG[s].icon;
                        return (
                          <button
                            key={s}
                            onClick={() => changeAppStatus(selectedApp.id, s)}
                            className={cn(
                              "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                              selectedApp.status === s
                                ? cn(STATUS_CONFIG[s].color, "border-current")
                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                            )}
                          >
                            <SIcon size={12} />
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 size={14} className="text-gray-400" />
                      <span className="text-gray-700">{selectedApp.companyName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle size={14} className="text-gray-400" />
                      <span className="text-gray-700">{selectedApp.contactName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail size={14} className="text-gray-400" />
                      <a href={`mailto:${selectedApp.email}`} className="text-primary-600 hover:underline">
                        {selectedApp.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={14} className="text-gray-400" />
                      <span className="text-gray-700">{selectedApp.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={14} className="text-gray-400" />
                      <span className="text-gray-700">{selectedApp.date}</span>
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">문의 내용</label>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
                      {selectedApp.message}
                    </div>
                  </div>

                  {/* Delete */}
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={() => deleteApplication(selectedApp.id)}
                      className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                      이 문의 삭제
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
