"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Plus, Search, Filter, ExternalLink, RefreshCw,
  ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, X,
} from "lucide-react";
import { cn, htmlToPlainTextSummary } from "@/lib/utils";
import {
  loadProgramOverrides, saveProgramOverrides, mergeProgram,
  type ProgramOverrides, type ProgramOverride,
} from "@/lib/program-overrides";
import {
  RUNMOA_CONTENT_TYPE_LABELS,
  RUNMOA_STATUS_LABELS,
  RUNMOA_STATUS_COLORS,
} from "@/lib/constants";
import { RUNMOA_ADMIN_ADD_URL, runmoaAdminEditUrl } from "@/lib/runmoa-api";
import { useRunmoaContents } from "@/hooks/useRunmoaContents";
import { useDebounce } from "@/hooks/useDebounce";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import type { RunmoaContent, RunmoaContentType, RunmoaStatus } from "@/types/runmoa";

const ITEMS_PER_PAGE = 20;

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR").format(price);
}

export default function AdminProgramsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState<RunmoaStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<RunmoaContentType | "">("");
  const [page, setPage] = useState(1);

  const params = useMemo(() => ({
    page,
    limit: ITEMS_PER_PAGE,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(typeFilter ? { content_type: typeFilter } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  }), [page, statusFilter, typeFilter, debouncedSearch]);

  const { data: contents, pagination, loading, error, refresh } = useRunmoaContents(params);

  // 관리자 지정 노출 순서·숨김 (홈·프로그램 페이지에 반영)
  const [overrides, setOverrides] = useState<ProgramOverrides>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    loadProgramOverrides().then(setOverrides).catch(() => {});
  }, []);

  // 빈 항목 제거하며 오버라이드 갱신
  const patchOverride = (id: number, patch: Partial<{ order: number | undefined; hidden: boolean }>) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const cur = { ...(next[String(id)] ?? {}) };
      if ("order" in patch) {
        if (patch.order === undefined) delete cur.order;
        else cur.order = patch.order;
      }
      if ("hidden" in patch) {
        if (patch.hidden) cur.hidden = true;
        else delete cur.hidden;
      }
      if (cur.order === undefined && !cur.hidden) delete next[String(id)];
      else next[String(id)] = cur;
      return next;
    });
    setDirty(true);
    setSavedMsg(false);
  };

  const handleOrderChange = (id: number, value: string) => {
    const trimmed = value.trim();
    const n = trimmed === "" ? undefined : Number(trimmed);
    patchOverride(id, { order: n !== undefined && Number.isFinite(n) ? n : undefined });
  };

  const handleSaveOverrides = async () => {
    setSaving(true);
    try {
      await saveProgramOverrides(overrides);
      setDirty(false);
      setSavedMsg(true);
    } catch {
      /* 저장 실패 시 dirty 유지 — 사용자가 재시도 */
    } finally {
      setSaving(false);
    }
  };

  // ── 표시 필드 편집 모달 (제목·설명·이미지·유형·가격) ──
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProgramOverride>({});
  const editing = contents.find((c) => c.content_id === editingId) ?? null;

  const openEditor = (c: RunmoaContent) => {
    const ov = overrides[String(c.content_id)] ?? {};
    setForm({
      title: ov.title ?? c.title,
      description: ov.description ?? htmlToPlainTextSummary(c.description_html, 100000),
      featuredImage: ov.featuredImage ?? c.featured_image,
      contentType: ov.contentType ?? c.content_type,
      isFree: ov.isFree ?? c.is_free,
      basePrice: typeof ov.basePrice === "number" ? ov.basePrice : c.base_price,
      salePrice: typeof ov.salePrice === "number" ? ov.salePrice : c.sale_price,
      isOnSale: ov.isOnSale ?? c.is_on_sale,
      order: ov.order,
      hidden: ov.hidden,
    });
    setEditingId(c.content_id);
  };

  // 원본과 다른 값만 오버레이로 저장 (미변경 필드는 Runmoa 원본을 계속 따라감)
  const buildOverride = (c: RunmoaContent): ProgramOverride => {
    const plainOrig = htmlToPlainTextSummary(c.description_html, 100000);
    const ov: ProgramOverride = {};
    if (form.title?.trim() && form.title.trim() !== c.title) ov.title = form.title.trim();
    if (form.description?.trim() && form.description.trim() !== plainOrig) ov.description = form.description.trim();
    if (form.featuredImage?.trim() && form.featuredImage.trim() !== c.featured_image) ov.featuredImage = form.featuredImage.trim();
    if (form.contentType && form.contentType !== c.content_type) ov.contentType = form.contentType;
    if (form.isFree !== c.is_free) ov.isFree = form.isFree;
    if (typeof form.basePrice === "number" && form.basePrice !== c.base_price) ov.basePrice = form.basePrice;
    if (typeof form.salePrice === "number" && form.salePrice !== c.sale_price) ov.salePrice = form.salePrice;
    if (form.isOnSale !== c.is_on_sale) ov.isOnSale = form.isOnSale;
    if (typeof form.order === "number" && Number.isFinite(form.order)) ov.order = form.order;
    if (form.hidden) ov.hidden = true;
    return ov;
  };

  const persistMap = async (next: ProgramOverrides) => {
    setOverrides(next);
    setSaving(true);
    try {
      await saveProgramOverrides(next);
      setDirty(false);
      setSavedMsg(true);
      setEditingId(null);
    } catch {
      /* 저장 실패 시 모달 유지 — 재시도 */
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEditor = async () => {
    if (!editing) return;
    const ov = buildOverride(editing);
    const next = { ...overrides };
    if (Object.keys(ov).length === 0) delete next[String(editing.content_id)];
    else next[String(editing.content_id)] = ov;
    await persistMap(next);
  };

  const handleResetEditor = async () => {
    if (!editing) return;
    const next = { ...overrides };
    delete next[String(editing.content_id)];
    await persistMap(next);
  };

  const handleOpenAdd = () => {
    window.open(RUNMOA_ADMIN_ADD_URL, "_blank", "noopener");
  };

  const handleOpenEdit = (contentId: number) => {
    window.open(runmoaAdminEditUrl(contentId), "_blank", "noopener");
  };

  // 필터 변경 시 1페이지로 리셋
  const changeStatus = (v: string) => {
    setStatusFilter(v as RunmoaStatus | "");
    setPage(1);
  };
  const changeType = (v: string) => {
    setTypeFilter(v as RunmoaContentType | "");
    setPage(1);
  };

  if (loading && contents.length === 0) return <AdminLoading />;
  if (error && contents.length === 0) return <AdminError message={error} onRetry={refresh} />;

  const lastPage = pagination?.last_page ?? 1;
  const total = pagination?.total ?? 0;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">교육 프로그램 관리</h1>
          <p className="text-gray-500 mt-1">
            Runmoa 콘텐츠와 연동됩니다. 등록·수정은 Runmoa 관리 화면에서 진행합니다.
            <br />
            <span className="text-gray-400">노출 순서·숨김은 홈·교육과정 페이지에 반영됩니다 (작은 순서가 먼저, 빈 칸은 기본 순서).</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={16} />새로고침
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            <Plus size={18} />새 프로그램 등록
            <ExternalLink size={14} className="opacity-60" />
          </button>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="콘텐츠 검색..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => changeType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none"
            >
              <option value="">전체 유형</option>
              {Object.entries(RUNMOA_CONTENT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => changeStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none"
            >
              <option value="">전체 상태</option>
              {Object.entries(RUNMOA_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">제목</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">유형</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">가격</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">카테고리</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">노출 순서</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">노출</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">수정</th>
              </tr>
            </thead>
            <tbody>
              {contents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">
                    {loading ? "불러오는 중..." : "콘텐츠가 없습니다."}
                  </td>
                </tr>
              ) : (
                contents.map((rawC) => {
                  const ov = overrides[String(rawC.content_id)];
                  const c = mergeProgram(rawC, ov);
                  const hasContentOverride = !!ov && (
                    ov.title !== undefined || ov.description !== undefined || ov.featuredImage !== undefined ||
                    ov.contentType !== undefined || ov.isFree !== undefined || ov.basePrice !== undefined ||
                    ov.salePrice !== undefined || ov.isOnSale !== undefined
                  );
                  const rowDesc = htmlToPlainTextSummary(c.description_html, 60);
                  return (
                  <tr
                    key={c.content_id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => openEditor(rawC)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {c.featured_image ? (
                          <img
                            src={c.featured_image}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-50 to-blue-50 flex items-center justify-center shrink-0">
                            <span className="text-lg">📚</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-900 text-sm truncate max-w-xs">
                              {c.title}
                            </span>
                            {hasContentOverride && (
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">표시 수정됨</span>
                            )}
                          </div>
                          {rowDesc ? (
                            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                              {rowDesc}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {RUNMOA_CONTENT_TYPE_LABELS[c.content_type] ?? c.content_type}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        RUNMOA_STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"
                      )}>
                        {RUNMOA_STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {c.is_free ? (
                        <span className="text-sm text-green-600 font-medium">무료</span>
                      ) : (
                        <div className="text-sm">
                          {c.is_on_sale && c.sale_price > 0 ? (
                            <>
                              <span className="text-gray-900 font-medium">₩{formatPrice(c.sale_price)}</span>
                              <span className="text-xs text-gray-400 line-through ml-1">₩{formatPrice(c.base_price)}</span>
                            </>
                          ) : (
                            <span className="text-gray-900">₩{formatPrice(c.base_price)}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {rawC.categories.map((cat) => cat.name).join(", ") || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        value={overrides[String(c.content_id)]?.order ?? ""}
                        onChange={(e) => handleOrderChange(c.content_id, e.target.value)}
                        placeholder="-"
                        className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </td>
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const hidden = !!overrides[String(c.content_id)]?.hidden;
                        return (
                          <button
                            onClick={() => patchOverride(c.content_id, { hidden: !hidden })}
                            className={cn(
                              "p-2 rounded-lg transition-colors",
                              hidden
                                ? "text-gray-300 hover:text-gray-500 hover:bg-gray-50"
                                : "text-primary-600 hover:bg-primary-50",
                            )}
                            title={hidden ? "숨김 — 클릭하면 노출" : "노출 중 — 클릭하면 숨김"}
                          >
                            {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditor(rawC); }}
                          className="p-2 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors"
                          title="이 사이트에서 표시 내용 수정"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenEdit(rawC.content_id); }}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors"
                          title="Runmoa 원본에서 수정"
                        >
                          <ExternalLink size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              총 {total}개 중 {pagination?.from ?? 0}-{pagination?.to ?? 0}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(lastPage, 5) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, lastPage - 4));
                const p = start + i;
                if (p > lastPage) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                      p === page
                        ? "bg-primary-600 text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 순서·노출 저장 바 */}
      {(dirty || savedMsg) && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-end gap-3">
          {savedMsg && !dirty && (
            <span className="text-sm text-green-600">노출 순서·숨김이 저장되었습니다.</span>
          )}
          {dirty && (
            <>
              <span className="text-sm text-gray-500">변경된 노출 순서·숨김이 저장되지 않았습니다.</span>
              <button
                onClick={handleSaveOverrides}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 shadow-lg"
              >
                {saving ? "저장 중..." : "순서·노출 저장"}
              </button>
            </>
          )}
        </div>
      )}

      {/* 표시 내용 편집 모달 */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditingId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">표시 내용 수정</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  이 사이트의 홈·교육과정 카드 표시만 바뀝니다. Runmoa 수강신청 페이지는 그대로입니다.
                </p>
              </div>
              <button onClick={() => setEditingId(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input
                  type="text"
                  value={form.title ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">대표 이미지 URL</label>
                <input
                  type="text"
                  value={form.featuredImage ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, featuredImage: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">유형 뱃지</label>
                  <select
                    value={form.contentType ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, contentType: e.target.value as RunmoaContentType }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none"
                  >
                    {Object.entries(RUNMOA_CONTENT_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 pb-2">
                    <input
                      type="checkbox"
                      checked={!!form.isFree}
                      onChange={(e) => setForm((f) => ({ ...f, isFree: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    무료
                  </label>
                </div>
              </div>

              {!form.isFree && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">정가 (원)</label>
                    <input
                      type="number"
                      value={form.basePrice ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">할인가 (원)</label>
                    <input
                      type="number"
                      value={form.salePrice ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      disabled={!form.isOnSale}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-gray-600 mt-1.5">
                      <input
                        type="checkbox"
                        checked={!!form.isOnSale}
                        onChange={(e) => setForm((f) => ({ ...f, isOnSale: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      할인가 적용
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">노출 순서</label>
                  <input
                    type="number"
                    value={form.order ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, order: e.target.value === "" ? undefined : Number(e.target.value) }))}
                    placeholder="작을수록 먼저 (빈 칸=기본)"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 pb-2">
                    <input
                      type="checkbox"
                      checked={!!form.hidden}
                      onChange={(e) => setForm((f) => ({ ...f, hidden: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    숨김 (홈·교육과정에서 제외)
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={handleResetEditor}
                disabled={saving}
                className="text-sm text-gray-400 hover:text-red-500 disabled:opacity-50"
              >
                이 프로그램 수정 초기화
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(null)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveEditor}
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
