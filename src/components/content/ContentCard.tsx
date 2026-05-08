"use client";

import { useState } from "react";
import { Heart, MessageCircle, Eye, Pin, Bookmark, Share2, Play, BadgeCheck, Megaphone, HelpCircle, Star, Video, BookOpen, User as UserIcon, Trophy, Image as ImageIconLucide } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { contentDisplayTitle, contentDisplayBody } from "@/lib/content-display";
import type { Content, BoardConfig } from "@/types/content";
import MediaPreview from "./MediaPreview";
import SmartThumbnail from "@/components/ui/SmartThumbnail";
import { toggleReaction } from "@/lib/content-engine";
import { useAuth } from "@/contexts/AuthContext";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import LoginModal from "@/components/public/LoginModal";
import { useToast } from "@/components/ui/Toast";

/** 영상 길이(초) → 표시용 라벨 ("12:34", "1:23:45", "" if invalid) */
function formatDurationBadge(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** 원본 시간(YouTube publishedAtSource) → "X시간 전" 형식 */
function sourceTimeAgo(iso: string | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}일 전`;
    return d.toLocaleDateString("ko-KR");
  } catch {
    return "";
  }
}

export type ContentCardVariant = "grid" | "list" | "faq" | "instagram" | "timeline" | "dispatch";

/** Q&A 보드 + 댓글 0건 → 답변 필요 글로 시각 강조 */
function isUnansweredQna(c: Content): boolean {
  return c.boardKey === "community-qna" && (!c.commentCount || c.commentCount === 0);
}

/** 작은 라운드 칩 — '답변 필요' 표시 */
function UnansweredBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
      답변 필요
    </span>
  );
}

/** 보드별 시각 식별자 — 텍스트 전용 글의 카드 fallback에 사용 */
const BOARD_VISUAL: Record<
  string,
  { icon: LucideIcon; gradient: string; iconColor: string; chipBg: string; chipFg: string; label: string }
> = {
  // 커뮤니티 보드
  "community-notice": { icon: Megaphone,    gradient: "from-rose-100 to-rose-200",    iconColor: "text-rose-500",   chipBg: "bg-rose-100",   chipFg: "text-rose-700",   label: "공지" },
  "community-free":   { icon: MessageCircle, gradient: "from-blue-100 to-blue-200",   iconColor: "text-blue-500",   chipBg: "bg-blue-100",   chipFg: "text-blue-700",   label: "자유" },
  "community-qna":    { icon: HelpCircle,   gradient: "from-emerald-100 to-emerald-200", iconColor: "text-emerald-500", chipBg: "bg-emerald-100", chipFg: "text-emerald-700", label: "Q&A" },
  "community-review": { icon: Star,         gradient: "from-amber-100 to-amber-200",  iconColor: "text-amber-500",  chipBg: "bg-amber-100",  chipFg: "text-amber-700",  label: "후기" },
  "community-faq":    { icon: HelpCircle,   gradient: "from-cyan-100 to-cyan-200",    iconColor: "text-cyan-500",   chipBg: "bg-cyan-100",   chipFg: "text-cyan-700",   label: "FAQ" },
  // 미디어 보드 (Phase 3-2)
  "media-lecture":    { icon: Video,        gradient: "from-red-100 to-red-200",      iconColor: "text-red-500",    chipBg: "bg-red-100",    chipFg: "text-red-700",    label: "강의" },
  "media-resource":   { icon: BookOpen,     gradient: "from-violet-100 to-violet-200", iconColor: "text-violet-500", chipBg: "bg-violet-100", chipFg: "text-violet-700", label: "자료" },
  "media-promo":      { icon: Megaphone,    gradient: "from-pink-100 to-pink-200",    iconColor: "text-pink-500",   chipBg: "bg-pink-100",   chipFg: "text-pink-700",   label: "홍보" },
  "media-interview":  { icon: UserIcon,     gradient: "from-indigo-100 to-indigo-200", iconColor: "text-indigo-500", chipBg: "bg-indigo-100", chipFg: "text-indigo-700", label: "인터뷰" },
  "media-workathon":  { icon: Trophy,       gradient: "from-yellow-100 to-yellow-200", iconColor: "text-yellow-600", chipBg: "bg-yellow-100", chipFg: "text-yellow-700", label: "워크톤" },
  "media-gallery":    { icon: ImageIconLucide, gradient: "from-fuchsia-100 to-fuchsia-200", iconColor: "text-fuchsia-500", chipBg: "bg-fuchsia-100", chipFg: "text-fuchsia-700", label: "갤러리" },
};

function getBoardVisual(boardKey: string | undefined) {
  return boardKey ? BOARD_VISUAL[boardKey] : undefined;
}

/**
 * 미디어 없는 글의 카드 fallback — 카테고리 색 + 글 내용을 시각화.
 * 좌상단 카테고리 칩, 가운데 큰 제목, 하단 본문 요약·태그로 카드별 차별화.
 */
function CategoryFallback({ content, compact }: { content: Content; compact?: boolean }) {
  const v = getBoardVisual(content.boardKey);
  if (!v) return null;
  const Icon = v.icon;
  const title = contentDisplayTitle(content);
  const summary = contentDisplayBody(content).replace(/\s+/g, " ").trim();
  const tags = content.tags?.slice(0, 3) ?? [];
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-gradient-to-br", v.gradient, compact ? "p-2" : "p-4")}>
      {/* 큰 배경 아이콘 — 살짝 워터마크 */}
      <Icon
        size={compact ? 56 : 96}
        strokeWidth={1.2}
        className={cn("absolute -bottom-3 -right-3 opacity-15", v.iconColor)}
      />
      <div className="relative flex h-full flex-col">
        {/* 카테고리 칩 */}
        <div className="flex items-center gap-1">
          <Icon size={compact ? 12 : 14} className={v.iconColor} />
          <span className={cn("font-bold", v.iconColor, compact ? "text-[10px]" : "text-xs")}>{v.label}</span>
        </div>
        {/* 제목 */}
        <h4 className={cn(
          "mt-1 font-bold leading-tight text-gray-900",
          compact ? "line-clamp-2 text-xs" : "line-clamp-3 text-base",
        )}>
          {title}
        </h4>
        {/* 본문 요약 */}
        {summary && !compact && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-700/80">
            {summary}
          </p>
        )}
        {/* 태그 — compact에서는 생략 */}
        {tags.length > 0 && !compact && (
          <div className="mt-auto flex flex-wrap gap-1 pt-2">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 외부 자료 링크 + 첨부 카운트 — 카드 하단 칩 행. 콘텐츠가 외부 자료를 가질 때만 노출.
 * (timeline·dispatch 변형에서 호출)
 */
function AttachmentChips({ content }: { content: Content }) {
  const links: { key: string; label: string; href: string; cls: string }[] = [];
  if (content.googleLink) links.push({ key: "drive", label: "Drive", href: content.googleLink, cls: "border-red-200 bg-red-50 text-red-700" });
  if (content.notionLink) links.push({ key: "notion", label: "Notion", href: content.notionLink, cls: "border-gray-200 bg-gray-50 text-gray-700" });
  if (content.slackLink) links.push({ key: "slack", label: "Slack", href: content.slackLink, cls: "border-purple-200 bg-purple-50 text-purple-700" });
  const attachCount = content.attachments?.length ?? 0;
  if (links.length === 0 && attachCount === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {links.map((l) => (
        <a
          key={l.key}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:opacity-80",
            l.cls,
          )}
        >
          {l.label}
        </a>
      ))}
      {attachCount > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
          📎 {attachCount}
        </span>
      )}
    </div>
  );
}

/** 작은 카테고리 칩 — timeline 헤더에 보드 식별 */
function CategoryChip({ boardKey }: { boardKey?: string }) {
  const v = getBoardVisual(boardKey);
  if (!v) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold", v.chipBg, v.chipFg)}>
      {v.label}
    </span>
  );
}

type Props = {
  content: Content;
  board?: BoardConfig;
  onClick?: (content: Content) => void;
  /** 시각 변형 — 기본은 board.layout. 명시 시 오버라이드 (예: /media에서 "instagram"). */
  variant?: ContentCardVariant;
  /** Above-the-fold 가속 — 첫 N개 카드 이미지를 eager + fetchpriority high로 */
  priority?: boolean;
};

function timeAgo(dateVal: unknown): string {
  if (!dateVal) return "";
  const d =
    typeof dateVal === "string"
      ? new Date(dateVal)
      : (dateVal as { toDate?: () => Date }).toDate?.() ?? new Date();
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}일 전`;
  return d.toLocaleDateString("ko-KR");
}

