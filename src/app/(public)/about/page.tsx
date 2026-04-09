"use client";

import { useState, useEffect } from "react";
import { Target, Eye, Heart, Users, Award, TrendingUp } from "lucide-react";
import { DEMO_HISTORY, DEMO_PARTNERS } from "@/lib/demo-data";
import { getCollection, COLLECTIONS } from "@/lib/firestore";

const VALUES = [
  { icon: Target, title: "체계적 교육", desc: "입문부터 실무까지 단계별 커리큘럼" },
  { icon: Eye, title: "실무 중심", desc: "현업 전문가와 함께하는 프로젝트 기반 학습" },
  { icon: Heart, title: "열린 커뮤니티", desc: "함께 성장하는 AI 교육 생태계" },
];

export default function AboutPage() {
  const [history, setHistory] = useState(DEMO_HISTORY);
  const [partners, setPartners] = useState(DEMO_PARTNERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getCollection<typeof DEMO_HISTORY[0]>(COLLECTIONS.HISTORY),
      getCollection<typeof DEMO_PARTNERS[0]>(COLLECTIONS.PARTNERS),
    ]).then(([h, p]) => {
      if (h.length > 0) setHistory(h.sort((a, b) => `${b.year}${b.month}`.localeCompare(`${a.year}${a.month}`)));
      if (p.length > 0) setPartners(
        p.filter((partner) => (partner as { isActive?: boolean }).isActive !== false)
         .sort((a, b) => ((a as { displayOrder?: number }).displayOrder ?? 999) - ((b as { displayOrder?: number }).displayOrder ?? 999))
      );
    }).catch((err) => console.error('[AboutPage] Firestore fetch failed:', err))
    .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero Banner Image */}
      <div 
        className="w-full h-[300px] md:h-[400px] bg-cover bg-center relative"
        style={{ backgroundImage: "url('/images/defaults/spec-system.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white uppercase tracking-tight mb-4">
            미래를 선도하는 AI 교육 플랫폼
          </h1>
          <p className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto">
            AISH는 체계적인 교육과 실무 중심 연구, 커뮤니티를 통해 AI 시대의 인재를 양성합니다.
          </p>
        </div>
      </div>

      <div className="py-16">
        {/* Values */}
        <section className="max-w-5xl mx-auto px-4 mb-20">
          <h2 className="text-2xl font-bold text-center text-brand-dark uppercase tracking-tight mb-10">핵심 가치</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {VALUES.map((v) => (
              <div key={v.title} className="text-center p-6 rounded-sm bg-white border border-brand-border shadow-sm">
                <div className="w-14 h-14 mx-auto mb-4 rounded-sm bg-brand-gray flex items-center justify-center text-brand-blue">
                  <v.icon size={28} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-500">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-border border-t-brand-blue rounded-full animate-spin" />
          </div>
        )}

        {/* History */}
        <section className="max-w-3xl mx-auto px-4 mb-20">
          <h2 className="text-2xl font-bold text-center text-brand-dark uppercase tracking-tight mb-10">연혁</h2>
          <div className="relative border-l-2 border-brand-border ml-4 space-y-8">
            {history.map((item, i) => (
              <div key={(item as { id?: string }).id || i} className="relative pl-8">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-brand-blue border-2 border-white" />
                <p className="text-sm font-semibold text-brand-blue">
                  {item.year}년 {item.month}월
                </p>
                <p className="text-gray-700">{item.title}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Partners */}
        <section className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-brand-dark uppercase tracking-tight mb-10">파트너</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {partners.map((p, i) => (
              <div
                key={(p as { id?: string }).id || i}
                className="text-center py-6 px-4 rounded-sm border border-brand-border bg-white"
              >
                <p className="font-medium text-gray-800">{p.name}</p>
                <p className="text-xs text-gray-400 mt-1">{p.category}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
