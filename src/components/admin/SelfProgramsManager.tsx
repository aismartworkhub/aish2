"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Link2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTIONS, createDoc, upsertDoc, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { useToast } from "@/components/ui/Toast";
import { PROGRAM_CATEGORY_LABELS, RUNMOA_CONTENT_TYPE_LABELS } from "@/lib/constants";
import type { SelfProgram } from "@/lib/program-merge";
import type { RunmoaContentType } from "@/types/runmoa";

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20";

const CATEGORY_KEYS = Object.keys(PROGRAM_CATEGORY_LABELS);

function emptyForm(): SelfProgram {
  return {
    id: "",
    title: "",
    category: CATEGORY_KEYS[0],
    summary: "",
    thumbnailUrl: "",
    ctaText: "",
    ctaLink: "",
    contentType: "offline",
    isFree: true,
    order: undefined,
    hidden: false,
  };
}

/** Firestore는 undefined 값을 거부하므로 저장 전 제거 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function priceLabel(p: SelfProgram): string {
  if (p.isFree) return "무료";
  if (p.isOnSale && (p.salePrice ?? 0) > 0) return `₩${(p.salePrice ?? 0).toLocaleString("ko-KR")}`;
  if ((p.basePrice ?? 0) > 0) return `₩${(p.basePrice ?? 0).toLocaleString("ko-KR")}`;
  return "-";
}

/**
 * 자체(aish.co.kr) 프로그램 CRUD. Firestore `programs` 컬렉션에 직접 저장하며
 * 홈·교육과정에서 Runmoa 상품과 병합 노출된다. Runmoa 상품과 겹치면
 * `runmoaContentId`로 연결해 중복 노출을 막는다.
 */
