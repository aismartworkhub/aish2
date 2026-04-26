"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, ExternalLink, Plus, Eye, ThumbsUp, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import {
  searchYouTubeVideos,
  listVideoCategories,
  formatDurationLabel,
  type YoutubeVideoDetail,
  type YoutubeCategory,
  type YoutubeSearchOpts,
} from "@/lib/youtube-search";
import YoutubePublishModal from "@/components/admin/YoutubePublishModal";

type Props = {
  /** 기존 /admin/ai-content가 가진 YouTube API 키 */
  youtubeApiKey: string;
};

const VIEW_PRESETS = [
  { label: "1천+", value: 1000 },
  { label: "1만+", value: 10000 },
  { label: "10만+", value: 100000 },
  { label: "100만+", value: 1000000 },
];

const SUB_PRESETS = [
  { label: "1천+", value: 1000 },
  { label: "1만+", value: 10000 },
  { label: "10만+", value: 100000 },
  { label: "100만+", value: 1000000 },
];

const PERIOD_OPTIONS = [
  { label: "최근 7일", value: 7 },
  { label: "최근 30일", value: 30 },
  { label: "최근 3개월", value: 90 },
  { label: "최근 1년", value: 365 },
  { label: "전체", value: 0 },
];

const ORDER_OPTIONS = [
  { label: "조회수 ↓", value: "viewCount" as const },
  { label: "최신순", value: "date" as const },
  { label: "관련도", value: "relevance" as const },
];

const DURATION_OPTIONS = [
  { label: "전체", value: "any" as const },
  { label: "짧은 영상 (<4분)", value: "short" as const },
  { label: "중간 (4~20분)", value: "medium" as const },
  { label: "긴 영상 (>20분)", value: "long" as const },
];