/** 그리드(콘텐츠) 레이아웃 카드 */
function GridCard({ content, onClick, priority }: Omit<Props, "board">) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(content)}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white",
        "text-left transition-shadow hover:shadow-md",
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        {!content.mediaUrl && !content.thumbnailUrl ? (
          <CategoryFallback content={content} />
        ) : (
          <MediaPreview
            mediaUrl={content.mediaUrl}
            mediaType={content.mediaType}
            thumbnailUrl={content.thumbnailUrl}
            title={contentDisplayTitle(content)}
            className="h-full w-full transition-transform duration-200 group-hover:scale-105"
            priority={priority}
          />
        )}
        {content.isShort && (
          <span className={cn(
            "absolute bottom-2 right-2 rounded bg-red-600 px-1.5 py-0.5",
            "text-[10px] font-bold text-white",
          )}>
            SHORT
          </span>
        )}
        {(() => {
          // 7일 이내 → NEW, downloadCount ≥ 10 → 카운트, 그 사이 → 숨김
          const ms = (() => {
            const c = content.createdAt;
            if (!c) return 0;
            if (typeof c === "string") return new Date(c).getTime();
            const ts = c as { toDate?: () => Date; seconds?: number };
            if (typeof ts.toDate === "function") return ts.toDate().getTime();
            if (typeof ts.seconds === "number") return ts.seconds * 1000;
            return 0;
          })();
          const isNew = ms > 0 && Date.now() - ms < 7 * 24 * 60 * 60 * 1000;
          const dl = content.downloadCount ?? 0;
          if (isNew) {
            return (
              <span className="absolute top-2 left-2 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                NEW
              </span>
            );
          }
          if (dl >= 10) {
            return (
              <span className="absolute top-2 left-2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                ↓ {dl.toLocaleString()}
              </span>
            );
          }
          return null;
        })()}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 text-sm font-semibold text-gray-900">
            {content.isPinned && <Pin size={12} className="mr-1 inline text-primary-500" />}
            {contentDisplayTitle(content)}
          </h3>
          {isUnansweredQna(content) && <UnansweredBadge />}
        </div>
        <p className="text-xs text-gray-500">{content.authorName}</p>
        <div className="mt-auto flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-0.5">
            <Eye size={12} /> {content.views}
          </span>
          <span className="flex items-center gap-0.5">
            <Heart size={12} /> {content.likeCount}
          </span>
          <span className="flex items-center gap-0.5">
            <MessageCircle size={12} /> {content.commentCount}
          </span>
          <span className="ml-auto" suppressHydrationWarning>{timeAgo(content.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}

/** 리스트(커뮤니티) 레이아웃 행 */
function ListRow({ content, onClick }: Omit<Props, "board">) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(content)}
      className={cn(
        "flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3",
        "text-left transition-colors hover:bg-gray-50",
        content.isPinned && "bg-primary-50/40",
      )}
    >
      {content.isPinned && <Pin size={14} className="shrink-0 text-primary-500" />}
      <span className="flex-1 truncate text-sm font-medium text-gray-800">
        {contentDisplayTitle(content)}
      </span>
      {isUnansweredQna(content) && <UnansweredBadge />}
      {content.commentCount > 0 && (
        <span className="text-xs text-primary-500">[{content.commentCount}]</span>
      )}
      <span className="shrink-0 text-xs text-gray-400">{content.authorName}</span>
      <span className="shrink-0 text-xs text-gray-400" suppressHydrationWarning>{timeAgo(content.createdAt)}</span>
      <span className="flex shrink-0 items-center gap-0.5 text-xs text-gray-400">
        <Eye size={12} /> {content.views}
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-xs text-gray-400">
        <Heart size={12} /> {content.likeCount}
      </span>
    </button>
  );
}

