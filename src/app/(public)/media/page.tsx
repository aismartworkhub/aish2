"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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

const ALL_KEY = "__all__";
const SHORTS_KEY = "__shorts__";

export default function MediaPage() {
  const [boards, setBoards] = useState<BoardConfig[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [activeTab, setActiveTab] = useState(ALL_KEY);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // 0) Firestore에서 게시판 목록 로드 (없으면 기본값 폴백)
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

      // 1) 새 contents 컬렉션에서 로드
      try {
        const promises = mediaBoards.map((b) =>
          getContents(b.key).catch(() => [] as Content[]),
        );
        const results = await Promise.all(promises);
        all = results.flat();
      } catch { /* 전체 실패 시 빈 배열 유지 */ }

      // 2) 레거시 데이터 병합 (URL 기반 중복 제거)
      try {
        const legacy = await loadAllLegacyMediaAsContent();
        const existUrls = new Set(
          all.map((c) => normalizeUrl(c.mediaUrl || "")),
        );
        const existIds = new Set(all.map((c) => c.id));
        all = [
          ...all,
          ...legacy.filter(
            (l) =>
              !existIds.has(l.id) &&
              !existUrls.has(normalizeUrl(l.mediaUrl || "")),
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

  const boardForContent = useCallback(
    (c: Content): BoardConfig | undefined =>
      boards.find((b) => b.key === c.boardKey),
    [boards],
  );

  const filtered = useMemo(() => {
    let list = contents;
    if (activeTab === SHORTS_KEY) {
      list = list.filter((c) => c.isShort);
    } else if (activeTab !== ALL_KEY) {
      list = list.filter((c) => c.boardKey === activeTab);
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
          onBack={() => setSelected(null)}
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
                window.location.href = "/community?tab=free";
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

        {/* 카테고리 탭 */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          <TabButton
            active={activeTab === ALL_KEY}
            onClick={() => setActiveTab(ALL_KEY)}
            label="전체"
          />
          {boards.map((b) => (
            <TabButton
              key={b.key}
              active={activeTab === b.key}
              onClick={() => setActiveTab(b.key)}
              label={b.label}
            />
          ))}
          {shorts.length > 0 && (
            <TabButton
              active={activeTab === SHORTS_KEY}
              onClick={() => setActiveTab(SHORTS_KEY)}
              label="Shorts"
              accent
            />
          )}
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
                  onClick={() => setSelected(c)}
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
                onClick={setSelected}
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
