"use client";

import { useState, useMemo } from "react";
import {
  Plus, Search, Filter, ExternalLink, RefreshCw,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RUNMOA_CONTENT_TYPE_LABELS,
  RUNMOA_STATUS_LABELS,
  RUNMOA_STATUS_COLORS,
} from "@/lib/constants";
import { RUNMOA_ADMIN_ADD_URL, runmoaAdminEditUrl } from "@/lib/runmoa-api";
import { useRunmoaContents } from "@/hooks/useRunmoaContents";
import { useDebounce } from "@/hooks/useDebounce";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import type { RunmoaContentType, RunmoaStatus } from "@/types/runmoa";

const ITEMS_PER_PAGE = 20;

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR").format(price);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
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
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">수정</th>
              </tr>
            </thead>
            <tbody>
              {contents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                    {loading ? "불러오는 중..." : "콘텐츠가 없습니다."}
                  </td>
                </tr>
              ) : (
                contents.map((c) => (
                  <tr
                    key={c.content_id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => handleOpenEdit(c.content_id)}
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
                          <div className="font-medium text-gray-900 text-sm truncate max-w-xs">
                            {c.title}
                          </div>
                          {c.description_html && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                              {stripHtml(c.description_html).slice(0, 60)}
                            </div>
                          )}
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
                        {c.categories.map((cat) => cat.name).join(", ") || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenEdit(c.content_id); }}
                          className="p-2 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors"
                          title="Runmoa에서 수정"
                        >
                          <ExternalLink size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
    </div>
  );
}
