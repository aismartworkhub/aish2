"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getContents, getBoardsByGroup } from "@/lib/content-engine";
import { loadAllLegacyMediaAsContent } from "@/lib/legacy-adapter";
import { getBoardsByGroupDefault } from "@/lib/board-defaults";
import { normalizeUrl } from "@/lib/ai-content-dedup";
import type { Content, BoardConfig } from "@/types/content";
import { ContentCard, ContentDetail } from "@/components/content";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import LoginModal from "@/components/public/LoginModal";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

const ALL_KEY = "__all__";
const SHORTS_KEY = "__shorts__";

type SourceTab = typeof ALL_KEY | "youtube" | "github" | "gallery" | "resource" | "xcom" | typeof SHORTS_KEY;

const SOURCE_TABS: { key: SourceTab; label: string }[] = [
  { key: ALL_KEY, label: "전체" },
  { key: "youtube", label: "유튜브" },
  { key: "github", label: "GitHub" },
  { key: "gallery", label: "갤러리" },
  { key: "resource", label: "자료실" },
];

function inferSource(c: Content): string {
  if (c.mediaType === "youtube" || c.mediaUrl?.includes("youtube.com") || c.mediaUrl?.includes("youtu.be")) return "youtube";
  if (c.mediaUrl?.includes("github.com")) return "github";
  if (c.mediaUrl?.includes("x.com") || c.mediaUrl?.includes("twitter.com")) return "xcom";
  if (c.mediaType === "image" || c.boardKey === "media-gallery") return "gallery";
  if (c.boardKey === "media-resource") return "resource";
  if (c.mediaType === "link") return "resource";
  return "resource";
}

export default function MediaPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">불러오는 중...</div>}>
      <MediaPageInner />
    </Suspense>
  );
}

