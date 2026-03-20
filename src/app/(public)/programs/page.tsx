"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Search, Filter } from "lucide-react";
import { DEMO_PROGRAMS } from "@/lib/demo-data";
import { CTA_URL, CTA_TEXT, PROGRAM_CATEGORY_LABELS, PROGRAM_STATUS_LABELS, PROGRAM_STATUS_COLORS } from "@/lib/constants";

export default function ProgramsPage() {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const filtered = DEMO_PROGRAMS.filter((p) => {
    if (filter !== "ALL" && p.category !== filter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                filter === "ALL" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              전체
            </button>
            {Object.entries(PROGRAM_CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  filter === key ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Program Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((program) => (
            <div key={program.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="h-40 bg-gradient-to-br from-primary-50 to-blue-50 flex items-center justify-center">
                <span className="text-4xl">📚</span>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROGRAM_STATUS_COLORS[program.status]}`}>
                    {PROGRAM_STATUS_LABELS[program.status]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {PROGRAM_CATEGORY_LABELS[program.category]}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{program.title}</h3>
                <p className="text-sm text-gray-500 mb-3 flex-1">{program.summary}</p>
                <div className="text-xs text-gray-400 space-y-1 mb-4">
                  <p>일정: {program.schedule}</p>
                  <p>기간: {program.startDate} ~ {program.endDate}</p>
                  <p>강사: {program.instructors.join(", ")}</p>
                </div>

                {program.status !== "CLOSED" && (
                  <Link
                    href={CTA_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
                  >
                    {CTA_TEXT}
                    <ExternalLink size={16} />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
