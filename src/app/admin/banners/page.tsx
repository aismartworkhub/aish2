"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { DEMO_QUICK_BANNERS, type QuickBannerDemo } from "@/lib/demo-data";
import { BANNER_STYLE_LABELS, BANNER_POSITION_LABELS } from "@/lib/constants";

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<QuickBannerDemo[]>([...DEMO_QUICK_BANNERS]);
  const [showModal, setShowModal] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<QuickBannerDemo>>({});

  const defaultForm: QuickBannerDemo = {
    id: "",
    title: "",
    description: "",
    ctaText: "",
    ctaLink: "",
    ctaOpenNewTab: false,
    style: "INFO",
    position: "TOP",
    backgroundColor: null,
    textColor: null,
    targetPages: ["/"],
    isDismissible: true,
    isActive: true,
    startDate: "",
    endDate: "",
    displayOrder: banners.length + 1,
  };

  const openCreate = () => {
    setForm({ ...defaultForm, id: `qb-${Date.now()}` });
    setEditIdx(null);
    setShowModal(true);
  };

  const openEdit = (idx: number) => {
    setForm({ ...banners[idx] });
    setEditIdx(idx);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.title?.trim()) return;
    const banner = { ...defaultForm, ...form } as QuickBannerDemo;
    if (editIdx !== null) {
      setBanners((prev) => prev.map((b, i) => (i === editIdx ? banner : b)));
    } else {
      setBanners((prev) => [...prev, banner]);
    }
    setShowModal(false);
  };

  const toggleActive = (idx: number) => {
    setBanners((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, isActive: !b.isActive } : b))
    );
  };

  const handleDelete = (idx: number) => {
    if (confirm("삭제하시겠습니까?")) {
      setBanners((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">퀵배너 관리</h1>
          <p className="text-gray-500 mt-1">사이트 상단/하단에 표시되는 배너를 관리합니다.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          <Plus size={16} /> 새 배너 추가
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-medium text-gray-500">제목</th>
              <th className="px-4 py-3 font-medium text-gray-500">스타일</th>
              <th className="px-4 py-3 font-medium text-gray-500">위치</th>
              <th className="px-4 py-3 font-medium text-gray-500">기간</th>
              <th className="px-4 py-3 font-medium text-gray-500">상태</th>
              <th className="px-4 py-3 font-medium text-gray-500 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {banners.map((banner, idx) => (
              <tr key={banner.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{banner.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{banner.description}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{BANNER_STYLE_LABELS[banner.style]}</td>
                <td className="px-4 py-3 text-gray-600">{BANNER_POSITION_LABELS[banner.position]}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {banner.startDate} ~ {banner.endDate}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(idx)}>
                    {banner.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                        <Eye size={12} /> 활성
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        <EyeOff size={12} /> 비활성
                      </span>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(idx)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(idx)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editIdx !== null ? "배너 수정" : "새 배너 추가"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input
                  value={form.title || ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <input
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">스타일</label>
                  <select
                    value={form.style || "INFO"}
                    onChange={(e) => setForm({ ...form, style: e.target.value as QuickBannerDemo["style"] })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {Object.entries(BANNER_STYLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">위치</label>
                  <select
                    value={form.position || "TOP"}
                    onChange={(e) => setForm({ ...form, position: e.target.value as QuickBannerDemo["position"] })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {Object.entries(BANNER_POSITION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                  <input
                    type="date"
                    value={form.startDate || ""}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                  <input
                    type="date"
                    value={form.endDate || ""}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CTA 버튼 텍스트</label>
                <input
                  value={form.ctaText || ""}
                  onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CTA 링크</label>
                <input
                  value={form.ctaLink || ""}
                  onChange={(e) => setForm({ ...form, ctaLink: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
