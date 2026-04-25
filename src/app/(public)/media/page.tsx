"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBoardsByGroup, buildSearchTerms, getPopularTags } from "@/lib/content-engine";
import { getBoardsByGroupDefault, mergeBoardsByKey, DEFAULT_BOARDS } from "@/lib/board-defaults";
import type { Content, BoardConfig } from "@/types/content";
import { ContentCard } from "@/components/content";
import ContentDetailModal from "@/components/content/ContentDetailModal";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import LoginModal from "@/components/public/LoginModal";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { loadPageContent, DEFAULT_MEDIA } from "@/lib/page-content-public";
import type { PageContentBase } from "@/types/page-content";
import { useInfiniteContents } from "@/hooks/useInfiniteContents";
import { getContentById } from "@/lib/content-engine";

const ALL_KEY = "__all__";

type MediaTypeFilter = typeof ALL_KEY | "youtube" | "image" | "pdf" | "link";

const MEDIA_FILTERS: { key: MediaTypeFilter; label: string }[] = [
  { key: ALL_KEY, label: "전체" },
  { key: "youtube", label: "영상" },
  { key: "image", label: "이미지" },
  { key: "pdf", label: "문서" },
  { key: "link", label: "링크" },
];

export default function MediaPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">불러오는 중...</div>}>
      <MediaPageInner />
    </Suspense>
  );
}

function MediaPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const ff = useFeatureFlags();
  const contentDeepLink = ff.phase1.enabled && ff.phase1.contentDeepLink === true;

  const [boards, setBoards] = useState<BoardConfig[]>(() =>
    mergeBoardsByKey(getBoardsByGroupDefault("media"), []),
  );
  const [activeBoardKey, setActiveBoardKey] = useState<string | null>(null);
  const [activeMediaType, setActiveMediaType] = useState<MediaTypeFilter>(ALL_KEY);
  const [searchInput, setSearchInput] = useState("");
  const [searchActive, setSearchActive] = useState<string>("");
  const [pageContent, setPageContent] = useState<PageContentBase>(DEFAULT_MEDIA);
  const [selected, setSelected] = useState<Content | null>(null);
  const [popularTags, setPopularTags] = useState<{ tag: string; count: number }[]>([]);

  // URL ?tag=AI deep-link 지원
  const tagParam = searchParams.get("tag")?.trim() || "";
  const tagFilter = useMemo(() => (tagParam ? [tagParam] : undefined), [tagParam]);

  // 검색어 → searchTerms 토큰 (3글자 이상일 때만 서버 쿼리)
  const searchTokens = useMemo(() => {
    if (!searchActive.trim() || searchActive.trim().length < 2) return undefined;
    return buildSearchTerms({ title: searchActive });
  }, [searchActive]);

  // 무한 스크롤 — boardKey가 선택되면 보드 단위, 아니면 group=media 통합 피드
  const feed = useInfiniteContents({
    boardKey: activeBoardKey ?? undefined,
    group: activeBoardKey ? undefined : "media",
    tags: tagFilter && !searchTokens ? tagFilter : undefined,
    searchTerms: searchTokens,
    pageSize: 24,
  });

  useEffect(() => {
    loadPageContent("media").then(setPageContent).catch(() => {});
    getPopularTags({ limit: 10 }).then(setPopularTags).catch(() => {});
  }, []);

  const setTagFilter = useCallback((tag: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (tag) next.set("tag", tag);
    else next.delete("tag");
    const qs = next.toString();
    router.replace(qs ? `/media?${qs}` : "/media", { scroll: false });
  }, [router, searchParams]);

  // 보드 목록 로드
  useEffect(() => {
    let cancelled = false;
    getBoardsByGroup("media")
      .then((list) => {
        if (cancelled) return;
        setBoards(mergeBoardsByKey(getBoardsByGroupDefault("media"), list));
      })
      .catch(() => {
        if (cancelled) return;
        setBoards(mergeBoardsByKey(DEFAULT_BOARDS, []).filter((b) => b.group === "media"));
      });
    return () => { cancelled = true; };
  }, []);

  // ?id deep-link 지원: URL에 id 있으면 콘텐츠 직접 fetch (피드 안에 없을 수도 있음)
  useEffect(() => {
    if (!contentDeepLink) return;
    const idParam = searchParams.get("id");
    if (!idParam) {
      if (selected) setSelected(null);
      return;
    }
    if (selected?.id === idParam) return;
    void getContentById(idParam).then((c) => {
      if (c) setSelected(c);
    }).catch(() => {});
  }, [contentDeepLink, searchParams, selected]);

  const selectContent = useCallback((c: Content) => {
    setSelected(c);
    if (contentDeepLink) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("id", c.id);
      router.replace(`/media?${next.toString()}`, { scroll: false });
    }
  }, [router, contentDeepLink, searchParams]);

  const clearSelected = useCallback(() => {
    setSelected(null);
    if (contentDeepLink) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("id");
      const qs = next.toString();
      router.replace(qs ? `/media?${qs}` : "/media", { scroll: false });
    }
  }, [router, contentDeepLink, searchParams]);

  const boardForContent = useCallback(
    (c: Content): BoardConfig | undefined => boards.find((b) => b.key === c.boardKey),
    [boards],
  );

  // 클라이언트 측 미디어 타입 필터 (서버 필터와 별개 — 발견형 칩)
  const filtered = useMemo(() => {
    if (activeMediaType === ALL_KEY) return feed.items;
    return feed.items.filter((c) => {
      if (activeMediaType === "youtube") return c.mediaType === "youtube";
      if (activeMediaType === "image") return c.mediaType === "image" || c.mediaType === "gif";
      if (activeMediaType === "pdf") return c.mediaType === "pdf";
      if (activeMediaType === "link") return c.mediaType === "link";
      return true;
    });
  }, [feed.items, activeMediaType]);

  const triggerSearch = () => setSearchActive(searchInput.trim());
  const clearSearch = () => { setSearchInput(""); setSearchActive(""); };

  const isFiltered =
    Boolean(activeBoardKey) ||
    activeMediaType !== ALL_KEY ||
    Boolean(tagParam) ||
    Boolean(searchActive);

  const clearAllFilters = () => {
    setActiveBoardKey(null);
    setActiveMediaType(ALL_KEY);
    clearSearch();
    if (tagParam) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("tag");
      const qs = next.toString();
      router.replace(qs ? `/media?${qs}` : "/media", { scroll: false });
    }
  };

  return (
    <div className="py-10">
      <div className="mx-auto max-w-6xl px-4">
        {/* 헤더 */}
        <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{pageContent.hero.title}</h1>
            <p className="mt-2 text-gray-500">{pageContent.hero.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              requireLogin(() => {
                router.push("/community?tab=free");
              }, "콘텐츠를 작성하려면 로그인이 필요합니다.")
            }
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold",
              "bg-gray-900 text-white transition-colors hover:bg-gray-800",
            )}
          >
            <Plus size={16} />
            작성하기
          </button>
        </div>

        {/* 검색 */}
        <div className="relative mx-auto mb-6 max-w-lg">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") triggerSearch(); }}
            placeholder="제목·본문·태그 검색..."
            className={cn(
              "w-full rounded-full border border-gray-200 py-2.5 pl-10 pr-20 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/30",
            )}
          />
          {(searchInput || searchActive) && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-16 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="검색어 지우기"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={triggerSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800"
          >
            검색
          </button>
        </div>

        {/* 활성 태그 안내 */}
        {tagParam && (
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
              태그: #{tagParam}
            </span>
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams.toString());
                next.delete("tag");
                const qs = next.toString();
                router.replace(qs ? `/media?${qs}` : "/media", { scroll: false });
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              해제
            </button>
          </div>
        )}

        {/* 카테고리(보드) 칩 — 가로 스크롤 */}
        <div className="mb-3 -mx-4 overflow-x-auto px-4">
          <div className="flex gap-2 pb-2">
            <Chip
              active={activeBoardKey === null}
              onClick={() => setActiveBoardKey(null)}
              label="전체"
            />
            {boards.map((b) => (
              <Chip
                key={b.key}
                active={activeBoardKey === b.key}
                onClick={() => setActiveBoardKey(b.key)}
                label={b.label}
              />
            ))}
            {/* 수강후기는 group=community 이지만 발견 동선에 노출 */}
            <span className="self-center text-gray-200">|</span>
            <Chip
              active={activeBoardKey === "community-review"}
              onClick={() => setActiveBoardKey("community-review")}
              label="⭐ 수강후기"
            />
          </div>
        </div>

        {/* 미디어 타입 칩 */}
        <div className="mb-3 -mx-4 overflow-x-auto px-4">
          <div className="flex gap-2 pb-2">
            {MEDIA_FILTERS.map((f) => (
              <Chip
                key={f.key}
                variant="muted"
                active={activeMediaType === f.key}
                onClick={() => setActiveMediaType(f.key)}
                label={f.label}
              />
            ))}
          </div>
        </div>

        {/* 인기 태그 칩 (동적) */}
        {popularTags.length > 0 && (
          <div className="mb-6 -mx-4 overflow-x-auto px-4">
            <div className="flex gap-1.5 pb-2">
              <span className="shrink-0 self-center text-xs font-medium text-gray-400">인기 태그</span>
              {popularTags.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => setTagFilter(tagParam === t.tag ? null : t.tag)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                    tagParam === t.tag
                      ? "bg-primary-600 text-white"
                      : "bg-primary-50 text-primary-700 hover:bg-primary-100",
                  )}
                >
                  #{t.tag}
                  <span className="ml-1 opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 메인 그리드 — CSS columns 마소닉 */}
        {feed.loading ? (
          <div className="py-20 text-center text-sm text-gray-400">콘텐츠를 불러오는 중...</div>
        ) : feed.error ? (
          <div className="py-20 text-center text-sm text-red-500">{feed.error}</div>
        ) : filtered.length === 0 ? (
          <EmptyState isFiltered={isFiltered} onClear={clearAllFilters} />
        ) : (
          <>
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
              {filtered.map((c) => (
                <div key={c.id} className="mb-4 break-inside-avoid">
                  <ContentCard
                    content={c}
                    board={boardForContent(c)}
                    onClick={selectContent}
                  />
                </div>
              ))}
            </div>

            {/* 무한 스크롤 sentinel */}
            <div ref={feed.sentinelRef} className="h-12" aria-hidden />

            {feed.loadingMore && (
              <div className="py-6 text-center text-xs text-gray-400">더 불러오는 중...</div>
            )}
            {!feed.hasMore && feed.items.length > 12 && (
              <div className="py-6 text-center text-xs text-gray-400">— 더 이상 콘텐츠가 없습니다 —</div>
            )}
          </>
        )}
      </div>

      {/* 콘텐츠 상세 모달 */}
      <ContentDetailModal
        content={selected}
        onClose={clearSelected}
        onSelectRelated={selectContent}
      />

      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  variant = "primary",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  variant?: "primary" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
        active
          ? variant === "muted"
            ? "bg-gray-700 text-white"
            : "bg-gray-900 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
      )}
    >
      {label}
    </button>
  );
}

function EmptyState({ isFiltered, onClear }: { isFiltered: boolean; onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-16 text-center">
      <Sparkles size={28} className="mx-auto mb-3 text-gray-300" />
      <p className="text-base font-medium text-gray-700">
        {isFiltered ? "조건에 맞는 콘텐츠가 없습니다." : "아직 등록된 콘텐츠가 없습니다."}
      </p>
      <p className="mt-1 text-sm text-gray-400">
        {isFiltered ? "필터를 지우면 다른 콘텐츠를 볼 수 있습니다." : "곧 새 콘텐츠가 업로드됩니다."}
      </p>
      {isFiltered && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <X size={14} />
          필터 모두 지우기
        </button>
      )}
    </div>
  );
}
