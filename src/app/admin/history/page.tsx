"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { COLLECTIONS, createDoc, upsertDoc, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";

interface HistoryItem {
  id: string;
  year: string;
  month: string;
  title: string;
  description: string;
  category: string;
}

const EMPTY_FORM: Omit<HistoryItem, "id"> = { year: new Date().getFullYear().toString(), month: "01", title: "", description: "", category: "일반" };
const CATEGORIES = ["일반", "설립", "프로그램", "수상", "협약", "기타"];

const historySort = (a: HistoryItem, b: HistoryItem) => `${b.year}${b.month}`.localeCompare(`${a.year}${a.month}`);

export default function AdminHistoryPage() {
  const { data: items, setData: setItems, loading, error, refresh } = useFirestoreCollection<HistoryItem>(COLLECTIONS.HISTORY, historySort);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true); };
  const openEdit = (item: HistoryItem) => {
    setForm({ year: item.year, month: item.month, title: item.title, description: item.description, category: item.category });
    setEditId(item.id); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.year.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await upsertDoc(COLLECTIONS.HISTORY, editId, form);
        setItems((prev) => prev.map((i) => i.id === editId ? { ...i, ...form } : i));
      } else {
        const id = await createDoc(COLLECTIONS.HISTORY, form);
        setItems((prev) => [...prev, { id, ...form }]);
      }
      setItems((prev) => [...prev].sort((a, b) => `${b.year}${b.month}`.localeCompare(`${a.year}${a.month}`)));
      setShowModal(false);
    } catch (e) { console.error(e); alert("저장에 실패했습니다."); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.HISTORY, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) { console.error(e); alert("삭제에 실패했습니다."); }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  // Group by year
  const grouped = items.reduce<Record<string, HistoryItem[]>>((acc, item) => {
    (acc[item.year] = acc[item.year] || []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">연혁 관리</h1>
          <p className="text-gray-500 mt-1">기관 연혁을 관리합니다.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <Plus size={16} /> 연혁 추가
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {items.length === 0 && <div className="p-12 text-center text-gray-400">등록된 연혁이 없습니다.</div>}
        {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([year, yearItems]) => (
          <div key={year} className="border-b border-gray-100 last:border-0">
            <div className="px-6 py-3 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">{year}년</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {yearItems.map((item) => (
                <div key={item.id} className="px-6 py-4 flex items-start gap-4">
                  <div className="text-sm font-medium text-primary-600 w-12 shrink-0">{item.month}월</div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    {item.description && <p className="text-sm text-gray-500 mt-1">{item.description}</p>}
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.category}</span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">{editId ? "연혁 수정" : "연혁 추가"}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">연도 *</label>
                  <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="2024" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">월</label>
                  <select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                      <option key={m} value={m}>{m}월</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="연혁 제목" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="상세 설명 (선택)" />
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
