"use client";

import { useState, useEffect } from "react";
import { Users, BookOpen, Star, MessageSquare } from "lucide-react";
import { COLLECTIONS, getCollection, getSingletonDoc } from "@/lib/firestore";
import { DEMO_STATS } from "@/lib/demo-data";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState([
    { label: "총 수강생", value: "...", icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "활성 프로그램", value: "...", icon: BookOpen, color: "text-green-600 bg-green-50" },
    { label: "수강 후기", value: "...", icon: Star, color: "text-yellow-600 bg-yellow-50" },
    { label: "신규 문의", value: "...", icon: MessageSquare, color: "text-red-600 bg-red-50" },
  ]);
  const [siteStats, setSiteStats] = useState(DEMO_STATS);

  useEffect(() => {
    Promise.all([
      getCollection<{ id: string }>(COLLECTIONS.PROGRAMS),
      getCollection<{ id: string }>(COLLECTIONS.REVIEWS),
      getCollection<{ id: string; status: string }>(COLLECTIONS.INQUIRIES),
      getCollection<{ id: string }>(COLLECTIONS.CERTIFICATES_GRADUATES),
      getSingletonDoc<{ items: typeof DEMO_STATS }>(COLLECTIONS.SETTINGS, "stats"),
    ]).then(([programs, reviews, inquiries, graduates, statsDoc]) => {
      const newInquiries = inquiries.filter((i) => i.status === "NEW").length;
      setStats([
        { label: "총 수강생", value: `${graduates.length}명`, icon: Users, color: "text-blue-600 bg-blue-50" },
        { label: "활성 프로그램", value: `${programs.length}개`, icon: BookOpen, color: "text-green-600 bg-green-50" },
        { label: "수강 후기", value: `${reviews.length}건`, icon: Star, color: "text-yellow-600 bg-yellow-50" },
        { label: "신규 문의", value: `${newInquiries}건`, icon: MessageSquare, color: "text-red-600 bg-red-50" },
      ]);
      if (statsDoc?.items && statsDoc.items.length > 0) setSiteStats(statsDoc.items);
    }).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1">AISH 관리자 대시보드에 오신 것을 환영합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon size={20} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">사이트 실적</h3>
        <div className="space-y-4">
          {siteStats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{stat.label}</span>
              <span className="text-lg font-bold text-gray-900">
                {stat.value.toLocaleString()}
                <span className="text-sm font-normal text-gray-400 ml-1">{stat.unit}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
