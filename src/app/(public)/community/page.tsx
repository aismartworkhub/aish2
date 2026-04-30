"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Plus, Sparkles, MessageCircle, HelpCircle, Star, Megaphone, Mail, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBoardsByGroup, buildSearchTerms, getPopularTags } from "@/lib/content-engine";
import { getBoardsByGroupDefault, mergeBoardsByKey, DEFAULT_BOARDS } from "@/lib/board-defaults";
import type { Content, BoardConfig } from "@/types/content";
import { cohortToContent, type CohortLike } from "@/lib/legacy-to-content";
import { ContentCard } from "@/components/content";
import ContentCardSkeleton from "@/components/content/ContentCardSkeleton";

// 상세 모달은 카드 클릭 시에만 필요 → 첫 페이지 로드에서 제외 (lazy chunk)
const ContentDetailModal = dynamic(() => import("@/components/content/ContentDetailModal"), {
  ssr: false,
});
import { useLoginGuard } from "@/hooks/useLoginGuard";
import LoginModal from "@/components/public/LoginModal";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { loadPageContent, DEFAULT_COMMUNITY } from "@/lib/page-content-public";
import type { PageContentBase } from "@/types/page-content";
import { useInfiniteContents } from "@/hooks/useInfiniteContents";
import { getContentById } from "@/lib/content-engine";
import { useViewMode } from "@/hooks/useViewMode";
import ViewModeToggle from "@/components/ui/ViewModeToggle";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Loader2 } from "lucide-react";

const ALL_KEY = "__all__";

type MediaTypeFilter = typeof ALL_KEY | "youtube" | "image" | "pdf" | "link";

/**
 * 1차 카테고리 — 사용자 의도(무엇을 보고 싶나)부터 고름.
 * 각 카테고리는 0~N개의 보드 후보를 가짐. 0개=전체 미디어, 1개=단일 보드, 2개+=2차 칩 노출.
 */
type PrimaryCategory = {
  key: string;
  label: string;
  icon: typeof Sparkles;
  /** 활성 시 칩 색상 클래스 */
  activeClass: string;
  /** 비활성 시 칩 색상 클래스 (시각 구분) */
  inactiveClass: string;
  /** 0=전체, 1=단일 보드, N=2차 칩 노출 */
  boards: string[];
  /** 설정 시 클릭 → 해당 URL로 이동 (필터링이 아닌 별도 화면). FAQ/갤러리/문의/수료증용. */
  href?: string;
};

const PRIMARY_CATEGORIES: PrimaryCategory[] = [
  { key: "all", label: "전체", icon: Sparkles, activeClass: "bg-gray-900 text-white", inactiveClass: "bg-gray-100 text-gray-700", boards: [] },
  { key: "free", label: "자유", icon: MessageCircle, activeClass: "bg-blue-500 text-white", inactiveClass: "bg-blue-50 text-blue-700", boards: ["community-free"] },
  { key: "qna", label: "Q&A", icon: HelpCircle, activeClass: "bg-emerald-500 text-white", inactiveClass: "bg-emerald-50 text-emerald-700", boards: ["community-qna"] },
  { key: "review", label: "후기", icon: Star, activeClass: "bg-amber-500 text-white", inactiveClass: "bg-amber-50 text-amber-700", boards: ["community-review"] },
  { key: "notice", label: "공지", icon: Megaphone, activeClass: "bg-rose-500 text-white", inactiveClass: "bg-rose-50 text-rose-700", boards: ["community-notice"] },
  // ↓ 카드 피드 외 부속 기능 — 동일 줄에 함께 배치, 클릭 시 legacy 화면으로 이동
  // 갤러리·자료는 /media 본진과 중복되므로 /community에서는 제외
  { key: "faq", label: "FAQ", icon: HelpCircle, activeClass: "bg-cyan-500 text-white", inactiveClass: "bg-cyan-50 text-cyan-700", boards: [], href: "/community/legacy?tab=faq" },
  { key: "inquiry", label: "협력문의", icon: Mail, activeClass: "bg-orange-500 text-white", inactiveClass: "bg-orange-50 text-orange-700", boards: [], href: "/community/legacy?tab=inquiry" },
  { key: "certificate", label: "수료증", icon: Award, activeClass: "bg-teal-500 text-white", inactiveClass: "bg-teal-50 text-teal-700", boards: [], href: "/community/legacy?tab=certificate" },
];

