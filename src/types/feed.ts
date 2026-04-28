/**
 * 통합 피드 — 6 소스(콘텐츠·커뮤니티·프로그램·강사·이벤트·자료)를 한 줄로 흐르게 하는
 * 표준 FeedItem 타입.
 *
 * - kind discriminated union으로 카드 컴포넌트가 적절한 모양 렌더
 * - pinned: 관리자가 isPinned=true 설정한 항목 (최상단 고정)
 * - sortKey: 정렬용 ms timestamp (lastActivityAt || createdAt)
 */

import type { Content } from "./content";
import type { Program, AdminEvent, Instructor } from "./firestore";

export type FeedItemKind = "content" | "program" | "event" | "instructor";

export type FeedCategoryKey = "all" | FeedItemKind | "media" | "community";

export interface FeedItemBase {
  id: string;
  kind: FeedItemKind;
  pinned?: boolean;
  /** 정렬용 epoch ms — lastActivityAt 또는 createdAt 또는 startDate에서 도출 */
  sortKey: number;
}

export type FeedItem =
  | (FeedItemBase & { kind: "content"; data: Content })
  | (FeedItemBase & { kind: "program"; data: Program })
  | (FeedItemBase & { kind: "event"; data: AdminEvent })
  | (FeedItemBase & { kind: "instructor"; data: Instructor });

export interface FeedFetchOpts {
  /** 카테고리 필터 — "all"이면 모든 종류 */
  category: FeedCategoryKey;
  /** 한 번에 가져올 콘텐츠 개수 (콘텐츠 외 종류는 인터리브로 추가됨) */
  pageSize?: number;
  /** 인터리브 패턴 — 0이면 비활성 */
  interleaveProgram?: number;
  interleaveInstructor?: number;
  interleaveEvent?: number;
}

export const FEED_CATEGORIES: { key: FeedCategoryKey; label: string; icon: string }[] = [
  { key: "all", label: "전체", icon: "✨" },
  { key: "media", label: "콘텐츠", icon: "📺" },
  { key: "community", label: "커뮤니티", icon: "💬" },
  { key: "program", label: "프로그램", icon: "🎓" },
  { key: "instructor", label: "강사", icon: "👤" },
  { key: "event", label: "이벤트", icon: "📅" },
];