export default function SelfProgramsManager() {
  const { toast } = useToast();
  const { data: programs, setData, loading, error, refresh } =
    useFirestoreCollection<SelfProgram>(COLLECTIONS.PROGRAMS);

  const [editing, setEditing] = useState<SelfProgram | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => setEditing(emptyForm());
  const openEdit = (p: SelfProgram) => setEditing({ ...p });

  const patch = (fields: Partial<SelfProgram>) =>
    setEditing((prev) => (prev ? { ...prev, ...fields } : prev));

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast("제목을 입력해주세요.", "error");
      return;
    }
    setSaving(true);
    const { id, ...rest } = editing;
    const payload = stripUndefined({ ...rest, title: rest.title.trim() });
    try {
      if (id) {
        await upsertDoc(COLLECTIONS.PROGRAMS, id, payload);
        setData((prev) => prev.map((p) => (p.id === id ? { ...(editing as SelfProgram) } : p)));
      } else {
        const newId = await createDoc(COLLECTIONS.PROGRAMS, payload);
        setData((prev) => [{ ...(editing as SelfProgram), id: newId }, ...prev]);
      }
      toast("저장되었습니다.", "success");
      setEditing(null);
    } catch {
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: SelfProgram) => {
    if (!confirm(`'${p.title}' 프로그램을 삭제하시겠습니까?`)) return;
    try {
      await removeDoc(COLLECTIONS.PROGRAMS, p.id);
      setData((prev) => prev.filter((x) => x.id !== p.id));
      toast("삭제되었습니다.", "success");
    } catch {
      toast("삭제에 실패했습니다.", "error");
    }
  };

  const toggleHidden = async (p: SelfProgram) => {
    const next = !p.hidden;
    try {
      await upsertDoc(COLLECTIONS.PROGRAMS, p.id, { hidden: next });
      setData((prev) => prev.map((x) => (x.id === p.id ? { ...x, hidden: next } : x)));
    } catch {
      toast("변경에 실패했습니다.", "error");
    }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <p className="text-sm text-gray-500">
          Runmoa에 없는 <span className="font-medium text-gray-700">자체 전용 프로그램</span>을 등록합니다.
          홈·교육과정에서 Runmoa 상품과 함께 노출됩니다.
          <br />
          <span className="text-gray-400">Runmoa 상품과 겹치면 아래 <span className="font-medium">Runmoa content_id</span>를 연결해 중복 노출을 막으세요.</span>
        </p>
        <button
          onClick={openCreate}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} />새 자체 프로그램
        </button>
      </div>

      {programs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <BookOpen size={36} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">등록된 자체 프로그램이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">제목</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">카테고리</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">가격</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Runmoa 연결</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">순서</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">노출</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => openEdit(p)}
                  >
                    <td className="px-4 py-4">
                      <span className="font-medium text-gray-900 text-sm">{p.title}</span>
                      {p.summary ? (
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{p.summary}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {(p.category && PROGRAM_CATEGORY_LABELS[p.category]) || p.category || "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">{priceLabel(p)}</td>
                    <td className="px-4 py-4 text-center">
                      {typeof p.runmoaContentId === "number" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary-600">
                          <Link2 size={12} />#{p.runmoaContentId}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-gray-600">
                      {typeof p.order === "number" ? p.order : "-"}
                    </td>
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleHidden(p)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          p.hidden
                            ? "text-gray-300 hover:text-gray-500 hover:bg-gray-50"
                            : "text-primary-600 hover:bg-primary-50",
                        )}
                        title={p.hidden ? "숨김 — 클릭하면 노출" : "노출 중 — 클릭하면 숨김"}
                      >
                        {p.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </td>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-2 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors"
                          title="수정"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 편집/생성 모달 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">
                {editing.id ? "자체 프로그램 수정" : "새 자체 프로그램"}
              </h2>
              <button onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input type="text" value={editing.title} onChange={(e) => patch({ title: e.target.value })} className={cn(INPUT_CLASS)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                  <select value={editing.category ?? ""} onChange={(e) => patch({ category: e.target.value })} className={cn(INPUT_CLASS)}>
                    {CATEGORY_KEYS.map((k) => (
                      <option key={k} value={k}>{PROGRAM_CATEGORY_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">유형 뱃지</label>
                  <select
                    value={editing.contentType ?? "offline"}
                    onChange={(e) => patch({ contentType: e.target.value as RunmoaContentType })}
                    className={cn(INPUT_CLASS)}
                  >
                    {Object.entries(RUNMOA_CONTENT_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea value={editing.summary ?? ""} onChange={(e) => patch({ summary: e.target.value })} rows={3} className={cn(INPUT_CLASS, "resize-none")} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">대표 이미지 URL</label>
                <input type="text" value={editing.thumbnailUrl ?? ""} onChange={(e) => patch({ thumbnailUrl: e.target.value })} placeholder="https://... 또는 Google Drive 공유 링크" className={cn(INPUT_CLASS)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA 버튼 문구</label>
                  <input type="text" value={editing.ctaText ?? ""} onChange={(e) => patch({ ctaText: e.target.value })} placeholder="예: 자세히 보기" className={cn(INPUT_CLASS)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA 링크 URL</label>
                  <input type="text" value={editing.ctaLink ?? ""} onChange={(e) => patch({ ctaLink: e.target.value })} placeholder="https://... 또는 /about 등 내부 경로" className={cn(INPUT_CLASS)} />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={!!editing.isFree} onChange={(e) => patch({ isFree: e.target.checked })} className="rounded border-gray-300" />
                  무료
                </label>
                {!editing.isFree && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">정가 (원)</label>
                      <input
                        type="number"
                        value={editing.basePrice ?? ""}
                        onChange={(e) => patch({ basePrice: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className={cn(INPUT_CLASS, "w-32")}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">할인가 (원)</label>
                      <input
                        type="number"
                        value={editing.salePrice ?? ""}
                        onChange={(e) => patch({ salePrice: e.target.value === "" ? undefined : Number(e.target.value) })}
                        disabled={!editing.isOnSale}
                        className={cn(INPUT_CLASS, "w-32 disabled:bg-gray-50 disabled:text-gray-400")}
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-gray-600 self-end pb-2">
                      <input type="checkbox" checked={!!editing.isOnSale} onChange={(e) => patch({ isOnSale: e.target.checked })} className="rounded border-gray-300" />
                      할인가 적용
                    </label>
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Runmoa content_id</label>
                  <input
                    type="number"
                    value={editing.runmoaContentId ?? ""}
                    onChange={(e) => patch({ runmoaContentId: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="겹치는 상품 연결(선택)"
                    className={cn(INPUT_CLASS)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">노출 순서</label>
                  <input
                    type="number"
                    value={editing.order ?? ""}
                    onChange={(e) => patch({ order: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="작을수록 먼저"
                    className={cn(INPUT_CLASS)}
                  />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 pb-2">
                    <input type="checkbox" checked={!!editing.hidden} onChange={(e) => patch({ hidden: e.target.checked })} className="rounded border-gray-300" />
                    숨김
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
