"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, MapPin, Users, Clock, ArrowRight } from "lucide-react";
import { DEMO_WORKATHON } from "@/lib/demo-data";
import { getCollection, COLLECTIONS } from "@/lib/firestore";
import { useSiteCta } from "@/hooks/useSiteCta";
import { isExternalHref } from "@/lib/utils";

export default function WorkathonPage() {
  const [w, setW] = useState(DEMO_WORKATHON);
  const { buttonUrl, buttonText } = useSiteCta();

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
    <div className="py-16">
      <div className="max-w-4xl mx-auto px-4">
        {/* Hero */}
        <div className="text-center mb-12">
          <span className="inline-block bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
            {w.status === "REGISTRATION_OPEN" ? "참가 신청 중" : w.status}
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{w.title}</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">{w.description}</p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <Calendar className="mx-auto text-primary-500 mb-2" size={24} />
            <p className="text-sm text-gray-500">일시</p>
            <p className="font-semibold text-gray-900">{w.eventDate}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <MapPin className="mx-auto text-primary-500 mb-2" size={24} />
            <p className="text-sm text-gray-500">장소</p>
            <p className="font-semibold text-gray-900">{w.venue}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <Users className="mx-auto text-primary-500 mb-2" size={24} />
            <p className="text-sm text-gray-500">참가 현황</p>
            <p className="font-semibold text-gray-900">
              {w.currentParticipantCount}/{w.maxParticipants}명
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <Clock className="mx-auto text-primary-500 mb-2" size={24} />
            <p className="text-sm text-gray-500">회차</p>
            <p className="font-semibold text-gray-900">제{w.edition}회</p>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-12">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">참가 신청 현황</span>
            <span className="text-sm text-gray-500">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-primary-500 to-purple-500 h-3 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-6">프로그램 일정</h2>
          <div className="space-y-4">
            {(w.schedule || []).map((s, i) => (
              <div key={i} className="flex items-start gap-4 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                <span className="text-sm font-mono text-primary-600 w-32 shrink-0">{s.time}</span>
                <div>
                  <p className="font-medium text-gray-900">{s.title}</p>
                  {s.speaker && <p className="text-sm text-gray-400">발표: {s.speaker}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href={buttonUrl}
            target={isExternalHref(buttonUrl) ? "_blank" : undefined}
            rel={isExternalHref(buttonUrl) ? "noopener noreferrer" : undefined}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg transition-shadow"
          >
            {buttonText} <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </div>
  );
}
