"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, ImageIcon } from "lucide-react";
import { COLLECTIONS, createDoc, upsertDoc, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { toDirectImageUrl } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface Instructor {
  id: string;
  name: string;
  title: string;
  bio: string;
  imageUrl: string;
  specialties: string[];
  isActive: boolean;
  displayOrder: number;
}

const EMPTY_FORM: Omit<Instructor, "id"> = {
  name: "", title: "", bio: "", imageUrl: "", specialties: [], isActive: true, displayOrder: 0,
};

const instructorSort = (a: Instructor, b: Instructor) => (a.displayOrder || 0) - (b.displayOrder || 0);

export default function AdminInstructorsPage() {
  const { toast } = useToast();
  const { data: items, setData: setItems, loading, error, refresh } = useFirestoreCollection<Instructor>(COLLECTIONS.INSTRUCTORS, instructorSort);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [specInput, setSpecInput] = useState("");

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setSpecInput(""); setShowModal(true); };
  const openEdit = (item: Instructor) => {
    setForm({ name: item.name, title: item.title, bio: item.bio, imageUrl: item.imageUrl, specialties: item.specialties || [], isActive: item.isActive, displayOrder: item.displayOrder });
    setEditId(item.id);
    setSpecInput("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const saveData = { ...form, imageUrl: toDirectImageUrl(form.imageUrl) };
    try {
      if (editId) {
        await upsertDoc(COLLECTIONS.INSTRUCTORS, editId, saveData);
        setItems((prev) => prev.map((i) => i.id === editId ? { ...i, ...saveData } : i));
      } else {
        const id = await createDoc(COLLECTIONS.INSTRUCTORS, { ...saveData, displayOrder: items.length });
        setItems((prev) => [...prev, { id, ...saveData, displayOrder: items.length }]);
      }
      setShowModal(false);
    } catch (e) { console.error(e); toast("저장에 실패했습니다.", "error"); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.INSTRUCTORS, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) { console.error(e); toast("삭제에 실패했습니다.", "error"); }
  };

  const toggleActive = async (item: Instructor) => {
    try {
      await upsertDoc(COLLECTIONS.INSTRUCTORS, item.id, { ...item, isActive: !item.isActive });
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isActive: !i.isActive } : i));
    } catch (e) { console.error(e); }
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
    } catch (e) { console.error(e); }
  };

  const addSpecialty = () => {
    if (specInput.trim() && !form.specialties.includes(specInput.trim())) {
      setForm({ ...form, specialties: [...form.specialties, specInput.trim()] });
      setSpecInput("");
    }
  };

  const removeSpecialty = (s: string) => {
    setForm({ ...form, specialties: form.specialties.filter((x) => x !== s) });
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">강사 관리</h1>
          <p className="text-gray-500 mt-1">강사 정보를 관리합니다.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <Plus size={16} /> 강사 추가
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 && <div className="col-span-full p-12 text-center text-gray-400 bg-white rounded-xl border">등록된 강사가 없습니다.</div>}
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-lg font-bold overflow-hidden">
                  {item.imageUrl ? <img src={toDirectImageUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : item.name[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-500">{item.title}</p>
                </div>
              </div>
              <div className="flex gap-0.5">
                <div className="flex flex-col">
                  <button onClick={() => moveOrder([...items].sort(instructorSort).indexOf(item), -1)}
                    disabled={[...items].sort(instructorSort).indexOf(item) === 0}
                    className="p-0.5 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                  <button onClick={() => moveOrder([...items].sort(instructorSort).indexOf(item), 1)}
                    disabled={[...items].sort(instructorSort).indexOf(item) === items.length - 1}
                    className="p-0.5 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={14} /></button>
                </div>
                <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{item.bio || "소개 없음"}</p>
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {(item.specialties || []).map((s) => (
                  <span key={s} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
              <button onClick={() => toggleActive(item)} className={`text-xs px-2 py-1 rounded-full ${item.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {item.isActive ? "활성" : "비활성"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editId ? "강사 수정" : "강사 추가"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="강사 이름" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">직함</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="예: AI 전문 강사" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">프로필 이미지 URL</label>
                <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="https://... 또는 Google Drive 공유 링크" />
                {form.imageUrl.trim() && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src={toDirectImageUrl(form.imageUrl)}
                        alt="미리보기"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; e.currentTarget.parentElement!.querySelector(".fallback")?.classList.remove("hidden"); }}
                        onLoad={(e) => { (e.target as HTMLImageElement).style.display = "block"; e.currentTarget.parentElement!.querySelector(".fallback")?.classList.add("hidden"); }}
                      />
                      <div className="fallback flex flex-col items-center">
                        <ImageIcon size={20} className="text-gray-300" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">미리보기 — Google Drive 링크는 자동 변환됩니다.</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">소개</label>
                <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="강사 소개" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">전문 분야</label>
                <div className="flex gap-2 mb-2">
                  <input value={specInput} onChange={(e) => setSpecInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSpecialty())}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="분야 입력 후 Enter" />
                  <button onClick={addSpecialty} className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">추가</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {form.specialties.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full">
                      {s} <button onClick={() => removeSpecialty(s)} className="text-primary-400 hover:text-primary-700">&times;</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {saving ? "저장중..." : editId ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
