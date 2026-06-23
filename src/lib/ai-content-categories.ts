/**
 * AI 콘텐츠 카테고리 정의 — 수집·큐레이션·UI·자동화·썸네일 fallback 모두의 공통 분기축.
 *
 * 카테고리는 관리자 의도에 따라 3종으로 나뉘며, 각 카테고리에:
 * - 활성 소스 (collector fetchers)
 * - 큐레이션 boardHints (Gemini 프롬프트에 전달되어 분류 정확도 ↑)
 * - 카드 라벨·아이콘 (UI)
 * - 향후 cron 주기·자동공개 정책·썸네일 fallback 체인
 */

import type { ContentSource } from "@/lib/ai-content-collector";
import type { BoardCurationHint } from "@/lib/ai-content-curator";

export type AiCategory = "video" | "article" | "resource";

export const ALL_CATEGORIES: AiCategory[] = ["video", "article", "resource"];

export const CATEGORY_LABELS: Record<AiCategory, string> = {
  video: "유튜브 영상",
  article: "게시판글",
  resource: "교육자료",
};

export const CATEGORY_DESCRIPTIONS: Record<AiCategory, string> = {
  video: "YouTube에서 강의·인터뷰·홍보 영상을 수집합니다.",
  article: "Reddit·X 등 소셜·뉴스 흐름에서 시의성 있는 글을 수집합니다.",
  resource: "GitHub 등 학습 자원·도구·논문을 수집합니다.",
};

/** 카테고리 → 활성 소스 (수집 시 해당 fetcher만 실행) */
export const CATEGORY_SOURCES: Record<AiCategory, ContentSource[]> = {
  video: ["youtube"],
  article: ["hackernews", "devto", "reddit", "xcom"],
  resource: ["github"],
};

/** 카테고리 → 큐레이션 boardHints (Gemini 프롬프트가 보드 분류 정책 인식하도록 전달) */
export const CATEGORY_BOARD_HINTS: Record<AiCategory, BoardCurationHint[]> = {
  video: [
    { boardKey: "media-lecture", label: "강의 영상", maxItems: 5, sources: ["youtube"] },
    { boardKey: "media-promo", label: "홍보 영상", maxItems: 3, sources: ["youtube"] },
    { boardKey: "media-interview", label: "강사 인터뷰", maxItems: 3, sources: ["youtube"] },
    { boardKey: "media-workathon", label: "워크톤 현장", maxItems: 3, sources: ["youtube"] },
  ],
  article: [
    { boardKey: "community-notice", label: "공지·뉴스룸", maxItems: 5, sources: ["hackernews", "devto", "reddit", "xcom"] },
    { boardKey: "community-free", label: "자유", maxItems: 5, sources: ["hackernews", "devto", "reddit", "xcom"] },
  ],
  resource: [
    { boardKey: "media-resource", label: "추천자료", maxItems: 5, sources: ["github"] },
  ],
};

/** 보드 키 → 소속 카테고리 역매핑 (UI 그룹핑·통계 카테고리화에 활용) */
export const BOARD_TO_CATEGORY: Record<string, AiCategory> = (() => {
  const map: Record<string, AiCategory> = {};
  for (const cat of ALL_CATEGORIES) {
    for (const hint of CATEGORY_BOARD_HINTS[cat]) {
      map[hint.boardKey] = cat;
    }
  }
  return map;
})();

/** 보드 키 → 카테고리 (매핑 없으면 undefined) */
export function categoryOfBoard(boardKey: string): AiCategory | undefined {
  return BOARD_TO_CATEGORY[boardKey];
}