export default function CommunityPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">불러오는 중...</div>}>
      <CommunityPageInner />
    </Suspense>
  );
}

function CommunityPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const ff = useFeatureFlags();
  const contentDeepLink = ff.phase1.enabled && ff.phase1.contentDeepLink === true;
  // 3-스타일 뷰 모드 (페이지별 독립 localStorage)
  const { mode: viewMode, setMode: setViewMode } = useViewMode("community", "x-feed");

  const [boards, setBoards] = useState<BoardConfig[]>(() =>
    mergeBoardsByKey(getBoardsByGroupDefault("community"), []),
  );
  const [activeBoardKey, setActiveBoardKey] = useState<string | null>(null);
  const [activeMediaType, setActiveMediaType] = useState<MediaTypeFilter>(ALL_KEY);
  const [searchInput, setSearchInput] = useState("");
  const [searchActive, setSearchActive] = useState<string>("");
  const [pageContent, setPageContent] = useState<PageContentBase>(DEFAULT_COMMUNITY);
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

  // "전체" 카테고리는 community 4개 보드 다중 IN 쿼리
  // → 자유/Q&A/후기/공지를 하나의 피드에 통합 노출 (수료증은 별도 fetch 후 merge)
  // 갤러리·자료(media-*)는 /media 본진과 중복되므로 제외
  const ALL_COMMUNITY_BOARDS = useMemo(() => [
    "community-free",
    "community-qna",
    "community-review",
    "community-notice",
  ], []);

  // 무한 스크롤 — boardKey가 선택되면 보드 단위, 아니면 다중 보드 통합 피드
  // ATF 가속: 첫 페이지는 6건만 → 빠르게 첫 표시 후 idle 시 다음 18건 prefetch
  const feed = useInfiniteContents({
    boardKey: activeBoardKey ?? undefined,
    boardKeys: activeBoardKey ? undefined : ALL_COMMUNITY_BOARDS,
    tags: tagFilter && !searchTokens ? tagFilter : undefined,
    searchTerms: searchTokens,
    pageSize: 24,
    firstPageSize: 6,
  });

  // "전체"일 때 수료증(Cohort) 데이터도 별도 fetch → 클라이언트에서 merge
  const [cohortCards, setCohortCards] = useState<Content[]>([]);
  useEffect(() => {
    if (activeBoardKey) {
      // 단일 보드 선택 시 수료증 미포함
      setCohortCards([]);
      return;
    }
    let cancelled = false;
    import("@/lib/firestore").then(({ getCollection, COLLECTIONS }) =>
      getCollection<CohortLike>(COLLECTIONS.CERTIFICATES_COHORTS),
    )
      .then((cohorts) => {
        if (cancelled) return;
        const cards = cohorts.map(cohortToContent);
        setCohortCards(cards);
      })
      .catch(() => {
        if (!cancelled) setCohortCards([]);
      });
    return () => { cancelled = true; };
  }, [activeBoardKey]);

  // 콘텐츠 + 수료증 카드 merge (정렬은 createdAt desc)
  const mergedItems = useMemo(() => {
    if (cohortCards.length === 0) return feed.items;
    const all = [...feed.items, ...cohortCards];
    return all.sort((a, b) => {
      const ta = typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() : 0;
      const tb = typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [feed.items, cohortCards]);

  // 스크롤 위치 복원 — 모달 닫고 돌아올 때 같은 위치
  useScrollRestoration({
    key: `community-${activeBoardKey ?? "all"}-${activeMediaType}-${tagParam}-${searchActive}`,
    ready: !feed.loading,
  });

  // Pull-to-refresh — 모바일 상단에서 당기면 첫 페이지 재로드
  const ptr = usePullToRefresh({
    onRefresh: () => { feed.refresh(); },
  });

  useEffect(() => {
    loadPageContent("community").then(setPageContent).catch(() => {});
    getPopularTags({ limit: 10 }).then(setPopularTags).catch(() => {});
  }, []);

  const setTagFilter = useCallback((tag: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (tag) next.set("tag", tag);
    else next.delete("tag");
    const qs = next.toString();
    router.replace(qs ? `/community?${qs}` : "/community", { scroll: false });
  }, [router, searchParams]);

  // 보드 목록 로드
  useEffect(() => {
    let cancelled = false;
    getBoardsByGroup("community")
      .then((list) => {
        if (cancelled) return;
        setBoards(mergeBoardsByKey(getBoardsByGroupDefault("community"), list));
      })
      .catch(() => {
        if (cancelled) return;
        setBoards(mergeBoardsByKey(DEFAULT_BOARDS, []).filter((b) => b.group === "community"));
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
      router.replace(`/community?${next.toString()}`, { scroll: false });
    }
  }, [router, contentDeepLink, searchParams]);

  const clearSelected = useCallback(() => {
    setSelected(null);
    if (contentDeepLink) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("id");
      const qs = next.toString();
      router.replace(qs ? `/community?${qs}` : "/community", { scroll: false });
    }
  }, [router, contentDeepLink, searchParams]);

  const boardForContent = useCallback(
    (c: Content): BoardConfig | undefined => boards.find((b) => b.key === c.boardKey),
    [boards],
  );

  // 새 디자인용 1차 카테고리 — activeBoardKey로부터 역산
  const activeCategory: string = useMemo(() => {
    if (!activeBoardKey) return "all";
    const cat = PRIMARY_CATEGORIES.find((c) => c.boards.includes(activeBoardKey));
    return cat?.key ?? "all";
  }, [activeBoardKey]);

  // 2차 칩 — 활성 카테고리의 보드 ≥2개일 때만 노출
  const secondaryBoards = useMemo(() => {
    const cat = PRIMARY_CATEGORIES.find((c) => c.key === activeCategory);
    if (!cat || cat.boards.length <= 1) return [];
    return boards.filter((b) => cat.boards.includes(b.key));
  }, [activeCategory, boards]);

  const handleCategoryClick = useCallback((cat: PrimaryCategory) => {
    // FAQ/갤러리/협력문의/수료증 — 외부 화면(legacy)으로 이동
    if (cat.href) {
      router.push(cat.href);
      return;
    }
    if (cat.boards.length === 0) {
      setActiveBoardKey(null);
    } else {
      // 다중 보드 카테고리 → 첫 보드부터. 2차 칩으로 추가 정밀화 가능.
      setActiveBoardKey(cat.boards[0]);
    }
    setActiveMediaType(ALL_KEY);
  }, [router]);

  // 클라이언트 측 미디어 타입 필터 (서버 필터와 별개 — 발견형 칩)
  // 전체일 때는 mergedItems(콘텐츠 + 수료증), 단일 보드일 때는 feed.items
  const baseItems = mergedItems;
  const filtered = useMemo(() => {
    if (activeMediaType === ALL_KEY) return baseItems;
    return baseItems.filter((c) => {
      if (activeMediaType === "youtube") return c.mediaType === "youtube";
      if (activeMediaType === "image") return c.mediaType === "image" || c.mediaType === "gif";
      if (activeMediaType === "pdf") return c.mediaType === "pdf";
      if (activeMediaType === "link") return c.mediaType === "link";
      return true;
    });
  }, [baseItems, activeMediaType]);

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
      router.replace(qs ? `/community?${qs}` : "/community", { scroll: false });
    }
  };

  return (
    <div className="py-10">
      {/* Pull-to-refresh 인디케이터 (모바일) */}
      {(ptr.pullDistance > 0 || ptr.refreshing) && (
        <div
          className="pointer-events-none fixed left-1/2 top-16 z-30 -translate-x-1/2 rounded-full bg-white/95 p-2 shadow-lg backdrop-blur lg:hidden"
          style={{ transform: `translate(-50%, ${Math.max(0, ptr.pullDistance - 30)}px)` }}
          aria-hidden
        >
          <Loader2
            size={18}
            className={cn(
              "text-gray-600 transition-transform",
              ptr.refreshing && "animate-spin",
            )}
            style={{ transform: ptr.refreshing ? undefined : `rotate(${ptr.pullDistance * 4}deg)` }}
          />
        </div>
      )}
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
                // 자유게시판 작성으로 — 기존 timeline 컴포넌트가 작성 처리
                router.push("/community/legacy?tab=free");
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
                router.replace(qs ? `/community?${qs}` : "/community", { scroll: false });
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              해제
            </button>
          </div>
        )}

        {/* 1차 카테고리 + 뷰 모드 토글 */}
        <div className="mb-3 flex items-center gap-2">
          <div className="flex-1 -mx-4 overflow-x-auto px-4">
            <div className="flex gap-2 pb-2">
              {PRIMARY_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const active = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleCategoryClick(cat)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap",
                      active ? cat.activeClass : cat.inactiveClass,
                    )}
                    aria-pressed={active}
                  >
                    <Icon size={14} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
          <ViewModeToggle mode={viewMode} onChange={setViewMode} className="shrink-0" />
        </div>

        {/* 2차 칩 — 활성 카테고리에 보드 ≥2개일 때만 동적 노출 */}
        {secondaryBoards.length > 1 && (
          <div className="mb-3 -mx-4 overflow-x-auto px-4">
            <div className="flex gap-1.5 pb-2">
              <span className="shrink-0 self-center text-xs font-medium text-gray-400">세부 분류</span>
              {secondaryBoards.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setActiveBoardKey(b.key)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                    activeBoardKey === b.key
                      ? "bg-gray-700 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

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
          // 로딩 중에도 빈 화면 대신 스켈레톤 즉시 표시 (체감 속도 ↑)
          <div className="mx-auto max-w-3xl border-x border-gray-100 bg-white">
            <ContentCardSkeleton
              variant={viewMode === "x-feed" ? "timeline" : viewMode === "board-list" ? "list" : "dispatch"}
              count={6}
            />
          </div>
        ) : feed.error ? (
          <div className="py-20 text-center text-sm text-red-500">{feed.error}</div>
        ) : filtered.length === 0 ? (
          <EmptyState isFiltered={isFiltered} onClear={clearAllFilters} />
        ) : (
          <>
            {viewMode === "card-feed" && (
              // 카드 피드: 디스패치 뉴스 스타일 — 가로 미니 썸네일 + 제목 + 요약
              <div className="mx-auto max-w-3xl border-x border-gray-100 bg-white">
                {filtered.map((c, i) => (
                  <ContentCard
                    key={c.id}
                    content={c}
                    board={boardForContent(c)}
                    onClick={selectContent}
                    variant="dispatch"
                    priority={i < 4}
                  />
                ))}
              </div>
            )}
            {viewMode === "x-feed" && (
              // X 피드: 단일 컬럼 timeline (X.com 스타일)
              <div className="mx-auto max-w-2xl border-x border-gray-100 bg-white">
                {filtered.map((c, i) => (
                  <ContentCard
                    key={c.id}
                    content={c}
                    board={boardForContent(c)}
                    onClick={selectContent}
                    variant="timeline"
                    priority={i < 2}
                  />
                ))}
              </div>
            )}
            {viewMode === "board-list" && (
              // 게시판 리스트: 한 줄씩
              <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                {filtered.map((c) => (
                  <ContentCard
                    key={c.id}
                    content={c}
                    board={boardForContent(c)}
                    onClick={selectContent}
                    variant="list"
                  />
                ))}
              </div>
            )}

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

      {/* 콘텐츠 상세 모달 — 갤러리 모드: 현재 필터된 피드를 좌/우 스와이프 */}
      <ContentDetailModal
        content={selected}
        onClose={clearSelected}
        onSelectRelated={selectContent}
        galleryItems={filtered}
        onNavigate={selectContent}
      />

      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </div>
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
