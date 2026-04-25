"use client";

import { useEffect, useState, useCallback } from "react";
import { Bookmark as BookmarkIcon, Heart, FileText, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getMyContents, getMyReactedContents } from "@/lib/content-engine";
import type { Content } from "@/types/content";
import { ContentCard } from "@/components/content";
import ContentDetailModal from "@/components/content/ContentDetailModal";

export type DashboardTab = "bookmarks" | "likes" | "myposts";

const TABS: { key: DashboardTab; label: string; icon: typeof BookmarkIcon }[] = [
  { key: "bookmarks", label: "내 컬렉션", icon: BookmarkIcon },
  { key: "likes", label: "좋아요", icon: Heart },
  { key: "myposts", label: "내 글", icon: FileText },
];

/**
 * /profile 내 마이 대시보드 — 북마크·좋아요·내 글 그리드.
 * 한 번에 최대 50건씩 로드. Sprint 4 범위에서는 페이지네이션 없이 단순 로드.
 */
export default function MyDashboard({
  defaultTab = "bookmarks",
}: {
  defaultTab?: DashboardTab;
}) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>(defaultTab);
  const [items, setItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Content | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let result: Content[] = [];
      if (activeTab === "bookmarks") {
        result = await getMyReactedContents(user.uid, "bookmark", 50);
      } else if (activeTab === "likes") {
        result = await getMyReactedContents(user.uid, "like", 50);
      } else if (activeTab === "myposts") {
        result = await getMyContents(user.uid, 50);
      }
      setItems(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        로그인 후 이용 가능합니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-brand-blue text-brand-blue"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 본문 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          <Loader2 size={16} className="mr-2 animate-spin" />
          불러오는 중...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
          {items.map((c) => (
            <div key={c.id} className="mb-3 break-inside-avoid">
              <ContentCard content={c} onClick={setSelected} />
            </div>
          ))}
        </div>
      )}

      {/* 모달 */}
      <ContentDetailModal
        content={selected}
        onClose={() => setSelected(null)}
        onSelectRelated={setSelected}
      />
    </div>
  );
}

function EmptyState({ tab }: { tab: DashboardTab }) {
  const config: Record<DashboardTab, { title: string; desc: string }> = {
    bookmarks: { title: "북마크한 콘텐츠가 없습니다.", desc: "탐색에서 카드 하트/북마크를 눌러 모아보세요." },
    likes: { title: "좋아요한 콘텐츠가 없습니다.", desc: "좋아하는 콘텐츠에 ♥ 를 눌러주세요." },
    myposts: { title: "작성한 글이 없습니다.", desc: "탐색·커뮤니티에서 새 글을 작성해보세요." },
  };
  const c = config[tab];
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-16 text-center">
      <Sparkles size={28} className="mx-auto mb-3 text-gray-300" />
      <p className="text-base font-medium text-gray-700">{c.title}</p>
      <p className="mt-1 text-sm text-gray-400">{c.desc}</p>
    </div>
  );
}
