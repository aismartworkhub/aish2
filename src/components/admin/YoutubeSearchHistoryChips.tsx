"use client";

import { useEffect, useState } from "react";
import { X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getHistory,
  removeHistoryEntry,
  clearHistory,
  formatRelativeTime,
  groupByPeriod,
  describeHistoryOpts,
  snapshotToYoutubeSearchOpts,
  type HistoryEntry,
  type SearchOptsSnapshot,
} from "@/lib/youtube-search-history";
import { hasSearchCache } from "@/lib/youtube-search-cache";

type Props = {
  /** 칩 클릭 시 호출. 부모가 폼 복원·탭 전환 등을 처리. */
  onApply: (opts: SearchOptsSnapshot) => void;
  /** 외부에서 새로고침 키. 변경되면 히스토리 재로드. */
  refreshKey?: number;
  /** inline 5개만 보여줄지, 펼침 패널까지 노출할지. */
  variant?: "compact" | "full";
  /** 헤더 표시. compact 모드 기본 false. */
  showHeader?: boolean;
};

export default function YoutubeSearchHistoryChips({
  onApply,
  refreshKey = 0,
  variant = "full",
  showHeader = true,
}: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setHistory(getHistory());
  }, [refreshKey]);

  if (history.length === 0) return null;

  const handleRemove = (ts: number) => {
    removeHistoryEntry(ts);
    setHistory(getHistory());
  };

  const handleClear = () => {
    if (!window.confirm("검색 히스토리를 모두 삭제하시겠습니까?")) return;
    clearHistory();
    setHistory([]);
    setExpanded(false);
  };

  const inlineCount = variant === "compact" ? 8 : 5;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-3 space-y-2">
      {showHeader && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-gray-700">최근 검색 ({history.length})</h3>
            <span className="text-[10px] text-gray-400 hidden sm:inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 캐시 보유
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Star size={9} className="text-amber-500 fill-amber-500" /> 선호 채널 (캐시 미적용)
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            {variant === "full" && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-gray-500 hover:text-gray-900"
              >
                {expanded ? "접기 ▲" : "모두 보기 ▼"}
              </button>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-red-500"
            >
              전체 비우기
            </button>
          </div>
        </div>
      )}

      {/* inline 목록 */}
      <div className="flex flex-wrap gap-1">
        {history.slice(0, inlineCount).map((entry) => {
          const isFav = entry.opts.useFavoritesOnly;
          const cached = !isFav && hasSearchCache(snapshotToYoutubeSearchOpts(entry.opts));
          const title = cached
            ? "결과 캐시 보유 — 클릭 시 결과까지 즉시 복원"
            : isFav
              ? "선호 채널 검색은 캐시되지 않습니다 (실시간 조회)"
              : "캐시 만료 — 폼만 복원됩니다";
          return (
            <button
              key={entry.ts}
              type="button"
              onClick={() => onApply(entry.opts)}
              className={cn(
                "inline-flex max-w-[220px] items-center gap-1 rounded-full border bg-white px-2.5 py-0.5 text-xs text-gray-700",
                cached
                  ? "border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50"
                  : isFav
                    ? "border-amber-200 hover:border-amber-300 hover:bg-amber-50"
                    : "border-gray-200 hover:border-primary-300 hover:bg-primary-50",
              )}
              title={title}
            >
              {cached ? (
                <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              ) : isFav ? (
                <Star size={10} className="shrink-0 text-amber-500 fill-amber-500" aria-hidden />
              ) : null}
              <span className="truncate">{describeHistoryOpts(entry.opts)}</span>
              <span className="shrink-0 text-[10px] text-gray-400">· {formatRelativeTime(entry.ts)}</span>
            </button>
          );
        })}
      </div>

      {/* 펼침 패널 */}
      {variant === "full" && expanded && (() => {
        const grouped = groupByPeriod(history);
        const renderGroup = (label: string, entries: HistoryEntry[]) => entries.length > 0 && (
          <div className="space-y-0.5">
            <h4 className="text-[10px] font-semibold uppercase text-gray-400">{label} ({entries.length})</h4>
            <ul className="space-y-0.5">
              {entries.map((entry) => {
                const isFav = entry.opts.useFavoritesOnly;
                const cached = !isFav && hasSearchCache(snapshotToYoutubeSearchOpts(entry.opts));
                const title = cached
                  ? "결과 캐시 보유 — 클릭 시 결과까지 즉시 복원"
                  : isFav
                    ? "선호 채널 검색은 캐시되지 않습니다 (실시간 조회)"
                    : "캐시 만료 — 폼만 복원됩니다";
                return (
                  <li key={entry.ts} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-white">
                    <button
                      type="button"
                      onClick={() => onApply(entry.opts)}
                      className="min-w-0 flex-1 text-left"
                      title={title}
                    >
                      <span className="flex items-center gap-1.5">
                        {cached ? (
                          <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                        ) : isFav ? (
                          <Star size={10} className="shrink-0 text-amber-500 fill-amber-500" aria-hidden />
                        ) : null}
                        <span className="block truncate text-gray-700">{describeHistoryOpts(entry.opts)}</span>
                      </span>
                      <span className="block text-[10px] text-gray-400">
                        {formatRelativeTime(entry.ts)}
                        {cached && " · 캐시 보유"}
                        {isFav && " · 선호 채널 (캐시 미적용)"}
                        {entry.opts.durations.length > 0 && ` · 길이 ${entry.opts.durations.length}개`}
                        {entry.opts.minViews > 0 && ` · 조회수 ${entry.opts.minViews.toLocaleString()}+`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(entry.ts)}
                      aria-label="히스토리 항목 삭제"
                      className="shrink-0 rounded-full p-0.5 text-gray-300 hover:bg-gray-100 hover:text-red-500"
                    >
                      <X size={10} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
        return (
          <div className="border-t border-gray-100 pt-2 space-y-2 max-h-72 overflow-y-auto">
            {renderGroup("오늘", grouped.today)}
            {renderGroup("이번 주", grouped.thisWeek)}
            {renderGroup("이번 달", grouped.thisMonth)}
            {grouped.today.length + grouped.thisWeek.length + grouped.thisMonth.length === 0 && (
              <p className="text-xs text-gray-400">이번 달 기록이 없습니다.</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
