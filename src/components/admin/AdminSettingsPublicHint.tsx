"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminSettingsHintTab =
  | "hero"
  | "stats"
  | "cta"
  | "banner"
  | "integrations"
  | "theme"
  | "ai"
  | "phases"
  | "sections";

const COPY: Record<
  AdminSettingsHintTab,
  { title: string; lines: string[]; publicPath: string; publicLabel: string }
> = {
  hero: {
    title: "공개 페이지에 어떻게 반영되나요?",
    lines: [
      "활성화된 히어로 슬라이드 → 메인(/) 최상단 히어로 영역",
      "AI실전마스터 / Specialty 이미지 → 메인 페이지 해당 섹션 카드 배경",
    ],
    publicPath: "/",
    publicLabel: "메인 페이지 열기",
  },
  stats: {
    title: "공개 페이지에 어떻게 반영되나요?",
    lines: ["실적 수치 → 메인(/) 숫자 실적(S5) 그리드"],
    publicPath: "/",
    publicLabel: "메인 페이지 열기",
  },
  cta: {
    title: "공개 페이지에 어떻게 반영되나요?",
    lines: [
      "버튼 문구·URL → 상단 헤더 CTA, 모바일 플로팅 버튼(옵션), 메인 히어로·하단 CTA",
      "연결 URL은 https://… 또는 사이트 내 경로(/programs 등) 형식을 권장합니다.",
    ],
    publicPath: "/",
    publicLabel: "메인에서 확인",
  },
  banner: {
    title: "공개 페이지에 어떻게 반영되나요?",
    lines: ["D-Day 배너 → 메인(/) 상단(퀵배너 아래) 얇은 안내 바"],
    publicPath: "/",
    publicLabel: "메인에서 확인",
  },
  integrations: {
    title: "보안 안내",
    lines: [
      "이 탭의 값은 Firestore 규칙상 일반 방문자가 읽을 수 없습니다.",
      "공개 사이트에는 절대 노출되지 않도록 유지됩니다.",
    ],
    publicPath: "/",
    publicLabel: "공개 홈",
  },
  theme: {
    title: "공개 페이지에 어떻게 반영되나요?",
    lines: [
      "선택한 테마 → 메인(/) 홈페이지 전체 레이아웃·디자인에 즉시 반영",
      "콘텐츠(교육과정·전문가·후기 등)는 테마와 무관하게 동일하게 표시됩니다.",
    ],
    publicPath: "/",
    publicLabel: "메인 페이지 열기",
  },
  ai: {
    title: "AI 콘텐츠 수집이란?",
    lines: [
      "YouTube, GitHub, Reddit 등에서 최신 AI 콘텐츠를 자동 수집하고 Gemini가 한국어로 요약·점수화합니다.",
      "수집된 콘텐츠는 강의 영상·추천자료 등 설정한 게시판에 자동 분류됩니다.",
    ],
    publicPath: "/media",
    publicLabel: "콘텐츠실 열기",
  },
  phases: {
    title: "기능 플래그 (Phase) — 점진 공개 가이드",
    lines: [
      "각 단계는 코드는 이미 배포되어 있고, 여기서 토글로 사용자 노출만 켭니다.",
      "관리자만 → 베타 검증 → 전체 공개 순으로 안전하게 출시하세요.",
    ],
    publicPath: "/",
    publicLabel: "공개 홈",
  },
  sections: {
    title: "섹션 표시 — 메인 페이지 노출 ON/OFF",
    lines: [
      "히어로·실적·프로그램 등 메인 섹션을 켜고 끌 수 있습니다.",
      "비활성화 시 해당 섹션은 사용자에게 보이지 않습니다.",
    ],
    publicPath: "/",
    publicLabel: "메인 페이지 열기",
  },
};

export default function AdminSettingsPublicHint({ tab }: { tab: AdminSettingsHintTab }) {
  const c = COPY[tab];
  // 정의되지 않은 탭은 안전하게 렌더 안 함 (방어)
  if (!c) return null;
  return (
    <div
      className={cn(
        "rounded-xl border p-4 mb-6 text-sm",
        tab === "integrations"
          ? "bg-amber-50/80 border-amber-200 text-amber-900"
          : "bg-blue-50/80 border-blue-200 text-blue-900"
      )}
    >
      <p className="font-semibold mb-2">{c.title}</p>
      <ul className="list-disc list-inside space-y-1 opacity-95">
        {c.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          href={c.publicPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-primary-700 font-medium hover:underline"
        >
          {c.publicLabel}
          <ExternalLink size={14} />
        </a>
        <span className="text-gray-400">|</span>
        <Link href="/admin" className="text-gray-600 hover:text-primary-600 transition-colors">
          대시보드로
        </Link>
      </div>
    </div>
  );
}
