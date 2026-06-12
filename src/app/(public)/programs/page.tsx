"use client";

import { useState, useEffect, useMemo } from "react";
import { ExternalLink, Search, ArrowUpDown } from "lucide-react";
import { DEMO_PROGRAMS } from "@/lib/demo-data";
import { getRunmoaContents, getRunmoaCategories } from "@/lib/runmoa-api";
import {
  RUNMOA_CONTENT_TYPE_LABELS,
  RUNMOA_STATUS_LABELS,
  RUNMOA_STATUS_COLORS,
} from "@/lib/constants";
import { cn, htmlToPlainTextSummary } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { loadPageContent, DEFAULT_PROGRAMS } from "@/lib/page-content-public";
import {
  loadProgramOverrides, applyProgramOverrides, type ProgramOverrides,
} from "@/lib/program-overrides";
import type { PageContentBase } from "@/types/page-content";
import type { RunmoaContent, RunmoaCategory } from "@/types/runmoa";

const RUNMOA_BASE = "https://aish.runmoa.com";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR").format(price);
}

type SortKey = "recommended" | "newest" | "name" | "priceAsc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "추천순" },
  { key: "newest", label: "최신순" },
  { key: "name", label: "가나다순" },
  { key: "priceAsc", label: "가격 낮은순" },
];

