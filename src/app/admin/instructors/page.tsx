"use client";

import { useState, useRef } from "react";
import {
  Plus, Search, Edit, Trash2, X, Save, ChevronUp, ChevronDown,
  Sparkles, Link, Upload, FileText,
} from "lucide-react";
import { cn, toDirectImageUrl, extractGoogleDriveFileId } from "@/lib/utils";
import { getDriveAccessToken, shareFilePublic } from "@/lib/google-drive";
import { COLLECTIONS, createDoc, upsertDoc, removeDoc, updateDocFields } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { useToast } from "@/components/ui/Toast";
import {
  getGeminiApiKey, saveGeminiApiKey,
  analyzeInstructorUrl, analyzeInstructorFile, analyzeInstructorText,
  type GeminiInstructorResult,
} from "@/lib/gemini";

interface Instructor {
  id: string;
  name: string;
  title: string;
  organization: string;
  bio: string;
  imageUrl: string;
  specialties: string[];
  isActive: boolean;
  displayOrder: number;
  experience: { period: string; description: string }[];
  education: { degree: string; institution: string; year: string }[];
  certifications: string[];
  contactEmail: string;
  socialLinks: { linkedin: string; youtube: string; instagram: string; github: string; personalSite: string };
  programs: string[];
}

interface InstructorForm {
  name: string; title: string; organization: string; bio: string; imageUrl: string;
  specialties: string[]; isActive: boolean; displayOrder: number;
  experience: { period: string; description: string }[];
  education: { degree: string; institution: string; year: string }[];
  certifications: string[]; contactEmail: string;
  socialLinks: { linkedin: string; youtube: string; instagram: string; github: string; personalSite: string };
  programs: string[];
}

const EMPTY_FORM: InstructorForm = {
  name: "", title: "", organization: "", bio: "", imageUrl: "",
  specialties: [], isActive: true, displayOrder: 0,
  experience: [], education: [], certifications: [], contactEmail: "",
  socialLinks: { linkedin: "", youtube: "", instagram: "", github: "", personalSite: "" },
  programs: [],
};

const instructorSort = (a: Instructor, b: Instructor) => (a.displayOrder || 0) - (b.displayOrder || 0);

function formFromInstructor(item: Instructor): InstructorForm {
  return {
    name: item.name, title: item.title, organization: item.organization || "",
    bio: item.bio, imageUrl: item.imageUrl, specialties: item.specialties || [],
    isActive: item.isActive, displayOrder: item.displayOrder,
    experience: item.experience || [], education: item.education || [],
    certifications: item.certifications || [], contactEmail: item.contactEmail || "",
    socialLinks: {
      linkedin: item.socialLinks?.linkedin || "", youtube: item.socialLinks?.youtube || "",
      instagram: item.socialLinks?.instagram || "", github: item.socialLinks?.github || "",
      personalSite: item.socialLinks?.personalSite || "",
    },
    programs: item.programs || [],
  };
}

