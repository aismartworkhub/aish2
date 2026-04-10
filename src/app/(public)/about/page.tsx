"use client";

import { useState, useEffect } from "react";
import { Target, Eye, Heart, Users, Award, TrendingUp, Star, Lightbulb, Rocket, Zap } from "lucide-react";
import DOMPurify from "dompurify";
import { DEMO_HISTORY, DEMO_PARTNERS } from "@/lib/demo-data";
import { getCollection, COLLECTIONS } from "@/lib/firestore";
import { loadPageContent, DEFAULT_ABOUT } from "@/lib/page-content-public";
import type { AboutPageContent } from "@/types/page-content";

const ICON_MAP: Record<string, React.ElementType> = {
  Target, Eye, Heart, Users, Award, TrendingUp, Star, Lightbulb, Rocket, Zap,
};

export default function AboutPage() {
  const [history, setHistory] = useState(DEMO_HISTORY);
  const [partners, setPartners] = useState(DEMO_PARTNERS);
  const [loading, setLoading] = useState(true);
  const [pc, setPc] = useState<AboutPageContent>(DEFAULT_ABOUT);

  useEffect(() => {
    loadPageContent<AboutPageContent>("about").then(setPc).catch(() => {});
  }, []);

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
        style={{ backgroundImage: `url('${pc.hero.imageUrl}')` }}
      >
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white uppercase tracking-tight mb-4">
            {pc.hero.title}
          </h1>
          <p className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto">
            {pc.hero.subtitle}
          </p>
        </div>
      </div>

      <div className="py-16">
        {/* Values */}
        <section className="max-w-5xl mx-auto px-4 mb-20">
          <h2 className="text-2xl font-bold text-center text-brand-dark uppercase tracking-tight mb-10">
            {pc.sections.values?.title ?? "핵심 가치"}
          </h2>
          {pc.sections.values?.description && (
            <div className="text-center text-gray-500 mb-8 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(pc.sections.values.description) }} />
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pc.values.map((v) => {
              const Icon = ICON_MAP[v.icon] || Star;
              return (
                <div key={v.title} className="text-center p-6 rounded-sm bg-white border border-brand-border shadow-sm">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-sm bg-brand-gray flex items-center justify-center text-brand-blue">
                    <Icon size={28} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{v.title}</h3>
                  <p className="text-sm text-gray-500">{v.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-border border-t-brand-blue rounded-full animate-spin" />
          </div>
        )}

        {/* History */}
        <section className="max-w-3xl mx-auto px-4 mb-20">
          <h2 className="text-2xl font-bold text-center text-brand-dark uppercase tracking-tight mb-10">{pc.sections.history?.title ?? "연혁"}</h2>
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
          <h2 className="text-2xl font-bold text-center text-brand-dark uppercase tracking-tight mb-10">{pc.sections.partners?.title ?? "파트너"}</h2>
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
