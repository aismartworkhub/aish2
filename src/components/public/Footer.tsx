"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SITE_NAME, SITE_FULL_NAME, CTA_URL, CTA_TEXT, NAV_ITEMS } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Info */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img
                src="/images/logo-aish-white.png"
                alt={SITE_NAME}
                className="h-8"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="text-xl font-bold text-white">{SITE_NAME}</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              {SITE_FULL_NAME} - 미래를 선도하는 AI 교육 플랫폼.
              체계적인 교육과 실무 중심 연구로 AI 시대의 인재를 양성합니다.
            </p>
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">바로가기</h4>
            <ul className="space-y-2">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">수강 신청</h4>
            <p className="text-sm text-gray-400 leading-relaxed mb-5">
              AI 시대를 준비하는 가장 스마트한 방법, AISH와 함께 시작하세요.
            </p>
            <Link
              href={CTA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              {CTA_TEXT}
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
