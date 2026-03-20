"use client";

import { Users, BookOpen, Star, MessageSquare, TrendingUp, Eye } from "lucide-react";
import { DEMO_STATS } from "@/lib/demo-data";

const DASHBOARD_CARDS = [
  { label: "총 수강생", value: "1,500명", icon: Users, change: "+12%", color: "text-blue-600 bg-blue-50" },
  { label: "활성 프로그램", value: "4개", icon: BookOpen, change: "+1", color: "text-green-600 bg-green-50" },
  { label: "수강 후기", value: "48건", icon: Star, change: "+5", color: "text-yellow-600 bg-yellow-50" },
  { label: "신규 문의", value: "3건", icon: MessageSquare, change: "NEW", color: "text-red-600 bg-red-50" },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1">AISH 관리자 대시보드에 오신 것을 환영합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {DASHBOARD_CARDS.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon size={20} />
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                {card.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 활동</h3>
          <div className="space-y-3">
            {[
              { text: "새로운 수강 후기가 등록되었습니다.", time: "5분 전" },
              { text: "AI 기초 정규과정 11기 수강생 3명 등록", time: "1시간 전" },
              { text: "협력 문의가 접수되었습니다.", time: "3시간 전" },
              { text: "FAQ가 업데이트되었습니다.", time: "어제" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 mt-2 rounded-full bg-primary-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{item.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">사이트 실적</h3>
          <div className="space-y-4">
            {DEMO_STATS.map((stat) => (
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
    </div>
  );
}