export default function ProgramsPage() {
  const [pc, setPc] = useState<PageContentBase>(DEFAULT_PROGRAMS);
  // 초기값을 URL 쿼리에서 동기 로딩 — 새로고침·공유 시 그대로 복원
  const initialQuery = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [filter, setFilter] = useState(initialQuery?.get("cat") || "ALL");
  const [search, setSearch] = useState(initialQuery?.get("q") || "");
  const [sort, setSort] = useState<SortKey>(
    (initialQuery?.get("sort") as SortKey) || "recommended",
  );
  const debouncedSearch = useDebounce(search);
  const [contents, setContents] = useState<RunmoaContent[]>([]);
  const [overrides, setOverrides] = useState<ProgramOverrides>({});
  const [categories, setCategories] = useState<RunmoaCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  // URL 쿼리 ↔ state 동기화 — 검색·정렬·카테고리 변경 시 주소창 갱신 (push 아닌 replace 로 히스토리 더럽히지 않음)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (sort !== "recommended") params.set("sort", sort);
    if (filter !== "ALL") params.set("cat", filter);
    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", url);
  }, [debouncedSearch, sort, filter]);

  useEffect(() => {
    loadPageContent("programs").then(setPc).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      getRunmoaContents({ status: "publish", limit: 100 }),
      getRunmoaCategories(),
      loadProgramOverrides().catch(() => ({})),
    ])
      .then(([res, cats, ov]) => {
        if (res.data.length > 0) {
          setContents(res.data);
          setCategories(cats);
          setOverrides(ov);
        } else {
          setUseFallback(true);
        }
      })
      .catch(() => {
        setUseFallback(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // 카테고리 필터용 고유 목록
  const categoryOptions = useMemo(() => {
    if (useFallback) return [];
    const unique = new Map<number, RunmoaCategory>();
    contents.forEach((c) =>
      c.categories.forEach((cat) => unique.set(cat.category_id, cat))
    );
    return Array.from(unique.values());
  }, [contents, useFallback]);

  const filtered = useMemo(() => {
    if (useFallback) {
      const list = DEMO_PROGRAMS.filter((p) => {
        if (p.status === "CLOSED") return false;
        if (debouncedSearch && !p.title.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
        return true;
      });
      // 폴백은 정렬 키가 제한적 — 이름순만 지원
      if (sort === "name") return [...list].sort((a, b) => a.title.localeCompare(b.title, "ko"));
      return list;
    }
    const list = contents.filter((c) => {
      if (filter !== "ALL" && !c.category_ids.includes(Number(filter))) return false;
      if (debouncedSearch && !c.title.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      return true;
    });
    // 관리자 숨김 제외 + 추천(지정) 순서 적용. 다른 정렬은 숨김만 반영하고 기준대로 재정렬.
    const visible = applyProgramOverrides(list, overrides);
    if (sort === "recommended") return visible;
    const sorted = [...visible];
    if (sort === "name") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    } else if (sort === "priceAsc") {
      const priceOf = (c: RunmoaContent) => (c.is_free ? 0 : c.is_on_sale ? c.sale_price : c.base_price);
      sorted.sort((a, b) => priceOf(a) - priceOf(b));
    } else {
      // newest — created_at 내림차순
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sorted;
  }, [contents, filter, debouncedSearch, useFallback, sort, overrides]);

  return (
    <div className="py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-brand-dark uppercase tracking-tight mb-3">{pc.hero.title}</h1>
          <p className="text-lg text-gray-500">{pc.hero.subtitle}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="프로그램 검색..."
              className="w-full pl-9 pr-4 py-2.5 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />
          </div>
          {/* 정렬 드롭다운 */}
          <label className="relative inline-flex items-center">
            <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="정렬"
              className="appearance-none pl-9 pr-8 py-2.5 border border-brand-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </label>
          {!useFallback && categoryOptions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter("ALL")}
                className={cn(
                  "px-4 py-2 rounded-sm text-sm font-medium",
                  filter === "ALL" ? "bg-brand-blue text-white" : "bg-gray-100 text-gray-600"
                )}
              >
                전체
              </button>
              {categoryOptions.map((cat) => (
                <button
                  key={cat.category_id}
                  onClick={() => setFilter(String(cat.category_id))}
                  className={cn(
                    "px-4 py-2 rounded-sm text-sm font-medium",
                    filter === String(cat.category_id)
                      ? "bg-brand-blue text-white"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 결과 수 헤더 — 검색/필터/정렬 결과 시각화 */}
        {!loading && (
          <p className="mb-6 text-sm text-gray-500">
            검색 결과 <strong className="text-gray-800">{filtered.length.toLocaleString("ko-KR")}건</strong>
            {debouncedSearch && <> · 검색어 &ldquo;{debouncedSearch}&rdquo;</>}
            {filter !== "ALL" && <> · 카테고리 필터 적용</>}
            <span className="ml-1 text-gray-400">· {SORT_OPTIONS.find((o) => o.key === sort)?.label}</span>
          </p>
        )}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardGridSkeleton count={6} />
          </div>
        )}

        {/* Runmoa 콘텐츠 카드 */}
        {!loading && !useFallback && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(filtered as RunmoaContent[]).map((c) => {
              const descPlain = htmlToPlainTextSummary(c.description_html, 120);
              return (
              <div key={c.content_id} className="bg-white rounded-sm border border-brand-border shadow-sm overflow-hidden flex flex-col hover-lift hover:border-t-4 hover:border-t-brand-blue">
                {c.featured_image ? (
                  <div className="aspect-[16/9] overflow-hidden relative">
                    <img
                      src={c.featured_image}
                      alt={c.title}
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-gradient-to-br from-brand-gray to-blue-50 flex items-center justify-center">
                    <span className="text-4xl">📚</span>
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      RUNMOA_STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"
                    )}>
                      {RUNMOA_STATUS_LABELS[c.status] ?? c.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {RUNMOA_CONTENT_TYPE_LABELS[c.content_type] ?? c.content_type}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{c.title}</h3>
                  {descPlain ? (
                    <p className="text-sm text-gray-500 mb-3 flex-1 line-clamp-3">
                      {descPlain}
                    </p>
                  ) : null}
                  <div className="mb-4">
                    {c.is_free ? (
                      <span className="text-lg font-bold text-green-600">무료</span>
                    ) : c.is_on_sale && c.sale_price > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">₩{formatPrice(c.sale_price)}</span>
                        <span className="text-xs text-gray-400 line-through">₩{formatPrice(c.base_price)}</span>
                      </div>
                    ) : c.base_price > 0 ? (
                      <span className="text-lg font-bold text-gray-900">₩{formatPrice(c.base_price)}</span>
                    ) : null}
                  </div>
                </div>
                <div className="px-5 pb-5 pt-0 mt-auto border-t border-brand-border">
                  <a
                    href={`${RUNMOA_BASE}/classes/${c.content_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-sm bg-brand-blue text-white text-sm font-semibold uppercase tracking-widest hover:bg-brand-blue transition-colors"
                  >
                    자세히 보기
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* 폴백: 기존 데모 프로그램 카드 */}
        {!loading && useFallback && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(filtered as typeof DEMO_PROGRAMS).map((program) => (
              <div key={program.id} className="bg-white rounded-sm border border-brand-border shadow-sm overflow-hidden flex flex-col hover-lift hover:border-t-4 hover:border-t-brand-blue">
                <div className="aspect-[16/9] bg-gradient-to-br from-brand-gray to-blue-50 flex items-center justify-center">
                  <span className="text-4xl">📚</span>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{program.title}</h3>
                  <p className="text-sm text-gray-500 mb-3 flex-1">{program.summary}</p>
                  <div className="text-xs text-gray-400 space-y-1 mb-4">
                    <p>일정: {program.schedule}</p>
                    <p>기간: {program.startDate} ~ {program.endDate}</p>
                    <p>강사: {(program.instructors || []).join(", ")}</p>
                  </div>
                  {program.ctaLink?.trim() && (
                    <a
                      href={program.ctaLink.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-sm bg-brand-blue text-white text-sm font-semibold uppercase tracking-widest hover:bg-brand-blue transition-colors"
                    >
                      {program.ctaText?.trim() || "교육과정 보기"}
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
