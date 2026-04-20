"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, MapPin, Users, Clock, ArrowRight } from "lucide-react";
import { DEMO_WORKATHON } from "@/lib/demo-data";
import { getCollection, COLLECTIONS } from "@/lib/firestore";
import { useSiteCta } from "@/hooks/useSiteCta";
import { isExternalHref } from "@/lib/utils";
import { loadPageContent, DEFAULT_WORKATHON } from "@/lib/page-content-public";
import type { PageContentBase } from "@/types/page-content";

const WORKATHON_STATUS_LABELS: Record<string, string> = {
  REGISTRATION_OPEN: "참가 신청 중",
  REGISTRATION_CLOSED: "신청 마감",
  IN_PROGRESS: "진행 중",
  COMPLETED: "종료",
  CANCELLED: "취소",
  UPCOMING: "예정",
};

export default function WorkathonPage() {
  const [pc, setPc] = useState<PageContentBase>(DEFAULT_WORKATHON);
  const [w, setW] = useState(DEMO_WORKATHON);
  const { buttonUrl, buttonText } = useSiteCta();

  useEffect(() => {
    loadPageContent("workathon").then(setPc).catch(() => {});
  }, []);

  useEffect(() => {
    getCollection<typeof DEMO_WORKATHON & { id?: string; eventDate?: string }>(COLLECTIONS.EVENTS)
      .then((data) => {
        if (data.length === 0) return;
        const sorted = [...data].sort((a, b) => (b.eventDate || "").localeCompare(a.eventDate || ""));
        setW(sorted[0]);
      })
      .catch(() => {});
  }, []);

  const progress = Math.round((w.currentParticipantCount / w.maxParticipants) * 100);

  return (
    <div>
      {/* Hero Banner Image */}
      <div 
        className="w-full h-[300px] md:h-[400px] bg-cover bg-center relative"
        style={{ backgroundImage: `url('${pc.hero.imageUrl || "/images/defaults/workathon-bg.jpg"}')` }}
      >
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center px-4">
          <span className="inline-block bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium mb-4">
            {WORKATHON_STATUS_LABELS[w.status] || w.status}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white uppercase tracking-tight mb-4">
            {w.title}
          </h1>
          <p className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto">
            AISH 경연대회 제{w.edition}회 스마트워크톤
          </p>
        </div>
      </div>

      <div className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-brand-dark tracking-tight mb-4 whitespace-pre-line">
              {w.description}
            </h2>
          </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-white rounded-sm border border-brand-border p-4 text-center hover:border-t-4 hover:border-t-brand-blue">
            <Calendar className="mx-auto text-brand-blue mb-2" size={24} />
            <p className="text-sm text-gray-500">일시</p>
            <p className="font-semibold text-gray-900">{w.eventDate}</p>
          </div>
          <div className="bg-white rounded-sm border border-brand-border p-4 text-center hover:border-t-4 hover:border-t-brand-blue">
            <MapPin className="mx-auto text-brand-blue mb-2" size={24} />
            <p className="text-sm text-gray-500">장소</p>
            <p className="font-semibold text-gray-900">{w.venue}</p>
          </div>
          <div className="bg-white rounded-sm border border-brand-border p-4 text-center hover:border-t-4 hover:border-t-brand-blue">
            <Users className="mx-auto text-brand-blue mb-2" size={24} />
            <p className="text-sm text-gray-500">참가 현황</p>
            <p className="font-semibold text-gray-900">
              {w.currentParticipantCount}/{w.maxParticipants}명
            </p>
          </div>
          <div className="bg-white rounded-sm border border-brand-border p-4 text-center hover:border-t-4 hover:border-t-brand-blue">
            <Clock className="mx-auto text-brand-blue mb-2" size={24} />
            <p className="text-sm text-gray-500">회차</p>
            <p className="font-semibold text-gray-900">제{w.edition}회</p>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-sm border border-brand-border p-6 mb-12">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">참가 신청 현황</span>
            <span className="text-sm text-gray-500">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-sm h-3">
            <div
              className="bg-brand-blue h-3 rounded-sm transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white rounded-sm border border-brand-border p-6 mb-12">
          <h2 className="text-xl font-bold text-brand-dark uppercase tracking-tight mb-6">프로그램 일정</h2>
          <div className="space-y-4">
            {(w.schedule || []).map((s, i) => (
              <div key={i} className="flex items-start gap-4 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                <span className="text-sm font-mono text-brand-blue w-32 shrink-0">{s.time}</span>
                <div>
                  <p className="font-medium text-gray-900">{s.title}</p>
                  {s.speaker && <p className="text-sm text-gray-400">발표: {s.speaker}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        {(() => {
          const ctaHref = (w as { ctaLink?: string }).ctaLink?.trim() || buttonUrl;
          const ctaLabel = (w as { ctaText?: string }).ctaText?.trim() || buttonText;
          const external = isExternalHref(ctaHref);
          return (
            <div className="text-center">
              {external ? (
                <a
                  href={ctaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-brand-blue text-white rounded-sm font-semibold text-lg uppercase tracking-widest hover:shadow-lg transition-shadow"
                >
                  {ctaLabel} <ArrowRight size={20} />
                </a>
              ) : (
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-brand-blue text-white rounded-sm font-semibold text-lg uppercase tracking-widest hover:shadow-lg transition-shadow"
                >
                  {ctaLabel} <ArrowRight size={20} />
                </Link>
              )}
            </div>
          );
        })()}
      </div>
    </div>
    </div>
  );
}
