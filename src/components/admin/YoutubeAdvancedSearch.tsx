"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, ExternalLink, Plus, Eye, ThumbsUp, MessageCircle, Sparkles, Link2, Bookmark, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { mergeBoardsByKey, getBoardsByGroupDefault } from "@/lib/board-defaults";
import type { BoardConfig } from "@/types/content";
import {
  searchYouTubeVideos,
  searchInFavoriteChannels,
  listVideoCategories,
  listChannelVideos,
  summarizeYouTubeVideo,
  formatDurationLabel,
  durationCategory,
  type YoutubeVideoDetail,
  type YoutubeCategory,
  type YoutubeSearchOpts,
  type YoutubeAiSummary,
} from "@/lib/youtube-search";
import { getGeminiApiKey } from "@/lib/gemini";
import { getContentsPaginated, findContentsByMediaUrls, createContent, getBoards } from "@/lib/content-engine";
import type { Content } from "@/types/content";
import YoutubePublishModal from "@/components/admin/YoutubePublishModal";
import {
  getYoutubeQuotaToday,
  incrementYoutubeQuota,
  YOUTUBE_DAILY_LIMIT,
  YOUTUBE_WARN_THRESHOLD,
  YOUTUBE_BLOCK_THRESHOLD,
} from "@/lib/youtube-quota";
import { readSearchCache, writeSearchCache } from "@/lib/youtube-search-cache";
import { getPresets, savePresets, MAX_PRESETS, type YoutubeSearchPreset } from "@/lib/youtube-search-presets";
import {
  getFavoriteChannels,
  addFavoriteChannel,
  removeFavoriteChannel,
  extractChannelId,
  MAX_FAVORITE_CHANNELS,
  type FavoriteChannel,
} from "@/lib/youtube-favorite-channels";
import {
  getHistory,
  pushHistory,
  removeHistoryEntry,
  clearHistory,
  formatRelativeTime,
  groupByPeriod,
  describeHistoryOpts,
  type HistoryEntry,
  type SearchOptsSnapshot,
} from "@/lib/youtube-search-history";

type RelatedData = {
  channelVideos: YoutubeVideoDetail[];
  internalContents: Content[];
};

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

const DURATION_CHOICES: { value: "short" | "medium" | "long"; label: string }[] = [
  { value: "short", label: "짧은 (<4분)" },
  { value: "medium", label: "중간 (4~20분)" },
  { value: "long", label: "긴 (>20분)" },
];

