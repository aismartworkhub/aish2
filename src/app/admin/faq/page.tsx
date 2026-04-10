"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { COLLECTIONS, createDoc, upsertDoc, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { HtmlEditor } from "@/components/admin/HtmlEditor";
import { useToast } from "@/components/ui/Toast";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  displayOrder?: number;
}

export default function AdminFAQPage() {
  const { toast } = useToast();
  const { data: items, setData: setItems, loading, error, refresh } = useFirestoreCollection<FAQItem>(COLLECTIONS.FAQ);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<FAQItem, "id">>({ question: "", answer: "", category: "GENERAL" });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm({ question: "", answer: "", category: "GENERAL" });
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (item: FAQItem) => {
    setForm({ question: item.question, answer: item.answer, category: item.category });
    setEditId(item.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await upsertDoc(COLLECTIONS.FAQ, editId, form);
        setItems((prev) => prev.map((item) => item.id === editId ? { ...item, ...form } : item));
      } else {
        const id = await createDoc(COLLECTIONS.FAQ, { ...form, displayOrder: items.length + 1 });
        setItems((prev) => [...prev, { id, ...form }]);
      }
      setShowModal(false);
    } catch (e) {
      console.error(e);
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.FAQ, id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      console.error(e);
      toast("삭제에 실패했습니다.", "error");
    }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FAQ 관리</h1>
          <p className="text-gray-500 mt-1">자주 묻는 질문을 관리합니다.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <Plus size={16} /> 새 FAQ 추가
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {items.length === 0 && <div className="p-12 text-center text-gray-400">등록된 FAQ가 없습니다.</div>}
        {items.map((item, idx) => (
          <div key={item.id} className="p-4">
            <div className="flex items-start gap-3">
              <button onClick={() => setOpenIdx(openIdx === idx ? null : idx)} className="mt-1 text-gray-400">
                {openIdx === idx ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <div className="flex-1">
                <button onClick={() => setOpenIdx(openIdx === idx ? null : idx)} className="text-left w-full">
                  <p className="font-medium text-gray-900">Q. {item.question}</p>
                </button>
                {openIdx === idx && (
                  <div className="mt-3 text-sm text-gray-600 leading-relaxed">A. {item.answer}</div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mr-2">{item.category}</span>
                <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">{editId ? "FAQ 수정" : "새 FAQ 추가"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="GENERAL">일반</option>
                  <option value="ENROLLMENT">수강 신청</option>
                  <option value="CERTIFICATE">수료증</option>
                  <option value="WORKATHON">워크톤</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">질문</label>
                <input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="자주 묻는 질문을 입력하세요" />
              </div>
              <div>
                <HtmlEditor
                  label="답변"
                  value={form.answer}
                  onChange={(v) => setForm({ ...form, answer: v })}
                  rows={4}
                  placeholder="답변을 입력하세요 (HTML 사용 가능)"
                />
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
