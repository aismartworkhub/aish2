"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Building2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTIONS, createDoc, upsertDoc, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { useToast } from "@/components/ui/Toast";
import type { SuccessCase, SuccessMetric } from "@/types/success-case";

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20";
const LABEL_CLASS = "block text-xs font-medium text-gray-500 mb-1";

function emptyForm(): SuccessCase {
  return {
    id: "",
    companyName: "",
    industry: "",
    title: "",
    summary: "",
    thumbnailUrl: "",
    companyLogoUrl: "",
    challenge: "",
    solution: "",
    result: "",
    metrics: [],
    tags: [],
    testimonial: "",
    testimonialAuthor: "",
    ctaText: "",
    ctaLink: "",
    order: undefined,
    hidden: false,
  };
}

/** Firestore는 undefined 값을 거부하므로 저장 전 제거 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export default function AdminSuccessPage() {
  const { toast } = useToast();
  const { data: cases, setData, loading, error, refresh } =
    useFirestoreCollection<SuccessCase>(COLLECTIONS.SUCCESS_CASES);

  const [editing, setEditing] = useState<SuccessCase | null>(null);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const sorted = [...cases].sort(
    (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
  );

  const patch = (fields: Partial<SuccessCase>) =>
    setEditing((prev) => (prev ? { ...prev, ...fields } : prev));

  // ── 지표(metrics) 편집 ──
  const addMetric = () => patch({ metrics: [...(editing?.metrics ?? []), { label: "", value: "" }] });
  const updateMetric = (i: number, field: keyof SuccessMetric, v: string) =>
    patch({ metrics: (editing?.metrics ?? []).map((m, idx) => (idx === i ? { ...m, [field]: v } : m)) });
  const removeMetric = (i: number) =>
    patch({ metrics: (editing?.metrics ?? []).filter((_, idx) => idx !== i) });

  // ── 태그 편집 ──
  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!(editing?.tags ?? []).includes(t)) patch({ tags: [...(editing?.tags ?? []), t] });
    setTagInput("");
  };
  const removeTag = (t: string) => patch({ tags: (editing?.tags ?? []).filter((x) => x !== t) });

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.companyName.trim() || !editing.title.trim()) {
      toast("기업명과 제목은 필수입니다.", "error");
      return;
    }
    setSaving(true);
    const { id, ...rest } = editing;
    const payload = stripUndefined({
      ...rest,
      companyName: rest.companyName.trim(),
      title: rest.title.trim(),
      metrics: (rest.metrics ?? []).filter((m) => m.label.trim() || m.value.trim()),
    });
    try {
      if (id) {
        await upsertDoc(COLLECTIONS.SUCCESS_CASES, id, payload);
        setData((prev) => prev.map((c) => (c.id === id ? { ...(editing as SuccessCase) } : c)));
      } else {
        const newId = await createDoc(COLLECTIONS.SUCCESS_CASES, payload);
        setData((prev) => [{ ...(editing as SuccessCase), id: newId }, ...prev]);
      }
      toast("저장되었습니다.", "success");
      setEditing(null);
    } catch {
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: SuccessCase) => {
    if (!confirm(`'${c.title}' 성공사례를 삭제하시겠습니까?`)) return;
    try {
      await removeDoc(COLLECTIONS.SUCCESS_CASES, c.id);
      setData((prev) => prev.filter((x) => x.id !== c.id));
      toast("삭제되었습니다.", "success");
    } catch {
      toast("삭제에 실패했습니다.", "error");
    }
  };

  const toggleHidden = async (c: SuccessCase) => {
    const next = !c.hidden;
    try {
      await upsertDoc(COLLECTIONS.SUCCESS_CASES, c.id, { hidden: next });
      setData((prev) => prev.map((x) => (x.id === c.id ? { ...x, hidden: next } : x)));
    } catch {
      toast("변경에 실패했습니다.", "error");
    }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">성공사례 관리</h1>
          <p className="text-gray-500 mt-1">기업이 AI를 활용해 어떻게 성공·변화했는지 소개하는 사례를 관리합니다.</p>
        </div>
        <button
          onClick={() => setEditing(emptyForm())}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} />새 성공사례
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <Building2 size={36} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">등록된 성공사례가 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">기업 / 제목</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">업종</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">지표</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">순서</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">노출</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => setEditing({ ...c })}
                  >
                    <td className="px-4 py-4">
                      <div className="text-xs text-primary-600 font-medium">{c.companyName}</div>
                      <div className="font-medium text-gray-900 text-sm">{c.title}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{c.industry || "-"}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-600">{c.metrics?.length ?? 0}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-600">{typeof c.order === "number" ? c.order : "-"}</td>
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleHidden(c)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          c.hidden ? "text-gray-300 hover:text-gray-500 hover:bg-gray-50" : "text-primary-600 hover:bg-primary-50",
                        )}
                        title={c.hidden ? "숨김 — 클릭하면 노출" : "노출 중 — 클릭하면 숨김"}
                      >
                        {c.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </td>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing({ ...c })} className="p-2 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors" title="수정">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(c)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title="삭제">
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">{editing.id ? "성공사례 수정" : "새 성공사례"}</h2>
              <button onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={20} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={cn(LABEL_CLASS)}>기업명 *</label>
                  <input type="text" value={editing.companyName} onChange={(e) => patch({ companyName: e.target.value })} className={cn(INPUT_CLASS)} />
                </div>
                <div>
                  <label className={cn(LABEL_CLASS)}>업종</label>
                  <input type="text" value={editing.industry ?? ""} onChange={(e) => patch({ industry: e.target.value })} placeholder="예: 제조, 이커머스" className={cn(INPUT_CLASS)} />
                </div>
              </div>

              <div>
                <label className={cn(LABEL_CLASS)}>사례 제목 *</label>
                <input type="text" value={editing.title} onChange={(e) => patch({ title: e.target.value })} placeholder="예: AI 상담봇으로 고객응대 70% 자동화" className={cn(INPUT_CLASS)} />
              </div>

              <div>
                <label className={cn(LABEL_CLASS)}>한 줄 요약</label>
                <input type="text" value={editing.summary ?? ""} onChange={(e) => patch({ summary: e.target.value })} className={cn(INPUT_CLASS)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={cn(LABEL_CLASS)}>대표 이미지 URL</label>
                  <input type="text" value={editing.thumbnailUrl ?? ""} onChange={(e) => patch({ thumbnailUrl: e.target.value })} placeholder="https://..." className={cn(INPUT_CLASS)} />
                </div>
                <div>
                  <label className={cn(LABEL_CLASS)}>기업 로고 URL</label>
                  <input type="text" value={editing.companyLogoUrl ?? ""} onChange={(e) => patch({ companyLogoUrl: e.target.value })} placeholder="https://..." className={cn(INPUT_CLASS)} />
                </div>
              </div>

              <div>
                <label className={cn(LABEL_CLASS)}>도입 전 과제</label>
                <textarea value={editing.challenge ?? ""} onChange={(e) => patch({ challenge: e.target.value })} rows={2} className={cn(INPUT_CLASS, "resize-none")} />
              </div>
              <div>
                <label className={cn(LABEL_CLASS)}>AI 솔루션</label>
                <textarea value={editing.solution ?? ""} onChange={(e) => patch({ solution: e.target.value })} rows={2} className={cn(INPUT_CLASS, "resize-none")} />
              </div>
              <div>
                <label className={cn(LABEL_CLASS)}>성과·변화</label>
                <textarea value={editing.result ?? ""} onChange={(e) => patch({ result: e.target.value })} rows={2} className={cn(INPUT_CLASS, "resize-none")} />
              </div>

              {/* 지표 */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <label className={cn(LABEL_CLASS, "mb-0")}>핵심 성과 지표</label>
                  <button type="button" onClick={addMetric} className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700">
                    <Plus size={14} />추가
                  </button>
                </div>
                <div className="space-y-2">
                  {(editing.metrics ?? []).map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <GripVertical size={14} className="text-gray-300 shrink-0" />
                      <input type="text" value={m.value} onChange={(e) => updateMetric(i, "value", e.target.value)} placeholder="값 (예: -40%)" className={cn(INPUT_CLASS, "w-32")} />
                      <input type="text" value={m.label} onChange={(e) => updateMetric(i, "label", e.target.value)} placeholder="지표명 (예: 업무시간 절감)" className={cn(INPUT_CLASS, "flex-1")} />
                      <button type="button" onClick={() => removeMetric(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 태그 */}
              <div>
                <label className={cn(LABEL_CLASS)}>태그</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="태그 입력 후 Enter"
                    className={cn(INPUT_CLASS, "flex-1")}
                  />
                  <button type="button" onClick={addTag} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">추가</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(editing.tags ?? []).map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      #{t}
                      <button type="button" onClick={() => removeTag(t)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              </div>

              {/* 인용 */}
              <div className="grid grid-cols-1 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className={cn(LABEL_CLASS)}>담당자 인용(후기)</label>
                  <textarea value={editing.testimonial ?? ""} onChange={(e) => patch({ testimonial: e.target.value })} rows={2} className={cn(INPUT_CLASS, "resize-none")} />
                </div>
                <div>
                  <label className={cn(LABEL_CLASS)}>인용 출처</label>
                  <input type="text" value={editing.testimonialAuthor ?? ""} onChange={(e) => patch({ testimonialAuthor: e.target.value })} placeholder="예: CX팀 이OO 매니저" className={cn(INPUT_CLASS)} />
                </div>
              </div>

              {/* CTA + 노출 */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className={cn(LABEL_CLASS)}>CTA 버튼 문구</label>
                  <input type="text" value={editing.ctaText ?? ""} onChange={(e) => patch({ ctaText: e.target.value })} placeholder="예: 도입 문의" className={cn(INPUT_CLASS)} />
                </div>
                <div>
                  <label className={cn(LABEL_CLASS)}>CTA 링크</label>
                  <input type="text" value={editing.ctaLink ?? ""} onChange={(e) => patch({ ctaLink: e.target.value })} placeholder="https://... 또는 /community" className={cn(INPUT_CLASS)} />
                </div>
                <div>
                  <label className={cn(LABEL_CLASS)}>노출 순서</label>
                  <input type="number" value={editing.order ?? ""} onChange={(e) => patch({ order: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="작을수록 먼저" className={cn(INPUT_CLASS)} />
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
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
