"use client";

import { useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { type QuickBannerDemo } from "@/lib/demo-data";
import { BANNER_STYLE_LABELS, BANNER_POSITION_LABELS, TARGET_PAGE_OPTIONS } from "@/lib/constants";
import { COLLECTIONS, createDoc, upsertDoc, updateDocFields, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";

const bannerSort = (a: QuickBannerDemo, b: QuickBannerDemo) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0);

export default function AdminBannersPage() {
  const { data: banners, setData: setBanners, loading, error, refresh } = useFirestoreCollection<QuickBannerDemo>(COLLECTIONS.BANNERS, bannerSort);
  const [showModal, setShowModal] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<QuickBannerDemo>>({});
  const [saving, setSaving] = useState(false);

  const defaultForm = (): QuickBannerDemo => ({
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
  });

  const openCreate = () => {
    setForm({ ...defaultForm() });
    setEditIdx(null);
    setShowModal(true);
  };

  const openEdit = (idx: number) => {
    setForm({ ...banners[idx] });
    setEditIdx(idx);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) return;
    setSaving(true);
    try {
      const banner = { ...defaultForm(), ...form } as QuickBannerDemo;
      if (editIdx !== null && banners[editIdx]?.id) {
        await upsertDoc(COLLECTIONS.BANNERS, banners[editIdx].id, banner);
        setBanners((prev) => prev.map((b, i) => (i === editIdx ? { ...banner, id: banners[editIdx].id } : b)));
      } else {
        const id = await createDoc(COLLECTIONS.BANNERS, banner);
        setBanners((prev) => [...prev, { ...banner, id }]);
      }
      setShowModal(false);
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (idx: number) => {
    const banner = banners[idx];
    if (!banner.id) return;
    const newActive = !banner.isActive;
    try {
      await updateDocFields(COLLECTIONS.BANNERS, banner.id, { isActive: newActive });
      setBanners((prev) => prev.map((b, i) => (i === idx ? { ...b, isActive: newActive } : b)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (idx: number) => {
    const banner = banners[idx];
    if (!banner.id || !confirm("삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.BANNERS, banner.id);
      setBanners((prev) => prev.filter((_, i) => i !== idx));
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했습니다.");
    }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

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
        {banners.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">등록된 배너가 없습니다.</div>
        ) : (
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
        )}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">표시 페이지</label>
                <div className="flex flex-wrap gap-2">
                  {TARGET_PAGE_OPTIONS.map((opt) => {
                    const pages = form.targetPages ?? ["/"];
                    const checked = pages.includes(opt.value);
                    return (
                      <label key={opt.value} className="inline-flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked ? pages.filter((p) => p !== opt.value) : [...pages, opt.value];
                            setForm({ ...form, targetPages: next });
                          }}
                          className="rounded border-gray-300"
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isActive" checked={form.isActive ?? true}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-gray-300" />
                  <label htmlFor="isActive" className="text-sm text-gray-700">활성화</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isDismissible" checked={form.isDismissible ?? true}
                    onChange={(e) => setForm({ ...form, isDismissible: e.target.checked })} className="rounded border-gray-300" />
                  <label htmlFor="isDismissible" className="text-sm text-gray-700">닫기 가능</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="ctaOpenNewTab" checked={form.ctaOpenNewTab ?? false}
                    onChange={(e) => setForm({ ...form, ctaOpenNewTab: e.target.checked })} className="rounded border-gray-300" />
                  <label htmlFor="ctaOpenNewTab" className="text-sm text-gray-700">새 탭에서 열기</label>
                </div>
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
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "저장중..." : editIdx !== null ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
