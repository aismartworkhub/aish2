/** 통합 콘텐츠 플랫폼 타입 정의 */

// ── 게시판 설정 ──

export type BoardGroup = "media" | "community";
export type BoardLayout = "grid" | "list" | "faq";
export type BoardWriteRole = "admin" | "member";

export interface BoardConfig {
  key: string;
  label: string;
  group: BoardGroup;
  layout: BoardLayout;
  writeRole: BoardWriteRole;
  allowComments: boolean;
  allowLikes: boolean;
  allowBookmarks: boolean;
  requireApproval: boolean;
  icon?: string;
  order: number;
  isActive: boolean;
}

// ── 콘텐츠 유형 (MediaType) ──

export type MediaType = "youtube" | "image" | "gif" | "pdf" | "link" | "none";

// ── 통합 콘텐츠 ──

export interface Content {
  id: string;
  boardKey: string;
  /** boards.{boardKey}.group 의 denormalized 사본. createContent/updateContent 시 자동 채워짐. */
  group?: BoardGroup;

  title: string;
  /** 비어 있으면 미사용. 있으면 공개 페이지에서 title 대신 표시(영문 원제목은 title에 유지) */
  titleKo?: string;
  body?: string;
  /** 비어 있으면 미사용. 있으면 공개 페이지에서 body 대신 표시 */
  bodyKo?: string;

  mediaType?: MediaType;
  mediaUrl?: string;
  thumbnailUrl?: string;
  isShort?: boolean;

  rating?: number;
  programTitle?: string;

  question?: string;
  answer?: string;

  authorUid: string;
  authorName: string;
  authorPhotoURL?: string;
  tags?: string[];
  isPinned?: boolean;
  isApproved?: boolean;
  views: number;
  likeCount: number;
  commentCount: number;
  createdAt: unknown;
  updatedAt?: unknown;
}

export type ContentInput = Omit<Content, "id" | "views" | "likeCount" | "commentCount" | "createdAt" | "updatedAt">;

// ── 통합 댓글 ──

export interface ContentComment {
  id: string;
  contentId: string;
  parentId?: string | null;
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string | null;
  body: string;
  createdAt: unknown;
}

export type ContentCommentInput = Omit<ContentComment, "id" | "createdAt">;

// ── 통합 리액션 ──

export type ReactionType = "like" | "bookmark";

export interface Reaction {
  id: string;
  contentId: string;
  userId: string;
  type: ReactionType;
  createdAt: unknown;
}

// ── URL 자동 감지 결과 ──

export interface DetectedMedia {
  mediaType: MediaType;
  thumbnailUrl?: string;
  embedUrl?: string;
}
