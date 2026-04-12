"use client";

import { useState, useRef } from "react";
import {
  Plus, Search, Edit, Trash2, X, Save, ChevronUp, ChevronDown,
  Sparkles, Link, Upload, FileText,
} from "lucide-react";
import { cn, toDirectImageUrl } from "@/lib/utils";
import { COLLECTIONS, createDoc, upsertDoc, removeDoc, updateDocFields } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { useRunmoaContents } from "@/hooks/useRunmoaContents";
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
  education: { degree: string; institution: string; year: string }[];
  certifications: string[];
  contactEmail: string;
  socialLinks: { linkedin: string; youtube: string; instagram: string; github: string; personalSite: string };
  programs: (string | { title: string; url?: string })[];
}

interface InstructorForm {
  name: string; title: string; organization: string; bio: string; imageUrl: string;
  specialties: string[]; isActive: boolean; displayOrder: number;
  education: { degree: string; institution: string; year: string }[];
  certifications: string[]; contactEmail: string;
  socialLinks: { linkedin: string; youtube: string; instagram: string; github: string; personalSite: string };
  programs: (string | { title: string; url?: string })[];
}

const EMPTY_FORM: InstructorForm = {
  name: "", title: "", organization: "", bio: "", imageUrl: "",
  specialties: [], isActive: true, displayOrder: 0,
  education: [], certifications: [], contactEmail: "",
  socialLinks: { linkedin: "", youtube: "", instagram: "", github: "", personalSite: "" },
  programs: [],
};

const instructorSort = (a: Instructor, b: Instructor) => (a.displayOrder || 0) - (b.displayOrder || 0);

function formFromInstructor(item: Instructor): InstructorForm {
  return {
    name: item.name, title: item.title, organization: item.organization || "",
    bio: item.bio, imageUrl: item.imageUrl, specialties: item.specialties || [],
    isActive: item.isActive, displayOrder: item.displayOrder,
    education: item.education || [],
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
  const { data: programList } = useRunmoaContents({ limit: 100 });

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
  const [progUrlInput, setProgUrlInput] = useState("");

  // AI
  const [aiSource, setAiSource] = useState<"url" | "file" | "text">("url");
  const [aiUrl, setAiUrl] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileImageRef = useRef<HTMLInputElement>(null);

  // 프로필 이미지 리사이즈 → base64 (400x500, JPEG 80%)
  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("이미지 파일만 업로드 가능합니다.", "info"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_W = 400;
        const MAX_H = 500;
        let w = img.width;
        let h = img.height;
        if (w > MAX_W) { h = Math.round(h * (MAX_W / w)); w = MAX_W; }
        if (h > MAX_H) { w = Math.round(w * (MAX_H / h)); h = MAX_H; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setForm((prev) => ({ ...prev, imageUrl: dataUrl }));
        toast("이미지가 업로드되었습니다.", "success");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    if (profileImageRef.current) profileImageRef.current.value = "";
  };

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
    const saveData = { ...form };
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
  const addTag = (field: "specialties" | "certifications", value: string, setter: (v: string) => void) => {
    const trimmed = value.trim();
    if (trimmed && !form[field].includes(trimmed)) {
      setForm({ ...form, [field]: [...form[field], trimmed] });
      setter("");
    }
  };
  const removeTag = (field: "specialties" | "certifications", value: string) => {
    setForm({ ...form, [field]: form[field].filter((x) => x !== value) });
  };

  const addProgram = () => {
    const trimmedTitle = progInput.trim();
    if (!trimmedTitle) return;
    const url = progUrlInput.trim() || undefined;
    
    // Check if already exists
    const exists = form.programs.some(p => 
      typeof p === 'string' ? p === trimmedTitle : p.title === trimmedTitle
    );
    
    if (!exists) {
      setForm({
        ...form,
        programs: [...form.programs, url ? { title: trimmedTitle, url } : trimmedTitle]
      });
      setProgInput("");
      setProgUrlInput("");
    }
  };

  const removeProgram = (titleToRemove: string) => {
    setForm({
      ...form,
      programs: form.programs.filter((p) => {
        const title = typeof p === 'string' ? p : p.title;
        return title !== titleToRemove;
      })
    });
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button onClick={() => moveOrder(idx, 1)} disabled={idx === sorted.length - 1}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={14} /></button>
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

              {/* Profile Image */}
              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <label className="block text-sm font-semibold text-gray-800">프로필 이미지</label>
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 rounded-full border-2 border-gray-200 bg-gray-50 overflow-hidden shrink-0 flex items-center justify-center">
                    {form.imageUrl.trim() ? (
                      <img src={form.imageUrl.startsWith("data:") ? form.imageUrl : toDirectImageUrl(form.imageUrl)} alt="미리보기" className="w-full h-full object-cover object-top" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-3xl text-gray-300">{form.name?.[0] || "?"}</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input ref={profileImageRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
                    <button type="button" onClick={() => profileImageRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      <Upload size={14} />사진 업로드
                    </button>
                    <p className="text-xs text-gray-400">이미지는 400x500px로 리사이즈 후 저장됩니다 (인증 불필요)</p>
                    <input value={form.imageUrl.startsWith("data:") ? "(업로드된 이미지)" : form.imageUrl}
                      onChange={(e) => { if (!form.imageUrl.startsWith("data:")) setForm({ ...form, imageUrl: e.target.value }); }}
                      readOnly={form.imageUrl.startsWith("data:")}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 read-only:bg-gray-50 read-only:text-gray-400"
                      placeholder="또는 URL 직접 입력 (https://...)" />
                    {form.imageUrl.trim() && (
                      <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })}
                        className="text-xs text-red-500 hover:underline">이미지 제거</button>
                    )}
                  </div>
                </div>
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

              {/* Education */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">학력</label>
                  <button onClick={addEducation} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ 추가</button>
                </div>
                <div className="space-y-2">
                  {form.education.map((edu, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <input value={edu.degree} onChange={(e) => updateEducation(idx, "degree", e.target.value)}
                        className="sm:w-28 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" placeholder="학위" />
                      <input value={edu.institution} onChange={(e) => updateEducation(idx, "institution", e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" placeholder="학교/기관" />
                      <input value={edu.year} onChange={(e) => updateEducation(idx, "year", e.target.value)}
                        className="sm:w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" placeholder="연도" />
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
                  <div className="flex-1 flex flex-col gap-2">
                    <select
                      value={progInput}
                      onChange={(e) => setProgInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                      <option value="">프로그램 선택...</option>
                      {programList?.map((p) => (
                        <option key={p.content_id || p.title} value={p.title}>{p.title}</option>
                      ))}
                    </select>
                    <input
                      value={progUrlInput}
                      onChange={(e) => setProgUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addProgram())}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="CTA 외부 링크 URL (선택사항)"
                    />
                  </div>
                  <button onClick={addProgram} className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 self-start mt-[1px]">추가</button>
                </div>
                <div className="flex flex-col gap-1">
                  {form.programs.map((p, idx) => {
                    const isObj = typeof p !== 'string';
                    const title = isObj ? p.title : p;
                    const url = isObj ? p.url : null;
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-md">
                        <span className="font-medium">{title}</span>
                        {url && <span className="text-xs text-green-600 truncate max-w-[200px] border-l border-green-200 pl-2 ml-1">{url}</span>}
                        <button onClick={() => removeProgram(title)} className="text-green-400 hover:text-green-700 ml-auto">&times;</button>
                      </div>
                    );
                  })}
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
