"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { DEMO_FAQ } from "@/lib/demo-data";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

export default function AdminFAQPage() {
  const [items, setItems] = useState<FAQItem[]>([...DEMO_FAQ]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState<FAQItem>({ question: "", answer: "", category: "GENERAL" });

  const openCreate = () => {
    setForm({ question: "", answer: "", category: "GENERAL" });
    setEditIdx(null);
    setShowModal(true);
  };

  const openEdit = (idx: number) => {
    setForm({ ...items[idx] });
    setEditIdx(idx);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.question.trim() || !form.answer.trim()) return;
    if (editIdx !== null) {
      setItems((prev) => prev.map((item, i) => (i === editIdx ? { ...form } : item)));
    } else {
      setItems((prev) => [...prev, { ...form }]);
    }
    setShowModal(false);
  };

  const handleDelete = (idx: number) => {
    if (confirm("삭제하시겠습니까?")) {
      setItems((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FAQ 관리</h1>
          <p className="text-gray-500 mt-1">자주 묻는 질문을 관리합니다.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          <Plus size={16} /> 새 FAQ 추가
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {items.length === 0 && (
          <div className="p-12 text-center text-gray-400">등록된 FAQ가 없습니다.</div>
        )}
        {items.map((item, idx) => (
          <div key={idx} className="p-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="mt-1 text-gray-400"
              >
                {openIdx === idx ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <div className="flex-1">
                <button
                  onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                  className="text-left w-full"
                >
                  <p className="font-medium text-gray-900">Q. {item.question}</p>
                </button>
                {openIdx === idx && (
                  <div className="mt-3 pl-0 text-sm text-gray-600 leading-relaxed">
                    A. {item.answer}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mr-2">
                  {item.category}
                </span>
                <button
                  onClick={() => openEdit(idx)}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(idx)}
                  className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editIdx !== null ? "FAQ 수정" : "새 FAQ 추가"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="GENERAL">일반</option>
                  <option value="ENROLLMENT">수강 신청</option>
                  <option value="CERTIFICATE">수료증</option>
                  <option value="WORKATHON">워크톤</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">질문</label>
                <input
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="자주 묻는 질문을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">답변</label>
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="답변을 입력하세요"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {editIdx !== null ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