/**
 * 등록 일시(string|Timestamp) → epoch ms. NEW 배지·다운로드 카운트 분기용.
 */
function createdAtMs(createdAt: unknown): number {
  if (!createdAt) return 0;
  if (typeof createdAt === "string") return new Date(createdAt).getTime();
  const ts = createdAt as { toDate?: () => Date; seconds?: number };
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

/** 좌상단 NEW/다운로드 배지 — 7일 이내 NEW, ≥10회 카운트, 그 사이 숨김 */
function CornerBadge({ content }: { content: Content }) {
  const ms = createdAtMs(content.createdAt);
  const isNew = ms > 0 && Date.now() - ms < 7 * 24 * 60 * 60 * 1000;
  const dl = content.downloadCount ?? 0;
  if (isNew) {
    return (
      <span className="absolute top-2 left-2 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
        NEW
      </span>
    );
  }
  if (dl >= 10) {
    return (
      <span className="absolute top-2 left-2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
        ↓ {dl.toLocaleString()}
      </span>
    );
  }
  return null;
}

/**
 * Instagram Explore 스타일 카드.
 * - 보더·패딩 없음, rounded-md만
 * - 미디어 자연 비율 (aspect-video 강제 X)
 * - hover/포커스 시 어두운 그라데이션 + 제목·뷰·좋아요 오버레이
 * - 좌상단 NEW/다운로드 배지
 */
function InstagramCard({ content, onClick, priority }: Omit<Props, "board" | "variant">) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(content)}
      className={cn(
        "group relative block w-full overflow-hidden rounded-md bg-gray-100 text-left",
        "transition-shadow hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
      )}
    >
      <div className="relative w-full">
        <MediaPreview
          mediaUrl={content.mediaUrl}
          mediaType={content.mediaType}
          thumbnailUrl={content.thumbnailUrl}
          title={contentDisplayTitle(content)}
          className="block w-full transition-transform duration-300 group-hover:scale-[1.03]"
          priority={priority}
        />
        {content.isShort && (
          <span className="absolute bottom-2 right-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            SHORT
          </span>
        )}
        <CornerBadge content={content} />

        {/* hover/탭 오버레이 — 제목 + 메타 */}
        <div className={cn(
          "pointer-events-none absolute inset-0 flex flex-col justify-end",
          "bg-gradient-to-t from-black/75 via-black/30 to-transparent",
          "opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100",
          "max-md:opacity-100", // 모바일은 항상 노출 (hover 불가)
        )}>
          <div className="p-3 text-white">
            <h3 className="line-clamp-1 text-sm font-semibold">
              {content.isPinned && <Pin size={12} className="mr-1 inline" />}
              {contentDisplayTitle(content)}
            </h3>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-white/85">
              <span className="flex items-center gap-0.5"><Eye size={11} /> {content.views}</span>
              <span className="flex items-center gap-0.5"><Heart size={11} /> {content.likeCount}</span>
              {content.commentCount > 0 && (
                <span className="flex items-center gap-0.5"><MessageCircle size={11} /> {content.commentCount}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

/**
 * X(트위터) 스타일 타임라인 카드.
 * - 작성자 아바타 + 이름 + 시간 (상단 1줄)
 * - 본문 (line-clamp 6줄, "더 보기" 펼침)
 * - 미디어 임베드 인라인 (썸네일/이미지/PDF/링크)
 * - 하단 액션 바: 💬 댓글 / ❤ 좋아요 / 🔖 북마크 / 🔗 공유
 *   (이번 단계는 카운트만 표시·클릭은 카드 onClick으로 모달 진입.
 *   Sprint D Batch 2에서 인라인 토글로 교체.)
 */
function TimelineCard({ content, onClick, priority }: Omit<Props, "board" | "variant">) {
  const ms = createdAtMs(content.createdAt);
  const { user } = useAuth();
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const { toast } = useToast();
  // 낙관적 토글 — 첫 마운트 시점의 reactions은 모르므로, 사용자 클릭한 횟수만 추적.
  // Firestore와 정확히 동기화되지 않더라도 즉각 피드백 + 카운트는 서버 truth로 갱신.
  const [likedDelta, setLikedDelta] = useState(0); // -1, 0, 1
  const [bookmarked, setBookmarked] = useState(false);
  const [busyLike, setBusyLike] = useState(false);
  const [busyBookmark, setBusyBookmark] = useState(false);

  const displayLikeCount = Math.max(0, content.likeCount + likedDelta);
  const isLiked = likedDelta > 0;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      requireLogin(() => undefined, "좋아요는 로그인 후 가능합니다.");
      return;
    }
    if (busyLike) return;
    setBusyLike(true);
    try {
      const isNow = await toggleReaction(content.id, user.uid, "like");
      setLikedDelta(isNow ? 1 : -1);
    } catch {
      // 실패 시 원복
    } finally {
      setBusyLike(false);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      requireLogin(() => undefined, "북마크는 로그인 후 가능합니다.");
      return;
    }
    if (busyBookmark) return;
    setBusyBookmark(true);
    try {
      const isNow = await toggleReaction(content.id, user.uid, "bookmark");
      setBookmarked(isNow);
    } catch {
      // 실패 무시
    } finally {
      setBusyBookmark(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/media?id=${content.id}`
      : `/media?id=${content.id}`;
    const data = {
      title: contentDisplayTitle(content),
      text: content.body?.slice(0, 100) ?? "",
      url,
    };
    try {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav && "share" in nav && typeof nav.share === "function") {
        await nav.share(data);
      } else if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
        toast("링크가 복사되었습니다.", "success");
      }
    } catch {
      // 사용자 취소 등 무시
    }
  };

  // YouTube 콘텐츠는 채널 헤더로 표시 (X.com 스타일)
  const isYouTube = content.mediaType === "youtube" && !!content.channelTitle;
  const headerName = isYouTube ? content.channelTitle! : content.authorName;
  const headerHandle = isYouTube && content.channelId ? `@${content.channelId.slice(0, 14)}` : undefined;
  const headerTime = isYouTube && content.publishedAtSource
    ? sourceTimeAgo(content.publishedAtSource)
    : ms > 0
      ? timeAgo(content.createdAt)
      : "";
  const durationLabel = formatDurationBadge(content.durationSeconds);

  return (
    <article
      className={cn(
        "group border-b border-gray-100 bg-white px-4 py-4 transition-colors hover:bg-gray-50/50",
        content.isPinned && "bg-primary-50/40",
      )}
    >
      <div className="flex gap-3">
        {/* 아바타 — YouTube면 영상 썸네일에 ▶ 오버레이, 일반 글이면 작성자 사진 */}
        {isYouTube && content.thumbnailUrl ? (
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
            <img
              src={content.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play size={12} className="text-white fill-white" />
            </span>
          </div>
        ) : content.authorPhotoURL ? (
          <img
            src={content.authorPhotoURL}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-bold text-white">
            {headerName?.charAt(0) ?? "A"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {/* 작성자·핸들·시간 1줄 (X.com 스타일) */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold text-gray-900 truncate">{headerName}</span>
            {isYouTube && (
              <BadgeCheck size={14} className="shrink-0 text-red-500 fill-red-50" aria-label="YouTube 채널" />
            )}
            {content.isPinned && <Pin size={12} className="shrink-0 text-primary-500" />}
            <CategoryChip boardKey={content.boardKey} />
            {headerHandle && (
              <span className="hidden sm:inline text-gray-500 text-xs truncate">{headerHandle}</span>
            )}
            <span className="text-gray-400" aria-hidden>·</span>
            <span className="text-gray-500 text-xs" suppressHydrationWarning>
              {headerTime}
            </span>
            {isUnansweredQna(content) && <UnansweredBadge />}
          </div>

          {/* 제목 — X.com에선 본문이라 평문 톤 다운 */}
          {content.title && (
            <button
              type="button"
              onClick={() => onClick?.(content)}
              className="mt-1 block text-left text-sm font-semibold text-gray-900 hover:text-primary-600"
            >
              {contentDisplayTitle(content)}
            </button>
          )}

          {/* 본문 — line-clamp 6줄. bodyKo 있으면 한글, 없으면 원본 표시 */}
          {contentDisplayBody(content) && (
            <p className="mt-1.5 line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {contentDisplayBody(content)}
            </p>
          )}

          {/* 미디어 임베드 — 영상/이미지/PDF/링크. 상세는 모달에서. */}
          {content.mediaUrl && content.mediaType && content.mediaType !== "none" ? (
            <button
              type="button"
              onClick={() => onClick?.(content)}
              className="mt-3 block w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-left"
              aria-label="미디어 열기"
            >
              <div className="relative aspect-video w-full">
                <MediaPreview
                  mediaUrl={content.mediaUrl}
                  mediaType={content.mediaType}
                  thumbnailUrl={content.thumbnailUrl}
                  title={contentDisplayTitle(content)}
                  className="h-full w-full"
                  priority={priority}
                />
                {isYouTube && durationLabel && (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {durationLabel}
                  </span>
                )}
              </div>
            </button>
          ) : (
            // 미디어 없는 글 — 카테고리 색·아이콘 fallback 노출 (community-* 보드만 매핑됨)
            getBoardVisual(content.boardKey) && (
              <button
                type="button"
                onClick={() => onClick?.(content)}
                className="mt-3 block w-full overflow-hidden rounded-lg border border-gray-200 text-left"
                aria-label="상세 열기"
              >
                <div className="relative aspect-video w-full">
                  <CategoryFallback content={content} />
                </div>
              </button>
            )
          )}

          {/* 태그 */}
          {content.tags && content.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {content.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 외부 자료·첨부 칩 — 글에 자원 첨부됐을 때만 */}
          <AttachmentChips content={content} />

          {/* 하단 액션 바 — 인라인 좋아요·북마크·공유 (모달 진입 없이) */}
          <div className="mt-3 flex items-center gap-6 text-xs text-gray-500">
            <button
              type="button"
              onClick={() => onClick?.(content)}
              className="flex items-center gap-1 transition-colors hover:text-primary-600"
              aria-label="댓글"
            >
              <MessageCircle size={14} />
              <span>{content.commentCount}</span>
            </button>
            <button
              type="button"
              onClick={handleLike}
              disabled={busyLike}
              className={cn(
                "flex items-center gap-1 transition-colors hover:text-rose-500 disabled:opacity-50",
                isLiked && "text-rose-500",
              )}
              aria-label="좋아요"
              aria-pressed={isLiked}
            >
              <Heart size={14} className={isLiked ? "fill-current" : ""} />
              <span>{displayLikeCount}</span>
            </button>
            <button
              type="button"
              onClick={handleBookmark}
              disabled={busyBookmark}
              className={cn(
                "flex items-center gap-1 transition-colors hover:text-primary-600 disabled:opacity-50",
                bookmarked && "text-primary-600",
              )}
              aria-label="북마크"
              aria-pressed={bookmarked}
            >
              <Bookmark size={14} className={bookmarked ? "fill-current" : ""} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1 transition-colors hover:text-primary-600"
              aria-label="공유"
            >
              <Share2 size={14} />
            </button>
            <span className="ml-auto flex items-center gap-1">
              <Eye size={14} />
              <span>{content.views}</span>
            </span>
          </div>
        </div>
      </div>

      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </article>
  );
}

/** FAQ 아코디언 행 — 별도 상세 페이지 없이 인라인 토글 */
function FaqRow({ content }: Omit<Props, "board" | "onClick">) {
  return (
    <details className="group border-b border-gray-100">
      <summary className={cn(
        "flex cursor-pointer items-center gap-2 px-4 py-3",
        "text-sm font-medium text-gray-800 hover:bg-gray-50",
      )}>
        <span className="font-bold text-primary-500">Q.</span>
        <span className="flex-1">{content.question ?? contentDisplayTitle(content)}</span>
      </summary>
      <div className="px-4 pb-4 pl-9 text-sm leading-relaxed text-gray-600">
        {content.answer ?? contentDisplayBody(content)}
      </div>
    </details>
  );
}

export default function ContentCard({ content, board, onClick, variant, priority }: Props) {
  // variant 명시 시 보드 layout 무시 (예: /media에서 instagram 강제)
  const layout: ContentCardVariant = variant ?? board?.layout ?? "grid";

  if (layout === "instagram") return <InstagramCard content={content} onClick={onClick} priority={priority} />;
  if (layout === "timeline") return <TimelineCard content={content} onClick={onClick} priority={priority} />;
  if (layout === "dispatch") return <DispatchCard content={content} onClick={onClick} priority={priority} />;
  if (layout === "faq") return <FaqRow content={content} />;
  if (layout === "list") return <ListRow content={content} onClick={onClick} />;
  return <GridCard content={content} onClick={onClick} priority={priority} />;
}

/**
 * 디스패치 뉴스 스타일 카드 — 가로형 미니 썸네일 + 제목 + 요약 + 메타.
 * 빠른 정보 스캔에 최적화 (모바일·데스크톱 동일 레이아웃, 모바일에선 썸네일 작게).
 */
function DispatchCard({ content, onClick, priority }: Omit<Props, "board" | "variant">) {
  const ms = createdAtMs(content.createdAt);
  const isYouTube = content.mediaType === "youtube" && !!content.channelTitle;
  const headerName = isYouTube ? content.channelTitle! : content.authorName;
  const headerTime = isYouTube && content.publishedAtSource
    ? sourceTimeAgo(content.publishedAtSource)
    : ms > 0
      ? timeAgo(content.createdAt)
      : "";
  const durationLabel = formatDurationBadge(content.durationSeconds);
  // bodyKo 있으면 한글 요약 우선 (Phase 7 — 한글 표시 통일)
  const summary = contentDisplayBody(content).trim();
  // 적응형 — 썸네일도 없고 보드 시각 fallback도 없으면 썸네일 영역 자체 숨김
  const boardVisual = getBoardVisual(content.boardKey);
  const showThumb = Boolean(content.thumbnailUrl) || Boolean(boardVisual);

  return (
    <button
      type="button"
      onClick={() => onClick?.(content)}
      className={cn(
        "flex w-full gap-3 border-b border-gray-100 bg-white p-3 text-left transition-colors hover:bg-gray-50",
        content.isPinned && "bg-primary-50/40",
      )}
    >
      {/* 썸네일 — 모바일 96px, sm+ 144px. 표시할 게 없으면 영역 자체를 숨겨 텍스트 전폭 사용 */}
      {showThumb && (
        <div className="relative shrink-0 w-24 sm:w-36 aspect-video overflow-hidden rounded-md bg-gray-100">
          <SmartThumbnail
            src={content.thumbnailUrl}
            alt=""
            priority={priority}
            fallback={boardVisual ? <CategoryFallback content={content} /> : null}
          />
          {isYouTube && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Play size={20} className="text-white fill-white drop-shadow" />
            </span>
          )}
          {durationLabel && (
            <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] font-bold text-white">
              {durationLabel}
            </span>
          )}
          {ms > 0 && Date.now() - ms < 7 * 24 * 60 * 60 * 1000 && (
            <span className="absolute top-1 left-1 rounded bg-rose-500 px-1 py-0.5 text-[9px] font-bold text-white">
              NEW
            </span>
          )}
        </div>
      )}

      {/* 본문 — 제목 + 요약 + 메타 */}
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 text-sm font-bold text-gray-900 leading-snug">
            {content.isPinned && <Pin size={11} className="mr-1 inline text-primary-500" />}
            {contentDisplayTitle(content)}
          </h3>
          {isUnansweredQna(content) && <UnansweredBadge />}
        </div>
        {summary && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-600 leading-relaxed">
            {summary}
          </p>
        )}
        <div className="mt-auto pt-1.5 flex items-center gap-2 text-[11px] text-gray-400">
          <span className="flex items-center gap-1 truncate min-w-0">
            <span className="truncate font-medium text-gray-600">{headerName}</span>
            {isYouTube && (
              <BadgeCheck size={11} className="shrink-0 text-red-500 fill-red-50" aria-label="YouTube 채널" />
            )}
          </span>
          {headerTime && (
            <>
              <span className="text-gray-300" aria-hidden>·</span>
              <span className="shrink-0">{headerTime}</span>
            </>
          )}
          <span className="ml-auto flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-0.5"><Eye size={11} />{content.views}</span>
            {content.likeCount > 0 && (
              <span className="flex items-center gap-0.5"><Heart size={11} />{content.likeCount}</span>
            )}
            {content.commentCount > 0 && (
              <span className="flex items-center gap-0.5"><MessageCircle size={11} />{content.commentCount}</span>
            )}
          </span>
        </div>
        <AttachmentChips content={content} />
      </div>
    </button>
  );
}