export default function YoutubeAdvancedSearch({ youtubeApiKey }: Props) {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [categories, setCategories] = useState<YoutubeCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [keywords, setKeywords] = useState<string>("");
  const [keywordMode, setKeywordMode] = useState<"or" | "and">("or");
  const [minViews, setMinViews] = useState<number>(10000);
  const [minSubs, setMinSubs] = useState<number>(0);
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [order, setOrder] = useState<"viewCount" | "date" | "relevance">("viewCount");
  const [durations, setDurations] = useState<Set<"short" | "medium" | "long">>(new Set());
  const [maxResults, setMaxResults] = useState<25 | 50>(25);

  const [results, setResults] = useState<YoutubeVideoDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [quotaUsedSession, setQuotaUsedSession] = useState(0);
  const [publishModalVideo, setPublishModalVideo] = useState<YoutubeVideoDetail | null>(null);
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set());
  const [existsInAishIds, setExistsInAishIds] = useState<Set<string>>(new Set());

  const [geminiKey, setGeminiKey] = useState<string>("");
  const [summaries, setSummaries] = useState<Map<string, YoutubeAiSummary>>(new Map());
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [relatedData, setRelatedData] = useState<Map<string, RelatedData>>(new Map());
  const [loadingRelatedId, setLoadingRelatedId] = useState<string | null>(null);

  const [quotaUsedToday, setQuotaUsedToday] = useState(0);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [presets, setPresets] = useState<YoutubeSearchPreset[]>([]);

  const [favoriteChannels, setFavoriteChannels] = useState<FavoriteChannel[]>([]);
  const [useFavoritesOnly, setUseFavoritesOnly] = useState(false);
  const [channelInput, setChannelInput] = useState("");

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const [autoPublishEnabled, setAutoPublishEnabled] = useState(false);
  const [autoPublishBoardKey, setAutoPublishBoardKey] = useState<string>("media-resource");
  const [autoPublishPolicy, setAutoPublishPolicy] = useState<"review" | "publish">("review");
  const [autoPublishProgress, setAutoPublishProgress] = useState<{ total: number; done: number; success: number; skipped: number; failed: number } | null>(null);
  const [publishBoards, setPublishBoards] = useState<BoardConfig[]>(() =>
    mergeBoardsByKey(getBoardsByGroupDefault("media"), []),
  );

  // 카테고리 로드 (API 키가 있을 때 한 번)
  useEffect(() => {
    if (!youtubeApiKey) return;
    listVideoCategories(youtubeApiKey, "KR")
      .then(setCategories)
      .catch((e) => {
        if (process.env.NODE_ENV === "development") console.warn("카테고리 로드 실패:", e);
      });
  }, [youtubeApiKey]);

  // Gemini 키 로드 (AI 요약용, 선택사항)
  useEffect(() => {
    getGeminiApiKey().then((k) => { if (k) setGeminiKey(k); }).catch(() => {});
  }, []);

  // 오늘의 쿼터 사용량 + 프리셋 + 선호 채널 + 보드 목록 + 검색 히스토리 로드
  useEffect(() => {
    getYoutubeQuotaToday().then((q) => setQuotaUsedToday(q.used)).catch(() => {});
    getPresets().then(setPresets).catch(() => {});
    getFavoriteChannels().then(setFavoriteChannels).catch(() => {});
    getBoards()
      .then((list) => setPublishBoards(mergeBoardsByKey([
        ...getBoardsByGroupDefault("media"),
        ...getBoardsByGroupDefault("community"),
      ], list)))
      .catch(() => {});
    setHistory(getHistory());
  }, []);

  const applyHistory = (opts: SearchOptsSnapshot) => {
    setCategoryId(opts.categoryId);
    setKeywords(opts.keywords);
    setKeywordMode(opts.keywordMode);
    setMinViews(opts.minViews);
    setMinSubs(opts.minSubs);
    setPeriodDays(opts.periodDays);
    setOrder(opts.order);
    setDurations(new Set(opts.durations));
    setMaxResults(opts.maxResults);
    setUseFavoritesOnly(opts.useFavoritesOnly);
  };

  const handleRemoveHistory = (ts: number) => {
    removeHistoryEntry(ts);
    setHistory(getHistory());
  };

  const handleClearHistory = () => {
    if (!window.confirm("검색 히스토리를 모두 삭제하시겠습니까?")) return;
    clearHistory();
    setHistory([]);
    setHistoryExpanded(false);
  };

  const captureCurrentOpts = (): SearchOptsSnapshot => ({
    categoryId,
    keywords,
    keywordMode,
    minViews,
    minSubs,
    periodDays,
    order,
    durations: [...durations],
    maxResults,
    useFavoritesOnly,
  });

  const favoriteChannelIds = useMemo(
    () => new Set(favoriteChannels.map((c) => c.channelId)),
    [favoriteChannels],
  );

  const handleAddFavoriteChannel = async (channelId: string, channelTitle: string) => {
    if (favoriteChannels.length >= MAX_FAVORITE_CHANNELS) {
      toast(`선호 채널은 최대 ${MAX_FAVORITE_CHANNELS}개까지 등록 가능합니다.`, "error");
      return;
    }
    try {
      const next = await addFavoriteChannel({ channelId, channelTitle, addedAt: new Date().toISOString() });
      setFavoriteChannels(next);
      toast(`"${channelTitle}" 선호 채널 추가됨`, "success");
    } catch {
      toast("선호 채널 추가 실패", "error");
    }
  };

  const handleRemoveFavoriteChannel = async (channelId: string) => {
    try {
      const next = await removeFavoriteChannel(channelId);
      setFavoriteChannels(next);
    } catch {
      toast("선호 채널 삭제 실패", "error");
    }
  };

  const handleAddChannelByInput = async () => {
    const id = extractChannelId(channelInput);
    if (!id) {
      toast("UC로 시작하는 채널 ID 또는 youtube.com/channel/UC... URL을 입력하세요. (@handle 미지원)", "error");
      return;
    }
    if (favoriteChannelIds.has(id)) {
      toast("이미 등록된 채널입니다.", "info");
      return;
    }
    // 채널명 조회 (channels.list — 1단위)
    try {
      const sp = new URLSearchParams({ part: "snippet", id, key: youtubeApiKey });
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${sp.toString()}`);
      if (!res.ok) throw new Error("채널 정보 조회 실패");
      incrementYoutubeQuota(1).then(() => setQuotaUsedToday((u) => u + 1)).catch(() => {});
      const data = (await res.json()) as { items?: Array<{ snippet?: { title?: string } }> };
      const title = data.items?.[0]?.snippet?.title;
      if (!title) {
        toast("존재하지 않는 채널 ID입니다.", "error");
        return;
      }
      await handleAddFavoriteChannel(id, title);
      setChannelInput("");
    } catch (e) {
      toast(`채널 조회 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
    }
  };

  const buildQ = useMemo(() => {
    const tokens = keywords.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (tokens.length === 0) return "";
    if (keywordMode === "or") return tokens.join(" OR ");
    return tokens.join(" "); // search.list 기본은 AND
  }, [keywords, keywordMode]);

  const handleSummarize = async (video: YoutubeVideoDetail) => {
    if (summaries.has(video.videoId)) return; // 캐시 hit
    if (!geminiKey) {
      toast("Gemini API 키가 설정되지 않았습니다. 설정 페이지에서 등록하세요.", "error");
      return;
    }
    setSummarizingId(video.videoId);
    try {
      const result = await summarizeYouTubeVideo(geminiKey, {
        title: video.title,
        description: video.description,
      });
      if (!result.summary) {
        toast("AI 요약 결과가 비어있습니다.", "error");
      } else {
        setSummaries((prev) => new Map(prev).set(video.videoId, result));
      }
    } catch (e) {
      toast(`AI 요약 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
    } finally {
      setSummarizingId(null);
    }
  };

  const handleRelated = async (video: YoutubeVideoDetail) => {
    if (relatedData.has(video.videoId)) return; // 캐시 hit
    setLoadingRelatedId(video.videoId);
    try {
      const tagsForLookup = (summaries.get(video.videoId)?.recommendedTags ?? video.tags ?? []).slice(0, 10);
      const [channelRes, internalPage] = await Promise.all([
        listChannelVideos(youtubeApiKey, video.channelId, { maxResults: 5, order: "viewCount" })
          .catch(() => ({ items: [] as YoutubeVideoDetail[], quotaUsed: 0 })),
        tagsForLookup.length > 0
          ? getContentsPaginated({ tags: tagsForLookup, limit: 4 }).catch(() => ({ items: [] as Content[], lastDoc: null, hasMore: false }))
          : Promise.resolve({ items: [] as Content[], lastDoc: null, hasMore: false }),
      ]);
      // 같은 영상 자체는 제외
      const channelVideos = channelRes.items.filter((v) => v.videoId !== video.videoId).slice(0, 5);
      setQuotaUsedSession((q) => q + channelRes.quotaUsed);
      if (channelRes.quotaUsed > 0) {
        incrementYoutubeQuota(channelRes.quotaUsed)
          .then(() => setQuotaUsedToday((u) => u + channelRes.quotaUsed))
          .catch(() => {});
      }
      setRelatedData((prev) => new Map(prev).set(video.videoId, {
        channelVideos,
        internalContents: internalPage.items,
      }));
    } catch (e) {
      toast(`유사 자료 로드 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
    } finally {
      setLoadingRelatedId(null);
    }
  };

  const handleAutoPublish = async (items: YoutubeVideoDetail[], existsSet: Set<string>) => {
    if (!user) {
      toast("로그인이 필요합니다 (자동 발행 스킵).", "error");
      return;
    }
    const total = items.length;
    let done = 0, success = 0, skipped = 0, failed = 0;
    setAutoPublishProgress({ total, done, success, skipped, failed });

    for (const v of items) {
      // 이미 등록된 영상 스킵
      if (existsSet.has(v.videoId) || publishedIds.has(v.videoId)) {
        skipped++;
        done++;
        setAutoPublishProgress({ total, done, success, skipped, failed });
        continue;
      }
      try {
        await createContent({
          boardKey: autoPublishBoardKey,
          title: v.title,
          body: v.description.slice(0, 500),
          mediaType: "youtube",
          mediaUrl: v.url,
          thumbnailUrl: v.thumbnailUrl,
          tags: (v.tags ?? []).slice(0, 10),
          isPinned: false,
          isApproved: autoPublishPolicy === "publish",
          authorUid: user.uid,
          authorName: profile?.displayName ?? user.displayName ?? "관리자",
          authorPhotoURL: user.photoURL ?? undefined,
        });
        success++;
        setPublishedIds((prev) => new Set(prev).add(v.videoId));
      } catch {
        failed++;
      }
      done++;
      setAutoPublishProgress({ total, done, success, skipped, failed });
      // rate limit: 100ms 간격
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    toast(
      `자동 발행 완료: 성공 ${success}건 / 스킵 ${skipped}건${failed > 0 ? ` / 실패 ${failed}건` : ""}`,
      failed > 0 ? "error" : "success",
    );
    // 5초 후 progress 숨김
    setTimeout(() => setAutoPublishProgress(null), 5000);
  };

  const matchExistsInAish = async (items: YoutubeVideoDetail[]): Promise<Set<string>> => {
    try {
      const matched = await findContentsByMediaUrls(items.map((v) => v.url));
      const set = new Set<string>();
      const ytPrefix = "https://www.youtube.com/watch?v=";
      for (const c of matched) {
        if (c.mediaUrl?.startsWith(ytPrefix)) {
          set.add(c.mediaUrl.slice(ytPrefix.length));
        }
      }
      setExistsInAishIds(set);
      return set;
    } catch {
      return new Set<string>();
    }
  };

  const handleSearch = async () => {
    if (!youtubeApiKey) {
      toast("YouTube API 키가 설정되지 않았습니다. '대시보드' 탭에서 입력하세요.", "error");
      return;
    }
    const usingFavoritesOnly = useFavoritesOnly && favoriteChannels.length > 0;
    // 선호 채널 모드는 q 미입력도 허용 (채널 인기/최신 영상 그대로)
    if (!usingFavoritesOnly && !buildQ) {
      toast("검색어를 입력하세요.", "error");
      return;
    }
    if (quotaUsedToday >= YOUTUBE_BLOCK_THRESHOLD) {
      toast(`오늘 YouTube API 쿼터가 거의 소진되었습니다 (${quotaUsedToday}/${YOUTUBE_DAILY_LIMIT}). 내일 다시 시도하세요.`, "error");
      return;
    }
    setLoading(true);
    setResults([]);
    setSearched(true);
    setExistsInAishIds(new Set());
    setFromCache(false);
    // 검색 히스토리 자동 저장 (빈 검색은 모듈 내부에서 무시)
    pushHistory(captureCurrentOpts());
    setHistory(getHistory());
    try {
      const publishedAfter = periodDays > 0
        ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
      // 길이 단일 선택 시에만 API에 전달 (멀티는 클라 필터)
      const apiVideoDuration = durations.size === 1 ? [...durations][0] : undefined;
      const opts: YoutubeSearchOpts = {
        q: buildQ,
        categoryId: categoryId || undefined,
        minViews,
        minSubscribers: minSubs,
        publishedAfter,
        order,
        videoDuration: apiVideoDuration,
        maxResults,
      };

      // 길이 멀티 선택 시 클라이언트 필터 (size 0 또는 3 = 전체 통과)
      const filterByDurations = (items: YoutubeVideoDetail[]): YoutubeVideoDetail[] => {
        if (durations.size === 0 || durations.size === 3) return items;
        return items.filter((v) => durations.has(durationCategory(v.durationSeconds)));
      };

      // 선호 채널 모드는 캐시 미적용 (채널 변동 반영 위함)
      if (!usingFavoritesOnly && !forceRefresh) {
        const cached = readSearchCache(opts);
        if (cached) {
          const filtered = filterByDurations(cached);
          setResults(filtered);
          setFromCache(true);
          if (filtered.length > 0) {
            const exists = await matchExistsInAish(filtered);
            if (autoPublishEnabled) await handleAutoPublish(filtered, exists);
          } else {
            toast("캐시: 결과 없음", "info");
          }
          setLoading(false);
          return;
        }
      }

      const { items, quotaUsed } = usingFavoritesOnly
        ? await searchInFavoriteChannels(youtubeApiKey, favoriteChannels, opts)
        : await searchYouTubeVideos(youtubeApiKey, opts);
      const filteredItems = filterByDurations(items);
      setResults(filteredItems);
      setQuotaUsedSession((q) => q + quotaUsed);
      if (quotaUsed > 0) {
        incrementYoutubeQuota(quotaUsed)
          .then(() => setQuotaUsedToday((u) => u + quotaUsed))
          .catch(() => {});
      }
      if (!usingFavoritesOnly) {
        writeSearchCache(opts, items); // 일반 검색만 캐시
      }
      if (filteredItems.length === 0) {
        toast("검색 결과가 없습니다. 조건을 완화해보세요.", "info");
      } else {
        const exists = await matchExistsInAish(filteredItems);
        if (autoPublishEnabled) await handleAutoPublish(filteredItems, exists);
      }
    } catch (e) {
      toast(`검색 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: YoutubeSearchPreset) => {
    setCategoryId(preset.opts.categoryId);
    setKeywords(preset.opts.keywords);
    setKeywordMode(preset.opts.keywordMode);
    setMinViews(preset.opts.minViews);
    setMinSubs(preset.opts.minSubs);
    setPeriodDays(preset.opts.periodDays);
    setOrder(preset.opts.order);
    setDurations(new Set(preset.opts.durations ?? []));
    setMaxResults(preset.opts.maxResults);
    toast(`프리셋 "${preset.name}" 적용됨`, "info");
  };

  const handleSavePreset = async () => {
    if (presets.length >= MAX_PRESETS) {
      toast(`프리셋은 최대 ${MAX_PRESETS}개까지 저장됩니다.`, "error");
      return;
    }
    if (!keywords.trim()) {
      toast("저장할 검색 조건이 없습니다 (검색어를 입력하세요).", "error");
      return;
    }
    const name = window.prompt("프리셋 이름을 입력하세요:");
    if (!name?.trim()) return;
    const next: YoutubeSearchPreset = {
      name: name.trim(),
      opts: {
        categoryId,
        keywords,
        keywordMode,
        minViews,
        minSubs,
        periodDays,
        order,
        durations: [...durations],
        maxResults,
      },
    };
    const updated = [...presets, next];
    try {
      await savePresets(updated);
      setPresets(updated);
      toast("프리셋 저장 완료", "success");
    } catch {
      toast("프리셋 저장 실패", "error");
    }
  };

  const handleDeletePreset = async (idx: number) => {
    const updated = presets.filter((_, i) => i !== idx);
    try {
      await savePresets(updated);
      setPresets(updated);
    } catch {
      toast("프리셋 삭제 실패", "error");
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
        <div className="text-right text-xs">
          <div className={cn(
            quotaUsedToday >= YOUTUBE_BLOCK_THRESHOLD ? "text-red-600 font-bold"
              : quotaUsedToday >= YOUTUBE_WARN_THRESHOLD ? "text-amber-600 font-semibold"
              : "text-gray-500",
          )}>
            오늘 사용: <span className="font-semibold">{quotaUsedToday.toLocaleString()}</span> / {YOUTUBE_DAILY_LIMIT.toLocaleString()}
          </div>
          <div className="text-[10px] text-gray-400">이번 세션 {quotaUsedSession.toLocaleString()} 단위</div>
        </div>
      </div>

      {/* 즐겨찾는 검색 조건 (Presets) */}
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 mr-1">프리셋:</span>
          {presets.map((p, idx) => (
            <span key={`${p.name}-${idx}`} className="inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-white pl-2.5 pr-1 py-0.5 text-xs hover:border-primary-300">
              <button
                type="button"
                onClick={() => applyPreset(p)}
                className="text-gray-700 hover:text-primary-700"
              >
                {p.name}
              </button>
              <button
                type="button"
                onClick={() => handleDeletePreset(idx)}
                aria-label="프리셋 삭제"
                className="ml-0.5 rounded-full p-0.5 text-gray-300 hover:bg-gray-100 hover:text-red-500"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 검색 히스토리 */}
      {history.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-gray-700">최근 검색 ({history.length})</h3>
            <div className="flex items-center gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => setHistoryExpanded((v) => !v)}
                className="text-gray-500 hover:text-gray-900"
              >
                {historyExpanded ? "접기 ▲" : "모두 보기 ▼"}
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-gray-400 hover:text-red-500"
              >
                전체 비우기
              </button>
            </div>
          </div>

          {/* inline 5개 */}
          <div className="flex flex-wrap gap-1">
            {history.slice(0, 5).map((entry) => (
              <button
                key={entry.ts}
                type="button"
                onClick={() => applyHistory(entry.opts)}
                className="inline-flex max-w-[200px] items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs text-gray-700 hover:border-primary-300 hover:bg-primary-50"
                title="이 조건으로 폼 복원 (검색은 별도 클릭)"
              >
                <span className="truncate">{describeHistoryOpts(entry.opts)}</span>
                <span className="shrink-0 text-[10px] text-gray-400">· {formatRelativeTime(entry.ts)}</span>
              </button>
            ))}
          </div>

          {/* 펼침 패널 */}
          {historyExpanded && (() => {
            const grouped = groupByPeriod(history);
            const renderGroup = (label: string, entries: HistoryEntry[]) => entries.length > 0 && (
              <div className="space-y-0.5">
                <h4 className="text-[10px] font-semibold uppercase text-gray-400">{label} ({entries.length})</h4>
                <ul className="space-y-0.5">
                  {entries.map((entry) => (
                    <li key={entry.ts} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-white">
                      <button
                        type="button"
                        onClick={() => applyHistory(entry.opts)}
                        className="min-w-0 flex-1 text-left"
                        title="이 조건으로 폼 복원"
                      >
                        <span className="block truncate text-gray-700">{describeHistoryOpts(entry.opts)}</span>
                        <span className="block text-[10px] text-gray-400">
                          {formatRelativeTime(entry.ts)}
                          {entry.opts.useFavoritesOnly && " · 선호 채널만"}
                          {entry.opts.durations.length > 0 && ` · 길이 ${entry.opts.durations.length}개`}
                          {entry.opts.minViews > 0 && ` · 조회수 ${entry.opts.minViews.toLocaleString()}+`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveHistory(entry.ts)}
                        aria-label="히스토리 항목 삭제"
                        className="shrink-0 rounded-full p-0.5 text-gray-300 hover:bg-gray-100 hover:text-red-500"
                      >
                        <X size={10} />
                      </button>
                    </li>
                  ))}
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
      )}

      {/* 선호 채널 */}
      <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Star size={14} className="text-amber-500 fill-amber-500" />
            선호 채널 ({favoriteChannels.length}/{MAX_FAVORITE_CHANNELS})
          </h3>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={useFavoritesOnly}
              onChange={(e) => setUseFavoritesOnly(e.target.checked)}
              disabled={favoriteChannels.length === 0}
              className="h-3.5 w-3.5 rounded border-gray-300 text-amber-500"
            />
            선호 채널만 검색
            {useFavoritesOnly && favoriteChannels.length > 0 && (
              <span className="text-[10px] text-amber-700">
                — 약 {favoriteChannels.length * 100 + 2} 단위 예상
              </span>
            )}
          </label>
        </div>

        <div className="flex gap-1.5">
          <input
            type="text"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddChannelByInput(); }}
            placeholder="UC... 채널 ID 또는 youtube.com/channel/UC... URL"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            disabled={!youtubeApiKey}
          />
          <button
            type="button"
            onClick={handleAddChannelByInput}
            disabled={!youtubeApiKey || !channelInput.trim()}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            추가
          </button>
        </div>

        {favoriteChannels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {favoriteChannels.map((c) => (
              <span key={c.channelId} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white pl-2.5 pr-1 py-0.5 text-xs">
                <span className="text-gray-700">{c.channelTitle}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFavoriteChannel(c.channelId)}
                  aria-label="선호 채널 삭제"
                  className="ml-0.5 rounded-full p-0.5 text-gray-300 hover:bg-gray-100 hover:text-red-500"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            아직 등록된 채널이 없습니다. 검색 결과 카드의 ★ 또는 위 입력창으로 추가하세요.
          </p>
        )}
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
          {/* 영상 길이 (멀티) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              영상 길이 <span className="text-[10px] text-gray-400">(미선택 = 전체)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_CHOICES.map((c) => {
                const checked = durations.has(c.value);
                return (
                  <label
                    key={c.value}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      checked ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setDurations((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.value)) next.delete(c.value); else next.add(c.value);
                          return next;
                        });
                      }}
                      className="sr-only"
                    />
                    {c.label}
                  </label>
                );
              })}
            </div>
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

        {/* 검색 후 자동 발행 (해석 A) */}
        <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 space-y-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={autoPublishEnabled}
              onChange={(e) => setAutoPublishEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600"
            />
            검색 후 자동 발행 — 결과 전체를 보드에 일괄 등록
          </label>
          {autoPublishEnabled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1 pl-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">발행 보드</label>
                <select
                  value={autoPublishBoardKey}
                  onChange={(e) => setAutoPublishBoardKey(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
                >
                  {publishBoards.map((b) => (
                    <option key={b.key} value={b.key}>{b.label} ({b.group})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">정책</label>
                <div className="flex gap-1.5">
                  <label className={cn(
                    "flex flex-1 cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs",
                    autoPublishPolicy === "review" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600",
                  )}>
                    <input type="radio" checked={autoPublishPolicy === "review"} onChange={() => setAutoPublishPolicy("review")} className="sr-only" />
                    검토 대기
                  </label>
                  <label className={cn(
                    "flex flex-1 cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs",
                    autoPublishPolicy === "publish" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600",
                  )}>
                    <input type="radio" checked={autoPublishPolicy === "publish"} onChange={() => setAutoPublishPolicy("publish")} className="sr-only" />
                    즉시 공개
                  </label>
                </div>
              </div>
              <div className="sm:col-span-2 text-[11px] text-amber-700">
                ⚠ 즉시 공개는 선호 채널 기반 검색에만 권장 — 일반 검색에서는 검토 대기를 추천합니다.
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600"
            />
            강제 재검색 (캐시 무시)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={presets.length >= MAX_PRESETS}
              title={presets.length >= MAX_PRESETS ? `최대 ${MAX_PRESETS}개` : "이 조건을 프리셋으로 저장"}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <Bookmark size={12} />
              이 조건 저장
            </button>
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading || !youtubeApiKey || quotaUsedToday >= YOUTUBE_BLOCK_THRESHOLD}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {loading ? "검색 중..." : "검색"}
            </button>
          </div>
        </div>

        {!youtubeApiKey && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            YouTube API 키가 설정되지 않았습니다. <strong>대시보드 탭</strong>에서 입력 후 다시 시도하세요.
          </div>
        )}
        {quotaUsedToday >= YOUTUBE_BLOCK_THRESHOLD && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            오늘 YouTube API 쿼터가 거의 소진되었습니다. KST 자정 이후에 다시 시도하세요.
          </div>
        )}
        {quotaUsedToday >= YOUTUBE_WARN_THRESHOLD && quotaUsedToday < YOUTUBE_BLOCK_THRESHOLD && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            오늘 사용량이 90%를 초과했습니다. 캐시 활용을 권장합니다.
          </div>
        )}
      </div>

      {/* 자동 발행 진행 상황 */}
      {autoPublishProgress && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-emerald-700">
            <span>자동 발행 진행: {autoPublishProgress.done} / {autoPublishProgress.total}</span>
            <span className="text-[10px] text-gray-500">
              성공 {autoPublishProgress.success} · 스킵 {autoPublishProgress.skipped}
              {autoPublishProgress.failed > 0 && ` · 실패 ${autoPublishProgress.failed}`}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${autoPublishProgress.total > 0 ? (autoPublishProgress.done / autoPublishProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* 결과 그리드 */}
      {searched && !loading && results.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-16 text-center text-sm text-gray-500">
          조건에 맞는 영상이 없습니다. 조회수·구독자수를 낮추거나 기간을 늘려보세요.
        </div>
      )}

      {results.length > 0 && (
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm text-gray-500">
            {results.length}건 발견
            {fromCache && (
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                캐시 (24h)
              </span>
            )}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((v) => (
              <ResultCard
                key={v.videoId}
                video={v}
                published={publishedIds.has(v.videoId)}
                existsInAish={existsInAishIds.has(v.videoId)}
                aiSummary={summaries.get(v.videoId)}
                related={relatedData.get(v.videoId)}
                summarizing={summarizingId === v.videoId}
                loadingRelated={loadingRelatedId === v.videoId}
                geminiAvailable={Boolean(geminiKey)}
                isFavoriteChannel={favoriteChannelIds.has(v.channelId)}
                onPublish={() => setPublishModalVideo(v)}
                onSummarize={() => handleSummarize(v)}
                onRelated={() => handleRelated(v)}
                onToggleFavoriteChannel={() => {
                  if (favoriteChannelIds.has(v.channelId)) handleRemoveFavoriteChannel(v.channelId);
                  else handleAddFavoriteChannel(v.channelId, v.channelTitle);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 발행 모달 */}
      <YoutubePublishModal
        video={publishModalVideo}
        initialSummary={publishModalVideo ? summaries.get(publishModalVideo.videoId)?.summary ?? "" : ""}
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
  existsInAish,
  aiSummary,
  related,
  summarizing,
  loadingRelated,
  geminiAvailable,
  isFavoriteChannel,
  onPublish,
  onSummarize,
  onRelated,
  onToggleFavoriteChannel,
}: {
  video: YoutubeVideoDetail;
  published: boolean;
  existsInAish: boolean;
  aiSummary?: YoutubeAiSummary;
  related?: RelatedData;
  summarizing: boolean;
  loadingRelated: boolean;
  geminiAvailable: boolean;
  isFavoriteChannel: boolean;
  onPublish: () => void;
  onSummarize: () => void;
  onRelated: () => void;
  onToggleFavoriteChannel: () => void;
}) {
  const blocked = published || existsInAish;
  const [expanded, setExpanded] = useState<"summary" | "related" | null>(null);

  const toggleSummary = () => {
    if (!aiSummary && !summarizing) onSummarize();
    setExpanded((e) => (e === "summary" ? null : "summary"));
  };
  const toggleRelated = () => {
    if (!related && !loadingRelated) onRelated();
    setExpanded((e) => (e === "related" ? null : "related"));
  };

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
        {published ? (
          <span className="absolute top-1.5 left-1.5 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
            ✓ 발행됨
          </span>
        ) : existsInAish ? (
          <span className="absolute top-1.5 left-1.5 rounded bg-gray-700/90 px-2 py-0.5 text-[10px] font-bold text-white">
            이미 있음
          </span>
        ) : null}
      </div>

      {/* 본문 */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{video.title}</h3>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="truncate min-w-0">{video.channelTitle}</span>
          {video.channelSubscribers > 0 && (
            <span className="shrink-0 text-gray-400">· 구독 {compactNumber(video.channelSubscribers)}</span>
          )}
          <button
            type="button"
            onClick={onToggleFavoriteChannel}
            title={isFavoriteChannel ? "선호 채널 — 클릭해 제거" : "이 채널을 선호 채널로 등록"}
            className={cn(
              "ml-auto shrink-0 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              isFavoriteChannel
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-gray-200 text-gray-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700",
            )}
          >
            <Star size={9} className={isFavoriteChannel ? "fill-amber-500 text-amber-500" : ""} />
            {isFavoriteChannel ? "선호" : "선호 등록"}
          </button>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-0.5"><Eye size={11} /> {compactNumber(video.viewCount)}</span>
          <span className="flex items-center gap-0.5"><ThumbsUp size={11} /> {compactNumber(video.likeCount)}</span>
          <span className="flex items-center gap-0.5"><MessageCircle size={11} /> {compactNumber(video.commentCount)}</span>
          <span className="ml-auto" suppressHydrationWarning>{formatDate(video.publishedAt)}</span>
        </div>

        {/* 액션 */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink size={11} />
            YouTube
          </a>
          <button
            type="button"
            onClick={toggleSummary}
            disabled={!geminiAvailable && !aiSummary}
            title={!geminiAvailable ? "Gemini API 키 미설정" : ""}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
              expanded === "summary"
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "border-gray-200 text-gray-700 hover:bg-gray-50",
              !geminiAvailable && !aiSummary && "opacity-40 cursor-not-allowed",
            )}
          >
            {summarizing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            요약
          </button>
          <button
            type="button"
            onClick={toggleRelated}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
              expanded === "related"
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-700 hover:bg-gray-50",
            )}
          >
            {loadingRelated ? <Loader2 size={11} className="animate-spin" /> : <Link2 size={11} />}
            유사
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={blocked}
            title={existsInAish && !published ? "AISH에 이미 등록된 영상" : ""}
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
              published
                ? "bg-emerald-100 text-emerald-700 cursor-default"
                : existsInAish
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-primary-600 text-white hover:bg-primary-700",
            )}
          >
            <Plus size={11} />
            {published ? "발행됨" : existsInAish ? "있음" : "발행"}
          </button>
        </div>
      </div>

      {/* 펼침 영역 */}
      {expanded === "summary" && (
        <div className="border-t border-gray-100 bg-purple-50/40 px-3 py-3 text-xs">
          {summarizing && !aiSummary ? (
            <div className="flex items-center gap-1.5 text-gray-500">
              <Loader2 size={12} className="animate-spin" /> AI 요약 생성 중...
            </div>
          ) : aiSummary ? (
            <div className="space-y-2">
              <p className="leading-relaxed text-gray-700 whitespace-pre-wrap">{aiSummary.summary}</p>
              {aiSummary.recommendedTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {aiSummary.recommendedTags.map((t) => (
                    <span key={t} className="rounded-full bg-white border border-purple-200 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              <p className="pt-1 text-[10px] text-gray-400">발행 모달 열면 자동 채워집니다.</p>
            </div>
          ) : (
            <p className="text-gray-400">결과 없음</p>
          )}
        </div>
      )}

      {expanded === "related" && (
        <div className="border-t border-gray-100 bg-blue-50/40 px-3 py-3 text-xs space-y-3">
          {loadingRelated && !related ? (
            <div className="flex items-center gap-1.5 text-gray-500">
              <Loader2 size={12} className="animate-spin" /> 유사 자료 검색 중...
            </div>
          ) : related ? (
            <>
              <div>
                <h4 className="mb-1.5 font-semibold text-gray-700">같은 채널의 다른 영상</h4>
                {related.channelVideos.length === 0 ? (
                  <p className="text-gray-400">없음</p>
                ) : (
                  <ul className="space-y-1.5">
                    {related.channelVideos.map((v) => (
                      <li key={v.videoId}>
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-md p-1 hover:bg-white"
                        >
                          {v.thumbnailUrl && (
                            <img src={v.thumbnailUrl} alt="" className="h-9 w-16 shrink-0 rounded object-cover" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-[11px] font-medium text-gray-800">{v.title}</span>
                            <span className="text-[10px] text-gray-400">{compactNumber(v.viewCount)} · {formatDurationLabel(v.durationSeconds)}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="mb-1.5 font-semibold text-gray-700">AISH의 비슷한 자료</h4>
                {related.internalContents.length === 0 ? (
                  <p className="text-gray-400">없음</p>
                ) : (
                  <ul className="space-y-1">
                    {related.internalContents.map((c) => {
                      const path = c.group === "community" ? "/community" : "/media";
                      return (
                        <li key={c.id}>
                          <a
                            href={`${path}?id=${c.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-md p-1 text-[11px] text-gray-700 hover:bg-white"
                          >
                            <span className="line-clamp-1">{c.title}</span>
                            <span className="text-[10px] text-gray-400">{c.boardKey}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-gray-400">결과 없음</p>
          )}
        </div>
      )}
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
