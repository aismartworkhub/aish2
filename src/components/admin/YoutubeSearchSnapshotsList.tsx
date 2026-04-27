"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Trash2, Search, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSnapshots,
  removeSnapshot,
  clearSnapshots,
  SNAPSHOTS_MAX,
  type SearchSnapshot,
} from "@/lib/youtube-search-snapshots";
import { describeHistoryOpts, formatRelativeTime, type SearchOptsSnapshot } from "@/lib/youtube-search-history";
import { formatDurationLabel } from "@/lib/youtube-search";

type Props = {
  /** "이 조건으로 다시 검색" 버튼 클릭 시 호출 — 부모가 탭 전환 + 폼 복원 처리 */
  onApplyOpts: (opts: SearchOptsSnapshot) => void;
  /** 외부에서 새로고침 키. 변경 시 스냅샷 재로드. */
  refreshKey?: number;
};

export default function YoutubeSearchSnapshotsList({ onApplyOpts, refreshKey = 0 }: Props) {
  const [snapshots, setSnapshots] = useState<SearchSnapshot[]>([]);
  const [expandedTs, setExpandedTs] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSnapshots(getSnapshots());
  }, [refreshKey]);

  const toggleExpand = (ts: number) => {
    setExpandedTs((prev) => {
      const next = new Set(prev);
      if (next.has(ts)) next.delete(ts);
      else next.add(ts);
      return next;
    });
  };

  const handleRemove = (ts: number) => {
    if (!window.confirm("이 회차 스냅샷을 삭제하시겠습니까?")) return;
    removeSnapshot(ts);
    setSnapshots(getSnapshots());
    setExpandedTs((prev) => {
      const next = new Set(prev);
      next.delete(ts);
      return next;
    });
  };

  const handleClear = () => {
    if (!window.confirm("모든 검색 결과 스냅샷을 삭제하시겠습니까?")) return;
    clearSnapshots();
    setSnapshots([]);
    setExpandedTs(new Set());
  };

  if (snapshots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-10 text-center text-sm text-gray-400">
        아직 보관된 검색 결과 회차가 없습니다.
        <br />
        <span className="text-xs">고급 검색 탭에서 검색을 실행하면 결과가 자동으로 여기에 누적됩니다 (최대 {SNAPSHOTS_MAX}건).</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>최근 {snapshots.length}건 보관 (최대 {SNAPSHOTS_MAX}건, 오래된 회차부터 자동 삭제)</span>
        <button
          type="button"
          onClick={handleClear}
          className="text-gray-400 hover:text-red-500"
        >
          전체 비우기
        </button>
      </div>
      <ul className="space-y-2">
        {snapshots.map((s) => {
          const expanded = expandedTs.has(s.ts);
          return (
            <li key={s.ts} className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleExpand(s.ts)}
                  className="shrink-0 text-gray-400 hover:text-gray-700"
                  aria-label={expanded ? "접기" : "펼치기"}
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900 truncate max-w-[260px]">
                      {describeHistoryOpts(s.opts)}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatRelativeTime(s.ts)}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(s.ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {s.fromCache && (
                      <span className="text-[10px] rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0 text-blue-600">캐시</span>
                    )}
                    {s.opts.useFavoritesOnly && (
                      <span className="text-[10px] rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0 text-amber-700">선호 채널</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">{s.foundCount}건 발견</span>
                    {s.existsInAishCount > 0 && (
                      <span>이미 있음 {s.existsInAishCount}건</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onApplyOpts(s.opts)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
                  title="이 조건으로 고급 검색 탭에서 재실행"
                >
                  <Search size={11} />
                  다시 검색
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(s.ts)}
                  aria-label="스냅샷 삭제"
                  className="shrink-0 p-1.5 rounded text-gray-300 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {expanded && (
                <div className="border-t border-gray-100 bg-gray-50/40 p-3">
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {s.items.map((v) => (
                      <li key={v.videoId} className="flex gap-2 rounded-lg bg-white p-2 hover:bg-gray-50">
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 relative w-24 aspect-video bg-gray-100 rounded overflow-hidden"
                          title="YouTube에서 열기"
                        >
                          {v.thumbnailUrl && (
                            <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          )}
                          {v.durationSeconds > 0 && (
                            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 py-0.5 text-[9px] font-bold text-white">
                              {formatDurationLabel(v.durationSeconds)}
                            </span>
                          )}
                        </a>
                        <div className="min-w-0 flex-1 flex flex-col">
                          <a
                            href={v.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="line-clamp-2 text-xs font-medium text-gray-900 hover:text-primary-600"
                          >
                            {v.title}
                          </a>
                          <div className="mt-auto flex items-center gap-2 text-[10px] text-gray-500">
                            <span className="truncate">{v.channelTitle}</span>
                            <span className={cn("inline-flex items-center gap-0.5 shrink-0", v.viewCount >= 100000 && "text-gray-700 font-medium")}>
                              <Eye size={9} /> {compactNumber(v.viewCount)}
                            </span>
                            <a
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto shrink-0 text-gray-400 hover:text-primary-600"
                              aria-label="YouTube 열기"
                            >
                              <ExternalLink size={11} />
                            </a>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function compactNumber(n: number): string {
  if (n < 1000) return n.toLocaleString();
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 100000000) return `${(n / 10000).toFixed(0)}만`;
  return `${(n / 100000000).toFixed(1)}억`;
}
