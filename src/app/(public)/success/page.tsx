"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, Building2, Quote, ArrowRight } from "lucide-react";
import { cn, isExternalHref } from "@/lib/utils";
import { getCollection, COLLECTIONS } from "@/lib/firestore";
import { DEMO_SUCCESS_CASES } from "@/lib/demo-data";
import type { SuccessCase } from "@/types/success-case";

function sortVisible(list: SuccessCase[]): SuccessCase[] {
  return list
    .filter((c) => !c.hidden)
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
}

export default function SuccessPage() {
  const [cases, setCases] = useState<SuccessCase[]>(() => sortVisible(DEMO_SUCCESS_CASES));
  const [selected, setSelected] = useState<SuccessCase | null>(null);

  useEffect(() => {
    getCollection<SuccessCase>(COLLECTIONS.SUCCESS_CASES)
      .then((data) => {
        if (data.length > 0) setCases(sortVisible(data));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="py-16">
      <div className="max-w-6xl mx-auto px-4">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-brand-dark uppercase tracking-tight mb-3">성공사례</h1>
          <p className="text-lg text-gray-500">기업들이 AI를 어떻게 활용해 성장하고 변화했는지 확인하세요.</p>
        </div>

        {/* Cards */}
        {cases.length === 0 ? (
          <div className="text-center py-16 text-gray-400">등록된 성공사례가 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cases.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="text-left bg-white rounded-sm border border-brand-border shadow-sm overflow-hidden flex flex-col hover-lift hover:border-t-4 hover:border-t-brand-blue transition-all"
              >
                <div className="aspect-[16/9] bg-gradient-to-br from-brand-gray to-blue-50 flex items-center justify-center relative overflow-hidden">
                  <Building2 size={36} className="text-gray-300 absolute" aria-hidden />
                  {c.thumbnailUrl && (
                    <img
                      src={c.thumbnailUrl}
                      alt={c.title}
                      className="relative w-full h-full object-cover object-top"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                    <span className="font-semibold text-brand-blue">{c.companyName}</span>
                    {c.industry && <><span className="text-gray-300">·</span><span>{c.industry}</span></>}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{c.title}</h3>
                  {c.summary && <p className="text-sm text-gray-500 mb-4 flex-1 line-clamp-3">{c.summary}</p>}
                  {c.metrics && c.metrics.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-3">
                      {c.metrics.slice(0, 3).map((m, i) => (
                        <div key={i} className="text-center">
                          <div className="text-lg font-bold text-brand-blue leading-none">{m.value}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {c.tags && c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                      {c.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="px-5 pb-4 text-sm font-medium text-brand-blue inline-flex items-center gap-1">
                  자세히 보기 <ArrowRight size={14} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && <SuccessCaseModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div>
      <h4 className="text-sm font-bold text-brand-blue mb-1.5">{title}</h4>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{children}</p>
    </div>
  );
}

function SuccessCaseModal({ item, onClose }: { item: SuccessCase; onClose: () => void }) {
  const cta = item.ctaLink?.trim();
  const external = cta ? isExternalHref(cta) : false;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative">
          <div className="aspect-[21/9] bg-gradient-to-br from-brand-gray to-blue-50 flex items-center justify-center overflow-hidden">
            <Building2 size={48} className="text-gray-300 absolute" aria-hidden />
            {item.thumbnailUrl && (
              <img src={item.thumbnailUrl} alt={item.title} className="relative w-full h-full object-cover object-top"
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/90 text-gray-600 hover:bg-white shadow"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              {item.companyLogoUrl ? (
                <img src={item.companyLogoUrl} alt={item.companyName} className="h-5 w-auto object-contain" />
              ) : (
                <span className="font-semibold text-brand-blue">{item.companyName}</span>
              )}
              {item.industry && <><span className="text-gray-300">·</span><span>{item.industry}</span></>}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{item.title}</h2>
            {item.summary && <p className="text-sm text-gray-500 mt-1.5">{item.summary}</p>}
          </div>

          {/* Metrics */}
          {item.metrics && item.metrics.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {item.metrics.map((m, i) => (
                <div key={i} className="rounded-xl bg-brand-gray/60 py-3 text-center">
                  <div className="text-xl font-bold text-brand-blue leading-none">{m.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          )}

          <Section title="도입 전 과제">{item.challenge}</Section>
          <Section title="AI 솔루션">{item.solution}</Section>
          <Section title="성과·변화">{item.result}</Section>

          {item.testimonial && (
            <div className="rounded-xl border-l-4 border-brand-blue bg-blue-50/50 p-4">
              <Quote size={16} className="text-brand-blue mb-1" />
              <p className="text-sm text-gray-700 italic leading-relaxed">{item.testimonial}</p>
              {item.testimonialAuthor && <p className="text-xs text-gray-500 mt-2">— {item.testimonialAuthor}</p>}
            </div>
          )}

          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">#{t}</span>
              ))}
            </div>
          )}

          {cta && (
            <a
              href={cta}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-sm bg-brand-blue text-white text-sm font-semibold uppercase tracking-widest hover:bg-brand-blue transition-colors"
            >
              {item.ctaText?.trim() || "문의하기"}
              {external && <ExternalLink size={16} />}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
