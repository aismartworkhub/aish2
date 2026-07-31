"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Building2 } from "lucide-react";
import { getCollection, COLLECTIONS } from "@/lib/firestore";
import { DEMO_SUCCESS_CASES } from "@/lib/demo-data";
import type { SuccessCase } from "@/types/success-case";

function topVisible(list: SuccessCase[], n: number): SuccessCase[] {
  return list
    .filter((c) => !c.hidden)
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
    .slice(0, n);
}

/**
 * 홈 성공사례 티저 — 상위 3건 미리보기 + 전체 보기 링크(/success).
 * 자체완결형(자기 데이터 fetch)이라 어떤 홈 템플릿에서도 동일하게 노출된다.
 */
export default function SuccessCasesTeaser() {
  const [cases, setCases] = useState<SuccessCase[]>(() => topVisible(DEMO_SUCCESS_CASES, 3));

  useEffect(() => {
    getCollection<SuccessCase>(COLLECTIONS.SUCCESS_CASES)
      .then((data) => {
        if (data.length > 0) setCases(topVisible(data, 3));
      })
      .catch(() => {});
  }, []);

  if (cases.length === 0) return null;

  return (
    <section className="py-16 bg-brand-gray">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">성공사례</h2>
            <p className="mt-2 text-gray-600">기업들이 AI로 이룬 변화와 성과를 확인하세요.</p>
          </div>
          <Link href="/success" className="hidden sm:flex items-center text-brand-blue font-medium hover:text-brand-blue/80 transition-colors">
            전체 보기 <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cases.map((c) => (
            <Link
              key={c.id}
              href="/success"
              className="group flex flex-col bg-white rounded-sm border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <div className="relative h-40 w-full bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden flex items-center justify-center">
                <Building2 size={36} className="text-gray-300 absolute" aria-hidden />
                {c.thumbnailUrl && (
                  <img src={c.thumbnailUrl} alt={c.title} className="relative w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                )}
              </div>
              <div className="p-5 flex flex-col flex-grow">
                <div className="text-xs text-brand-blue font-semibold mb-1">
                  {c.companyName}{c.industry ? ` · ${c.industry}` : ""}
                </div>
                <h3 className="text-base font-bold text-gray-900 leading-snug group-hover:text-brand-blue transition-colors line-clamp-2">{c.title}</h3>
                {c.metrics && c.metrics.length > 0 && (
                  <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-50">
                    {c.metrics.slice(0, 3).map((m, i) => (
                      <div key={i}>
                        <div className="text-lg font-bold text-brand-blue leading-none">{m.value}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

        <Link href="/success" className="sm:hidden mt-6 w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-sm font-medium flex items-center justify-center">
          전체 보기 <ChevronRight className="w-4 h-4 ml-1" />
        </Link>
      </div>
    </section>
  );
}