export default function AdminInstructorsPage() {
  const { toast } = useToast();
  const { data: items, setData: setItems, loading, error, refresh } =
    useFirestoreCollection<Instructor>(COLLECTIONS.INSTRUCTORS, instructorSort);

  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<InstructorForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // tag inputs
  const [specInput, setSpecInput] = useState("");
  const [certInput, setCertInput] = useState("");
  const [progInput, setProgInput] = useState("");

  // AI
  const [aiSource, setAiSource] = useState<"url" | "file" | "text">("url");
  const [aiUrl, setAiUrl] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.organization || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Modal open/close
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setIsCreating(true);
    setSpecInput(""); setCertInput(""); setProgInput("");
    setAiUrl(""); setAiText("");
    setShowModal(true);
  };
  const openEdit = (item: Instructor) => {
    setForm(formFromInstructor(item));
    setEditId(item.id);
    setIsCreating(false);
    setSpecInput(""); setCertInput(""); setProgInput("");
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
    setIsCreating(false);
  };

  // CRUD
  const handleSave = async () => {
    if (!form.name.trim()) { toast("이름을 입력해 주세요.", "info"); return; }
    setSaving(true);
    const saveData = { ...form, imageUrl: toDirectImageUrl(form.imageUrl) };

    // Google Drive 이미지를 자동으로 공개 공유 설정
    const driveFileId = extractGoogleDriveFileId(form.imageUrl);
    if (driveFileId) {
      try {
        const token = await getDriveAccessToken();
        await shareFilePublic(token, driveFileId);
      } catch {
        // 공유 설정 실패해도 저장은 진행 (이미 공유된 경우 등)
      }
    }

    try {
      if (editId) {
        await upsertDoc(COLLECTIONS.INSTRUCTORS, editId, saveData);
        setItems((prev) => prev.map((i) => i.id === editId ? { ...i, ...saveData } : i));
      } else {
        const order = items.length;
        const id = await createDoc(COLLECTIONS.INSTRUCTORS, { ...saveData, displayOrder: order });
        setItems((prev) => [...prev, { id, ...saveData, displayOrder: order }]);
      }
      closeModal();
      toast("저장되었습니다.", "success");
    } catch {
      toast("저장에 실패했습니다.", "error");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.INSTRUCTORS, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast("삭제에 실패했습니다.", "error");
    }
  };

  const toggleActive = async (item: Instructor) => {
    try {
      await updateDocFields(COLLECTIONS.INSTRUCTORS, item.id, { isActive: !item.isActive });
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isActive: !i.isActive } : i));
    } catch {
      toast("상태 변경에 실패했습니다.", "error");
    }
  };

  const moveOrder = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const sorted = [...items].sort(instructorSort);
    const a = sorted[index];
    const b = sorted[newIndex];
    const aOrder = a.displayOrder ?? index;
    const bOrder = b.displayOrder ?? newIndex;
    try {
      await Promise.all([
        upsertDoc(COLLECTIONS.INSTRUCTORS, a.id, { ...a, displayOrder: bOrder }),
        upsertDoc(COLLECTIONS.INSTRUCTORS, b.id, { ...b, displayOrder: aOrder }),
      ]);
      setItems((prev) => prev.map((i) => {
        if (i.id === a.id) return { ...i, displayOrder: bOrder };
        if (i.id === b.id) return { ...i, displayOrder: aOrder };
        return i;
      }));
    } catch {
      toast("순서 변경에 실패했습니다.", "error");
    }
  };

  // Tag helpers
  const addTag = (field: "specialties" | "certifications" | "programs", value: string, setter: (v: string) => void) => {
    const trimmed = value.trim();
    if (trimmed && !form[field].includes(trimmed)) {
      setForm({ ...form, [field]: [...form[field], trimmed] });
      setter("");
    }
  };
  const removeTag = (field: "specialties" | "certifications" | "programs", value: string) => {
    setForm({ ...form, [field]: form[field].filter((x) => x !== value) });
  };

  // Experience / Education helpers
  const addExperience = () => setForm({ ...form, experience: [...form.experience, { period: "", description: "" }] });
  const removeExperience = (idx: number) => setForm({ ...form, experience: form.experience.filter((_, i) => i !== idx) });
  const updateExperience = (idx: number, field: "period" | "description", value: string) => {
    const updated = form.experience.map((e, i) => i === idx ? { ...e, [field]: value } : e);
    setForm({ ...form, experience: updated });
  };

  const addEducation = () => setForm({ ...form, education: [...form.education, { degree: "", institution: "", year: "" }] });
  const removeEducation = (idx: number) => setForm({ ...form, education: form.education.filter((_, i) => i !== idx) });
  const updateEducation = (idx: number, field: "degree" | "institution" | "year", value: string) => {
    const updated = form.education.map((e, i) => i === idx ? { ...e, [field]: value } : e);
    setForm({ ...form, education: updated });
  };

  // AI analysis
  const mergeAiResult = (result: GeminiInstructorResult) => {
    setForm((prev) => ({
      ...prev,
      ...(result.name ? { name: result.name } : {}),
      ...(result.title ? { title: result.title } : {}),
      ...(result.organization ? { organization: result.organization } : {}),
      ...(result.bio ? { bio: result.bio } : {}),
      ...(result.contactEmail ? { contactEmail: result.contactEmail } : {}),
      ...(result.specialties?.length ? { specialties: result.specialties } : {}),
      ...(result.certifications?.length ? { certifications: result.certifications } : {}),
      ...(result.experience?.length ? { experience: result.experience.map((e) => ({ period: e.period || "", description: e.description || "" })) } : {}),
      ...(result.education?.length ? { education: result.education.map((e) => ({ degree: e.degree || "", institution: e.institution || "", year: e.year || "" })) } : {}),
      ...(result.socialLinks ? {
        socialLinks: {
          linkedin: result.socialLinks.linkedin || prev.socialLinks.linkedin,
          youtube: result.socialLinks.youtube || prev.socialLinks.youtube,
          instagram: result.socialLinks.instagram || prev.socialLinks.instagram,
          github: result.socialLinks.github || prev.socialLinks.github,
          personalSite: result.socialLinks.personalSite || prev.socialLinks.personalSite,
        },
      } : {}),
    }));
  };

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const handleAiAnalyze = async () => {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) { setShowApiKeyPrompt(true); return; }
    setAiLoading(true);
    try {
      let result: GeminiInstructorResult;
      if (aiSource === "url") {
        if (!aiUrl.trim()) { toast("URL을 입력해 주세요.", "info"); setAiLoading(false); return; }
        result = await analyzeInstructorUrl(apiKey, aiUrl.trim());
      } else if (aiSource === "file") {
        const file = fileInputRef.current?.files?.[0];
        if (!file) { toast("파일을 선택해 주세요.", "info"); setAiLoading(false); return; }
        const base64 = await readFileAsBase64(file);
        result = await analyzeInstructorFile(apiKey, base64, file.type);
      } else {
        if (!aiText.trim()) { toast("텍스트를 입력해 주세요.", "info"); setAiLoading(false); return; }
        result = await analyzeInstructorText(apiKey, aiText.trim());
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
    } finally { setAiLoading(false); }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    await saveGeminiApiKey(apiKeyInput.trim());
    setShowApiKeyPrompt(false);
    setApiKeyInput("");
    toast("Gemini API 키가 저장되었습니다.", "success");
    handleAiAnalyze();
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  const sorted = [...filtered].sort(instructorSort);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">강사 관리</h1>
          <p className="text-gray-500 mt-1">강사 정보를 관리합니다. AI 자동분석을 지원합니다.</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
          <Plus size={18} />새 강사 등록
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="강사 이름, 직함, 소속으로 검색..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.length === 0 && (
          <div className="col-span-full p-12 text-center text-gray-400 bg-white rounded-xl border">등록된 강사가 없습니다.</div>
        )}
        {sorted.map((item) => {
          const idx = sorted.indexOf(item);
          return (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl font-bold overflow-hidden shrink-0">
                    {item.imageUrl
                      ? <img src={toDirectImageUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : item.name[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-500">{item.title}</p>
                    {item.organization && <p className="text-xs text-gray-400">{item.organization}</p>}
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <div className="flex flex-col">
                    <button onClick={() => moveOrder(idx, -1)} disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button onClick={() => moveOrder(idx, 1)} disabled={idx === sorted.length - 1}
                      className="p-0.5 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={14} /></button>
                  </div>
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><Edit size={14} /></button>
                  <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">{item.bio || "소개 없음"}</p>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {(item.specialties || []).slice(0, 4).map((s) => (
                    <span key={s} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
                <button onClick={() => toggleActive(item)}
                  className={cn("text-xs px-2 py-1 rounded-full", item.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500")}>
                  {item.isActive ? "활성" : "비활성"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* API Key Prompt */}
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
              placeholder="AIza..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowApiKeyPrompt(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{isCreating ? "새 강사 등록" : "강사 수정"}</h2>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* AI Section */}
              {isCreating && (
                <div className="rounded-xl border border-primary-100 bg-primary-50/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary-700 font-semibold text-sm">
                    <Sparkles size={16} />AI 자동분석
                  </div>
                  <div className="flex gap-2">
                    {([["url", Link, "URL"], ["file", Upload, "파일"], ["text", FileText, "텍스트"]] as const).map(([key, Icon, label]) => (
                      <button key={key} onClick={() => setAiSource(key)}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          aiSource === key ? "bg-primary-600 text-white" : "bg-white text-gray-600 border border-gray-200")}>
                        <Icon size={14} />{label}
                      </button>
                    ))}
                  </div>
                  {aiSource === "url" && (
                    <div className="flex gap-2">
                      <input type="url" value={aiUrl} onChange={(e) => setAiUrl(e.target.value)}
                        placeholder="https://example.com/instructor-profile"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                      <button onClick={handleAiAnalyze} disabled={aiLoading}
                        className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap">
                        {aiLoading ? "분석중..." : "분석"}
                      </button>
                    </div>
                  )}
                  {aiSource === "file" && (
                    <div className="flex gap-2">
                      <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.html"
                        className="flex-1 text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-primary-100 file:text-primary-700 file:text-xs file:font-medium" />
                      <button onClick={handleAiAnalyze} disabled={aiLoading}
                        className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap">
                        {aiLoading ? "분석중..." : "분석"}
                      </button>
                    </div>
                  )}
                  {aiSource === "text" && (
                    <div className="space-y-2">
                      <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={4}
                        placeholder="강사 이력서, 소개글, 프로필 텍스트를 붙여넣으세요..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
                      <button onClick={handleAiAnalyze} disabled={aiLoading}
                        className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap">
                        {aiLoading ? "분석중..." : "분석"}
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">URL, 이력서 파일, 또는 소개 텍스트를 입력하면 AI가 강사 정보를 자동으로 추출합니다.</p>
                </div>
              )}

              {/* Basic fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="강사 이름" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">직함</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="예: AI 전문 강사" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">소속</label>
                  <input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="소속 기관/회사" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                  <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="contact@example.com" />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">프로필 이미지 URL</label>
                <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="https://... 또는 Google Drive 공유 링크" />
                {form.imageUrl.trim() && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full border border-gray-200 bg-gray-50 overflow-hidden shrink-0">
                      <img src={toDirectImageUrl(form.imageUrl)} alt="미리보기" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <p className="text-xs text-gray-400">미리보기 -- Google Drive 링크는 자동 변환됩니다.</p>
                  </div>
                )}
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">소개</label>
                <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                  placeholder="강사 소개" />
              </div>

              {/* Specialties */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">전문 분야</label>
                <div className="flex gap-2 mb-2">
                  <input value={specInput} onChange={(e) => setSpecInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag("specialties", specInput, setSpecInput))}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="분야 입력 후 Enter" />
                  <button onClick={() => addTag("specialties", specInput, setSpecInput)} className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">추가</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {form.specialties.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full">
                      {s} <button onClick={() => removeTag("specialties", s)} className="text-primary-400 hover:text-primary-700">&times;</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Experience */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">경력</label>
                  <button onClick={addExperience} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ 추가</button>
                </div>
                <div className="space-y-2">
                  {form.experience.map((exp, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input value={exp.period} onChange={(e) => updateExperience(idx, "period", e.target.value)}
                        className="w-36 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" placeholder="2020 - 현재" />
                      <input value={exp.description} onChange={(e) => updateExperience(idx, "description", e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" placeholder="직책/역할, 기관" />
                      <button onClick={() => removeExperience(idx)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Education */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">학력</label>
                  <button onClick={addEducation} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ 추가</button>
                </div>
                <div className="space-y-2">
                  {form.education.map((edu, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input value={edu.degree} onChange={(e) => updateEducation(idx, "degree", e.target.value)}
                        className="w-28 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" placeholder="학위" />
                      <input value={edu.institution} onChange={(e) => updateEducation(idx, "institution", e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" placeholder="학교/기관" />
                      <input value={edu.year} onChange={(e) => updateEducation(idx, "year", e.target.value)}
                        className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" placeholder="연도" />
                      <button onClick={() => removeEducation(idx)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Certifications */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">자격증</label>
                <div className="flex gap-2 mb-2">
                  <input value={certInput} onChange={(e) => setCertInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag("certifications", certInput, setCertInput))}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="자격증 입력 후 Enter" />
                  <button onClick={() => addTag("certifications", certInput, setCertInput)} className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">추가</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {form.certifications.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                      {c} <button onClick={() => removeTag("certifications", c)} className="text-blue-400 hover:text-blue-700">&times;</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Programs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">담당 프로그램</label>
                <div className="flex gap-2 mb-2">
                  <input value={progInput} onChange={(e) => setProgInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag("programs", progInput, setProgInput))}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="프로그램 입력 후 Enter" />
                  <button onClick={() => addTag("programs", progInput, setProgInput)} className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">추가</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {form.programs.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
                      {p} <button onClick={() => removeTag("programs", p)} className="text-green-400 hover:text-green-700">&times;</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Social Links */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">소셜 링크</label>
                <div className="space-y-2">
                  {([
                    ["linkedin", "LinkedIn URL"],
                    ["youtube", "YouTube URL"],
                    ["instagram", "Instagram URL"],
                    ["github", "GitHub URL"],
                    ["personalSite", "개인사이트 URL"],
                  ] as const).map(([key, placeholder]) => (
                    <input key={key} value={form.socialLinks[key]}
                      onChange={(e) => setForm({ ...form, socialLinks: { ...form.socialLinks, [key]: e.target.value } })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder={placeholder} />
                  ))}
                </div>
              </div>

              {/* Active + Order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">활성 상태</label>
                  <button onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={cn("relative w-10 h-5 rounded-full transition-colors",
                      form.isActive ? "bg-primary-600" : "bg-gray-300")}>
                    <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                      form.isActive && "translate-x-5")} />
                  </button>
                  <span className="text-xs text-gray-500">{form.isActive ? "활성" : "비활성"}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">표시 순서</label>
                  <input type="number" value={form.displayOrder}
                    onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
              <button onClick={handleSave} disabled={!form.name.trim() || saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Save size={16} />
                {saving ? "저장중..." : isCreating ? "등록" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
