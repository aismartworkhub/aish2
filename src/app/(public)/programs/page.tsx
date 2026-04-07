"use client";

import { useState, useEffect, useMemo } from "react";
import { ExternalLink, Search } from "lucide-react";
import { DEMO_PROGRAMS } from "@/lib/demo-data";
import { getRunmoaContents, getRunmoaCategories } from "@/lib/runmoa-api";
import {
  RUNMOA_CONTENT_TYPE_LABELS,
  RUNMOA_STATUS_LABELS,
  RUNMOA_STATUS_COLORS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import type { RunmoaContent, RunmoaCategory } from "@/types/runmoa";

const RUNMOA_BASE = "https://aish.runmoa.com";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR").format(price);
}

export default function ProgramsPage() {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [contents, setContents] = useState<RunmoaContent[]>([]);
  const [categories, setCategories] = useState<RunmoaCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    Promise.all([
      getRunmoaContents({ status: "publish", limit: 100 }),
      getRunmoaCategories(),
    ])
      .then(([res, cats]) => {
        if (res.data.length > 0) {
          setContents(res.data);
          setCategories(cats);
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
      return DEMO_PROGRAMS.filter((p) => {
        if (p.status === "CLOSED") return false;
        if (debouncedSearch && !p.title.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
        return true;
      });
    }
    return contents.filter((c) => {
      if (filter !== "ALL" && !c.category_ids.includes(Number(filter))) return false;
      if (debouncedSearch && !c.title.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      return true;
    });
  }, [contents, filter, debouncedSearch, useFallback]);

  return (
    <div className="py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">교육 프로그램</h1>
          <p className="text-lg text-gray-500">AISH의 다양한 AI 교육 과정을 확인하세요.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="프로그램 검색..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {!useFallback && categoryOptions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter("ALL")}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium",
                  filter === "ALL" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600"
                )}
              >
                전체
              </button>
              {categoryOptions.map((cat) => (
                <button
                  key={cat.category_id}
                  onClick={() => setFilter(String(cat.category_id))}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium",
                    filter === String(cat.category_id)
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}

        {/* Runmoa 콘텐츠 카드 */}
        {!loading && !useFallback && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(filtered as RunmoaContent[]).map((c) => (
              <div key={c.content_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                {c.featured_image ? (
                  <div className="h-40 overflow-hidden">
                    <img
                      src={c.featured_image}
                      alt={c.title}
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : (
                  <div className="h-40 bg-gradient-to-br from-primary-50 to-blue-50 flex items-center justify-center">
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
                  {c.description_html && (
                    <p className="text-sm text-gray-500 mb-3 flex-1 line-clamp-3">
                      {stripHtml(c.description_html).slice(0, 120)}
                    </p>
                  )}
                  <div className="text-sm mb-4">
                    {c.is_free ? (
                      <span className="text-green-600 font-semibold">무료</span>
                    ) : c.is_on_sale && c.sale_price > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-semibold">₩{formatPrice(c.sale_price)}</span>
                        <span className="text-xs text-gray-400 line-through">₩{formatPrice(c.base_price)}</span>
                      </div>
                    ) : c.base_price > 0 ? (
                      <span className="text-gray-900 font-semibold">₩{formatPrice(c.base_price)}</span>
                    ) : null}
                  </div>

                  <a
                    href={`${RUNMOA_BASE}/classes/${c.content_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
                  >
                    자세히 보기
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 폴백: 기존 데모 프로그램 카드 */}
        {!loading && useFallback && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(filtered as typeof DEMO_PROGRAMS).map((program) => (
              <div key={program.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="h-40 bg-gradient-to-br from-primary-50 to-blue-50 flex items-center justify-center">
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
                      className="mt-auto w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
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