export default function YoutubeAdvancedSearch({ youtubeApiKey }: Props) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<YoutubeCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [keywords, setKeywords] = useState<string>("");
  const [keywordMode, setKeywordMode] = useState<"or" | "and">("or");
  const [minViews, setMinViews] = useState<number>(10000);
  const [minSubs, setMinSubs] = useState<number>(0);
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [order, setOrder] = useState<"viewCount" | "date" | "relevance">("viewCount");
  const [duration, setDuration] = useState<"any" | "short" | "medium" | "long">("any");
  const [maxResults, setMaxResults] = useState<25 | 50>(25);

  const [results, setResults] = useState<YoutubeVideoDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [quotaUsedSession, setQuotaUsedSession] = useState(0);
  const [publishModalVideo, setPublishModalVideo] = useState<YoutubeVideoDetail | null>(null);
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set());

  // 카테고리 로드 (API 키가 있을 때 한 번)
  useEffect(() => {
    if (!youtubeApiKey) return;
    listVideoCategories(youtubeApiKey, "KR")
      .then(setCategories)
      .catch((e) => {
        if (process.env.NODE_ENV === "development") console.warn("카테고리 로드 실패:", e);
      });
  }, [youtubeApiKey]);

  const buildQ = useMemo(() => {
    const tokens = keywords.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (tokens.length === 0) return "";
    if (keywordMode === "or") return tokens.join(" OR ");
    return tokens.join(" "); // search.list 기본은 AND
  }, [keywords, keywordMode]);

  const handleSearch = async () => {
    if (!youtubeApiKey) {
      toast("YouTube API 키가 설정되지 않았습니다. '대시보드' 탭에서 입력하세요.", "error");
      return;
    }
    if (!buildQ) {
      toast("검색어를 입력하세요.", "error");
      return;
    }
    setLoading(true);
    setResults([]);
    setSearched(true);
    try {
      const publishedAfter = periodDays > 0
        ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
      const opts: YoutubeSearchOpts = {
        q: buildQ,
        categoryId: categoryId || undefined,
        minViews,
        minSubscribers: minSubs,
        publishedAfter,
        order,
        videoDuration: duration === "any" ? undefined : duration,
        maxResults,
        regionCode: "KR",
        relevanceLanguage: "ko",
      };
      const { items, quotaUsed } = await searchYouTubeVideos(youtubeApiKey, opts);
      setResults(items);
      setQuotaUsedSession((q) => q + quotaUsed);
      if (items.length === 0) {
        toast("검색 결과가 없습니다. 조건을 완화해보세요.", "info");
      }
    } catch (e) {
      toast(`검색 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">🔍 YouTube 고급 검색</h2>
          <p className="mt-1 text-sm text-gray-500">
            카테고리·검색어·조회수·구독자수·기간·길이를 조합해 영상을 찾고 AISH에 발행합니다.
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          이번 세션 사용: <span className="font-semibold text-gray-900">{quotaUsedSession.toLocaleString()}</span> 단위
          <div className="text-[10px] text-gray-400">일일 무료 쿼터 10,000</div>
        </div>
      </div>

      {/* 검색 폼 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 카테고리 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">카테고리</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">전체</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* 검색어 + 모드 */}
          <div>
            <label className="mb-1 flex items-center justify-between text-sm font-medium text-gray-700">
              검색어 (쉼표·줄바꿈으로 다중 입력)
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setKeywordMode("or")}
                  className={cn("rounded px-2 py-0.5", keywordMode === "or" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600")}
                >
                  OR
                </button>
                <button
                  type="button"
                  onClick={() => setKeywordMode("and")}
                  className={cn("rounded px-2 py-0.5", keywordMode === "and" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600")}
                >
                  AND
                </button>
              </div>
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="LLM, 파인튜닝, 한국어"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 최소 조회수 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">최소 조회수</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {VIEW_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setMinViews(p.value)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs",
                    minViews === p.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  {p.label}
                </button>
              ))}
              <input
                type="number"
                value={minViews}
                onChange={(e) => setMinViews(Number(e.target.value) || 0)}
                className="ml-1 w-24 rounded-lg border border-gray-200 px-2 py-1 text-xs"
                min={0}
              />
            </div>
          </div>

          {/* 최소 구독자수 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">최소 구독자수</label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMinSubs(0)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs",
                  minSubs === 0 ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                )}
              >
                무관
              </button>
              {SUB_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setMinSubs(p.value)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs",
                    minSubs === p.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  {p.label}
                </button>
              ))}
              <input
                type="number"
                value={minSubs}
                onChange={(e) => setMinSubs(Number(e.target.value) || 0)}
                className="ml-1 w-24 rounded-lg border border-gray-200 px-2 py-1 text-xs"
                min={0}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* 기간 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">기간</label>
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* 정렬 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">정렬</label>
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as "viewCount" | "date" | "relevance")}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {ORDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* 영상 길이 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">영상 길이</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as "any" | "short" | "medium" | "long")}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* 결과 수 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">결과 수</label>
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value) as 25 | 50)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value={25}>25건</option>
              <option value={50}>50건</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || !youtubeApiKey}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {loading ? "검색 중..." : "검색"}
          </button>
        </div>

        {!youtubeApiKey && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            YouTube API 키가 설정되지 않았습니다. <strong>대시보드 탭</strong>에서 입력 후 다시 시도하세요.
          </div>
        )}
      </div>

      {/* 결과 그리드 */}
      {searched && !loading && results.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-16 text-center text-sm text-gray-500">
          조건에 맞는 영상이 없습니다. 조회수·구독자수를 낮추거나 기간을 늘려보세요.
        </div>
      )}

      {results.length > 0 && (
        <div>
          <p className="mb-3 text-sm text-gray-500">{results.length}건 발견</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((v) => (
              <ResultCard
                key={v.videoId}
                video={v}
                published={publishedIds.has(v.videoId)}
                onPublish={() => setPublishModalVideo(v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 발행 모달 */}
      <YoutubePublishModal
        video={publishModalVideo}
        onClose={() => setPublishModalVideo(null)}
        onPublished={(id) => {
          setPublishedIds((prev) => new Set(prev).add(id));
        }}
      />
    </div>
  );
}

function ResultCard({
  video,
  published,
  onPublish,
}: {
  video: YoutubeVideoDetail;
  published: boolean;
  onPublish: () => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* 썸네일 */}
      <div className="relative aspect-video bg-gray-100">
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        )}
        {video.durationSeconds > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {formatDurationLabel(video.durationSeconds)}
          </span>
        )}
        {published && (
          <span className="absolute top-1.5 left-1.5 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
            ✓ 발행됨
          </span>
        )}
      </div>

      {/* 본문 */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{video.title}</h3>
        <div className="text-xs text-gray-500">
          {video.channelTitle}
          {video.channelSubscribers > 0 && (
            <span className="ml-1 text-gray-400">· 구독 {compactNumber(video.channelSubscribers)}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-0.5"><Eye size={11} /> {compactNumber(video.viewCount)}</span>
          <span className="flex items-center gap-0.5"><ThumbsUp size={11} /> {compactNumber(video.likeCount)}</span>
          <span className="flex items-center gap-0.5"><MessageCircle size={11} /> {compactNumber(video.commentCount)}</span>
          <span className="ml-auto" suppressHydrationWarning>{formatDate(video.publishedAt)}</span>
        </div>

        {/* 액션 */}
        <div className="mt-auto flex items-center gap-1.5 pt-2">
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink size={12} />
            YouTube
          </a>
          <button
            type="button"
            onClick={onPublish}
            disabled={published}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
              published
                ? "bg-emerald-100 text-emerald-700 cursor-default"
                : "bg-primary-600 text-white hover:bg-primary-700",
            )}
          >
            <Plus size={12} />
            {published ? "발행됨" : "발행"}
          </button>
        </div>
      </div>
    </div>
  );
}

function compactNumber(n: number): string {
  if (n < 1000) return n.toLocaleString();
  if (n < 10000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 100000000) return `${(n / 10000).toFixed(0)}만`;
  return `${(n / 100000000).toFixed(1)}억`;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = Date.now();
    const days = Math.floor((now - d.getTime()) / (24 * 60 * 60 * 1000));
    if (days < 1) return "오늘";
    if (days < 7) return `${days}일 전`;
    if (days < 30) return `${Math.floor(days / 7)}주 전`;
    if (days < 365) return `${Math.floor(days / 30)}개월 전`;
    return `${Math.floor(days / 365)}년 전`;
  } catch {
    return iso;
  }
}