function MediaPageInner() {
  const [boards, setBoards] = useState<BoardConfig[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [activeTab, setActiveTab] = useState<SourceTab>(ALL_KEY);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const ff = useFeatureFlags();
  const contentDeepLink = ff.phase1.enabled && ff.phase1.contentDeepLink === true;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let mediaBoards: BoardConfig[];
      try {
        mediaBoards = await getBoardsByGroup("media");
        if (mediaBoards.length === 0) mediaBoards = getBoardsByGroupDefault("media");
      } catch {
        mediaBoards = getBoardsByGroupDefault("media");
      }
      if (cancelled) return;
      setBoards(mediaBoards);

      let all: Content[] = [];

      const uniqueKeys = [...new Set(mediaBoards.map((b) => b.key))];
      try {
        const promises = uniqueKeys.map((key) =>
          getContents(key).catch((err) => {
            if (process.env.NODE_ENV === "development") console.warn(`getContents(${key}) 실패:`, err);
            return [] as Content[];
          }),
        );
        const results = await Promise.all(promises);
        all = results.flat();
      } catch (err) {
        if (process.env.NODE_ENV === "development") console.error("콘텐츠 로드 실패:", err);
      }

      try {
        const legacy = await loadAllLegacyMediaAsContent();
        const existUrls = new Set(all.map((c) => normalizeUrl(c.mediaUrl || "")));
        const existIds = new Set(all.map((c) => c.id));
        all = [
          ...all,
          ...legacy.filter(
            (l) => !existIds.has(l.id) && !existUrls.has(normalizeUrl(l.mediaUrl || "")),
          ),
        ];
      } catch { /* 레거시 로드 실패 무시 */ }

      if (cancelled) return;
      all.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
      setContents(all);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!contentDeepLink || loading || contents.length === 0) return;
    const idParam = searchParams.get("id");
    if (idParam && !selected) {
      const found = contents.find((c) => c.id === idParam);
      if (found) setSelected(found);
    }
  }, [contentDeepLink, loading, contents, searchParams, selected]);

  const selectContent = useCallback((c: Content) => {
    setSelected(c);
    if (contentDeepLink) router.replace(`/media?id=${c.id}`, { scroll: false });
  }, [router, contentDeepLink]);

  const clearSelected = useCallback(() => {
    setSelected(null);
    if (contentDeepLink) router.replace("/media", { scroll: false });
  }, [router, contentDeepLink]);

  const boardForContent = useCallback(
    (c: Content): BoardConfig | undefined => boards.find((b) => b.key === c.boardKey),
    [boards],
  );

  const visibleTabs = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of contents) {
      const src = inferSource(c);
      counts[src] = (counts[src] ?? 0) + 1;
    }
    const hasShorts = contents.some((c) => c.isShort);
    const hasXcom = (counts["xcom"] ?? 0) > 0;

    const tabs = SOURCE_TABS.filter((t) => t.key === ALL_KEY || (counts[t.key] ?? 0) > 0);
    if (hasXcom) tabs.push({ key: "xcom", label: "X.com" });
    if (hasShorts) tabs.push({ key: SHORTS_KEY as SourceTab, label: "Shorts" });
    return tabs;
  }, [contents]);

  const filtered = useMemo(() => {
    let list = contents;
    if (activeTab === SHORTS_KEY) {
      list = list.filter((c) => c.isShort);
    } else if (activeTab !== ALL_KEY) {
      list = list.filter((c) => inferSource(c) === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.authorName.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [contents, activeTab, searchQuery]);

  const shorts = useMemo(() => contents.filter((c) => c.isShort).slice(0, 8), [contents]);

  if (selected) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <ContentDetail
          content={selected}
          board={boardForContent(selected)}
          onBack={clearSelected}
        />
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="mx-auto max-w-6xl px-4">
        {/* 헤더 */}
        <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">콘텐츠</h1>
            <p className="mt-2 text-gray-500">영상, 이미지, 자료 등 다양한 콘텐츠를 만나보세요</p>
          </div>
          <button
            type="button"
            onClick={() =>
              requireLogin(() => {
                router.push("/community?tab=free");
              }, "콘텐츠를 작성하려면 로그인이 필요합니다.")
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold",
              "bg-gray-900 text-white hover:bg-gray-800 transition-colors shrink-0",
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="검색어를 입력하세요..."
            className={cn(
              "w-full rounded-full border border-gray-200 py-2.5 pl-10 pr-10 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/30",
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="검색어 지우기"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* 소스 유형별 탭 */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {visibleTabs.map((t) => (
            <TabButton
              key={t.key}
              active={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
              label={t.label}
              accent={t.key === SHORTS_KEY}
            />
          ))}
        </div>

        {/* Shorts 섹션 (전체 탭에서만) */}
        {activeTab === ALL_KEY && shorts.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-bold text-gray-800">Shorts</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {shorts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectContent(c)}
                  className={cn(
                    "group relative aspect-[9/16] overflow-hidden rounded-xl bg-gray-100",
                    "transition-shadow hover:shadow-lg",
                  )}
                >
                  {c.thumbnailUrl ? (
                    <img
                      src={c.thumbnailUrl}
                      alt={c.title}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-gray-200 to-gray-300">
                      <span className="text-sm text-gray-500">Short</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 p-2">
                    <p className="line-clamp-2 text-xs font-medium text-white">{c.title}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 메인 콘텐츠 그리드 */}
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">콘텐츠를 불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">
            {searchQuery ? "검색 결과가 없습니다." : "등록된 콘텐츠가 없습니다."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((c) => (
              <ContentCard
                key={c.id}
                content={c}
                board={boardForContent(c)}
                onClick={selectContent}
              />
            ))}
          </div>
        )}
      </div>
      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? accent
            ? "bg-red-600 text-white"
            : "bg-gray-900 text-white"
          : accent
            ? "bg-red-50 text-red-600 hover:bg-red-100"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200",
      )}
    >
      {label}
    </button>
  );
}

function toMs(dateVal: unknown): number {
  if (!dateVal) return 0;
  if (typeof dateVal === "string") return new Date(dateVal).getTime();
  const d = (dateVal as { toDate?: () => Date }).toDate?.();
  return d ? d.getTime() : 0;
}
