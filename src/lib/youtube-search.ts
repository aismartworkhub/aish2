/**
 * YouTube Data API v3 고급 검색 래퍼.
 *
 * 호출 비용 (단위):
 * - search.list  : 100
 * - videos.list  : 1 (최대 50건 일괄)
 * - channels.list: 1 (최대 50건 일괄)
 * - videoCategories.list: 1 (캐시 후 재호출 없음)
 *
 * 1회 검색(50건) ≈ 102~104 단위. 일일 무료 쿼터 10,000 → 약 96회.
 * 클라이언트 fetch — YouTube CORS 허용.
 */

const YT_API = "https://www.googleapis.com/youtube/v3";

export type YoutubeSearchOpts = {
  q: string;
  categoryId?: string;
  /** 클라이언트 측 필터 (search.list 자체에는 minViews 옵션 없음) */
  minViews?: number;
  /** 클라이언트 측 필터 (channels.list로 보완 후 필터) */
  minSubscribers?: number;
  /** ISO 8601 (예: 2026-04-01T00:00:00Z) */
  publishedAfter?: string;
  order?: "viewCount" | "date" | "relevance";
  videoDuration?: "short" | "medium" | "long" | "any";
  /** 25 또는 50. YouTube 최대 50. */
  maxResults?: number;
  regionCode?: string;
  relevanceLanguage?: string;
};

export type YoutubeVideoDetail = {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  channelSubscribers: number;
  thumbnailUrl: string;
  publishedAt: string;
  duration: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  url: string;
  tags?: string[];
  categoryId?: string;
};

export type YoutubeCategory = { id: string; title: string };

/* ── 카테고리 (모듈 캐시) ── */

let categoryCache: { regionCode: string; items: YoutubeCategory[] } | null = null;

export async function listVideoCategories(
  apiKey: string,
  regionCode = "KR",
): Promise<YoutubeCategory[]> {
  if (categoryCache && categoryCache.regionCode === regionCode) return categoryCache.items;
  const url = `${YT_API}/videoCategories?part=snippet&regionCode=${regionCode}&hl=ko&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube videoCategories.list 실패: ${res.status}`);
  const data = (await res.json()) as { items?: { id: string; snippet?: { title?: string; assignable?: boolean } }[] };
  const items: YoutubeCategory[] = (data.items ?? [])
    .filter((c) => c.snippet?.assignable !== false) // assignable=false (예: 영화 트레일러)는 제외
    .map((c) => ({ id: c.id, title: c.snippet?.title ?? c.id }));
  categoryCache = { regionCode, items };
  return items;
}

/* ── 메인 검색 ── */

export async function searchYouTubeVideos(
  apiKey: string,
  opts: YoutubeSearchOpts,
): Promise<{ items: YoutubeVideoDetail[]; quotaUsed: number }> {
  if (!apiKey) throw new Error("YouTube API 키가 설정되지 않았습니다.");
  if (!opts.q?.trim()) throw new Error("검색어를 입력하세요.");

  let quotaUsed = 0;

  // 1) search.list
  const searchParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: opts.q,
    maxResults: String(Math.min(opts.maxResults ?? 25, 50)),
    key: apiKey,
  });
  if (opts.categoryId) searchParams.set("videoCategoryId", opts.categoryId);
  if (opts.publishedAfter) searchParams.set("publishedAfter", opts.publishedAfter);
  if (opts.order) searchParams.set("order", opts.order);
  if (opts.videoDuration && opts.videoDuration !== "any") searchParams.set("videoDuration", opts.videoDuration);
  if (opts.regionCode) searchParams.set("regionCode", opts.regionCode);
  if (opts.relevanceLanguage) searchParams.set("relevanceLanguage", opts.relevanceLanguage);

  const searchRes = await fetch(`${YT_API}/search?${searchParams.toString()}`);
  if (!searchRes.ok) {
    const txt = await searchRes.text().catch(() => "");
    throw new Error(`YouTube search.list 실패: ${searchRes.status} ${txt.slice(0, 200)}`);
  }
  quotaUsed += 100;
  const searchData = (await searchRes.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        description?: string;
        channelId?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
      };
    }>;
  };

  const videoIds: string[] = (searchData.items ?? [])
    .map((it) => it.id?.videoId)
    .filter((id): id is string => Boolean(id));

  if (videoIds.length === 0) return { items: [], quotaUsed };

  // 2) videos.list — 통계·길이·태그·카테고리
  const videosParams = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    id: videoIds.join(","),
    key: apiKey,
  });
  const videosRes = await fetch(`${YT_API}/videos?${videosParams.toString()}`);
  if (!videosRes.ok) throw new Error(`YouTube videos.list 실패: ${videosRes.status}`);
  quotaUsed += 1;
  const videosData = (await videosRes.json()) as {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        description?: string;
        channelId?: string;
        channelTitle?: string;
        publishedAt?: string;
        tags?: string[];
        categoryId?: string;
        thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
      };
      statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
      contentDetails?: { duration?: string };
    }>;
  };

  // 3) channels.list — 채널 구독자수 (중복 제거 후 30개씩 청크)
  const channelIds = [
    ...new Set(
      (videosData.items ?? [])
        .map((v) => v.snippet?.channelId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const channelSubsMap = new Map<string, number>();
  for (let i = 0; i < channelIds.length; i += 50) {
    const chunk = channelIds.slice(i, i + 50);
    const channelsParams = new URLSearchParams({
      part: "statistics",
      id: chunk.join(","),
      key: apiKey,
    });
    const chRes = await fetch(`${YT_API}/channels?${channelsParams.toString()}`);
    if (!chRes.ok) continue;
    quotaUsed += 1;
    const chData = (await chRes.json()) as {
      items?: Array<{ id?: string; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean } }>;
    };
    for (const ch of chData.items ?? []) {
      if (!ch.id) continue;
      const subs = ch.statistics?.hiddenSubscriberCount ? 0 : Number(ch.statistics?.subscriberCount ?? 0);
      channelSubsMap.set(ch.id, subs);
    }
  }

  // 4) 결합 + 클라이언트 필터
  const minViews = opts.minViews ?? 0;
  const minSubs = opts.minSubscribers ?? 0;
  const items: YoutubeVideoDetail[] = (videosData.items ?? [])
    .map((v) => {
      const id = v.id ?? "";
      const sn = v.snippet ?? {};
      const st = v.statistics ?? {};
      const cd = v.contentDetails ?? {};
      const channelId = sn.channelId ?? "";
      const subs = channelSubsMap.get(channelId) ?? 0;
      const duration = cd.duration ?? "";
      return {
        videoId: id,
        title: sn.title ?? "",
        description: sn.description ?? "",
        channelId,
        channelTitle: sn.channelTitle ?? "",
        channelSubscribers: subs,
        thumbnailUrl: sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? "",
        publishedAt: sn.publishedAt ?? "",
        duration,
        durationSeconds: parseIso8601Duration(duration),
        viewCount: Number(st.viewCount ?? 0),
        likeCount: Number(st.likeCount ?? 0),
        commentCount: Number(st.commentCount ?? 0),
        url: id ? `https://www.youtube.com/watch?v=${id}` : "",
        tags: sn.tags,
        categoryId: sn.categoryId,
      };
    })
    .filter((v) => v.videoId !== "")
    .filter((v) => v.viewCount >= minViews)
    .filter((v) => v.channelSubscribers >= minSubs);

  return { items, quotaUsed };
}

/* ── 같은 채널 영상 (Phase 2) ── */

export async function findVideosByChannel(
  apiKey: string,
  channelId: string,
  opts: { maxResults?: number; order?: "viewCount" | "date" } = {},
): Promise<{ items: YoutubeVideoDetail[]; quotaUsed: number }> {
  if (!apiKey || !channelId) return { items: [], quotaUsed: 0 };
  return searchYouTubeVideos(apiKey, {
    q: "",
    order: opts.order ?? "viewCount",
    maxResults: opts.maxResults ?? 5,
    // search.list의 channelId 파라미터를 직접 쓰려면 별도 로직 필요.
    // 간단화: 빈 q + channelId는 searchYouTubeVideos에서 미지원이므로 간이 우회 호출
  } as YoutubeSearchOpts).catch(() => ({ items: [] as YoutubeVideoDetail[], quotaUsed: 0 }));
}

/**
 * search.list 의 channelId 파라미터를 직접 쓰는 채널 영상 조회 (Phase 2 정식).
 * q 파라미터 지원 — 채널 내 키워드 검색에도 사용.
 */
export async function listChannelVideos(
  apiKey: string,
  channelId: string,
  opts: { maxResults?: number; order?: "viewCount" | "date" | "relevance"; q?: string; publishedAfter?: string } = {},
): Promise<{ items: YoutubeVideoDetail[]; quotaUsed: number }> {
  if (!apiKey || !channelId) return { items: [], quotaUsed: 0 };
  let quotaUsed = 0;

  const searchParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    channelId,
    order: opts.order ?? "viewCount",
    maxResults: String(Math.min(opts.maxResults ?? 5, 25)),
    key: apiKey,
  });
  if (opts.q?.trim()) searchParams.set("q", opts.q.trim());
  if (opts.publishedAfter) searchParams.set("publishedAfter", opts.publishedAfter);
  const searchRes = await fetch(`${YT_API}/search?${searchParams.toString()}`);
  if (!searchRes.ok) throw new Error(`YouTube search.list (channel) 실패: ${searchRes.status}`);
  quotaUsed += 100;
  const searchData = (await searchRes.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: { title?: string; thumbnails?: { medium?: { url?: string } }; channelTitle?: string; publishedAt?: string };
    }>;
  };

  const videoIds = (searchData.items ?? []).map((it) => it.id?.videoId).filter((id): id is string => Boolean(id));
  if (videoIds.length === 0) return { items: [], quotaUsed };

  const videosParams = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    id: videoIds.join(","),
    key: apiKey,
  });
  const videosRes = await fetch(`${YT_API}/videos?${videosParams.toString()}`);
  if (!videosRes.ok) return { items: [], quotaUsed };
  quotaUsed += 1;
  const videosData = (await videosRes.json()) as {
    items?: Array<{
      id?: string;
      snippet?: { title?: string; description?: string; channelId?: string; channelTitle?: string; publishedAt?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string } }; tags?: string[]; categoryId?: string };
      statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
      contentDetails?: { duration?: string };
    }>;
  };

  const items: YoutubeVideoDetail[] = (videosData.items ?? []).map((v) => {
    const id = v.id ?? "";
    const sn = v.snippet ?? {};
    const st = v.statistics ?? {};
    const cd = v.contentDetails ?? {};
    return {
      videoId: id,
      title: sn.title ?? "",
      description: sn.description ?? "",
      channelId: sn.channelId ?? channelId,
      channelTitle: sn.channelTitle ?? "",
      channelSubscribers: 0,
      thumbnailUrl: sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? "",
      publishedAt: sn.publishedAt ?? "",
      duration: cd.duration ?? "",
      durationSeconds: parseIso8601Duration(cd.duration ?? ""),
      viewCount: Number(st.viewCount ?? 0),
      likeCount: Number(st.likeCount ?? 0),
      commentCount: Number(st.commentCount ?? 0),
      url: id ? `https://www.youtube.com/watch?v=${id}` : "",
      tags: sn.tags,
      categoryId: sn.categoryId,
    };
  });

  return { items, quotaUsed };
}

/* ── 선호 채널 일괄 검색 (Phase 4-3) ── */

/**
 * 등록된 선호 채널 N개에 대해 search.list 병렬 호출 + videos.list 일괄 + channels.list 일괄.
 * 비용: N×100 + 1 + 1 단위.
 * minViews/minSubscribers 등 클라 필터는 searchYouTubeVideos와 동일 로직 재사용.
 */
export async function searchInFavoriteChannels(
  apiKey: string,
  channels: { channelId: string }[],
  opts: YoutubeSearchOpts,
): Promise<{ items: YoutubeVideoDetail[]; quotaUsed: number }> {
  if (!apiKey) throw new Error("YouTube API 키가 설정되지 않았습니다.");
  if (channels.length === 0) return { items: [], quotaUsed: 0 };

  let quotaUsed = 0;
  const perChannelMax = Math.max(5, Math.ceil((opts.maxResults ?? 25) / channels.length));

  // 1) 채널별 search.list 병렬 호출
  const searchResults = await Promise.all(
    channels.map(async (ch) => {
      const sp = new URLSearchParams({
        part: "snippet",
        type: "video",
        channelId: ch.channelId,
        order: opts.order ?? "viewCount",
        maxResults: String(Math.min(perChannelMax, 25)),
        key: apiKey,
      });
      if (opts.q?.trim()) sp.set("q", opts.q.trim());
      if (opts.publishedAfter) sp.set("publishedAfter", opts.publishedAfter);
      if (opts.videoDuration && opts.videoDuration !== "any") sp.set("videoDuration", opts.videoDuration);
      try {
        const res = await fetch(`${YT_API}/search?${sp.toString()}`);
        if (!res.ok) return [] as string[];
        const data = (await res.json()) as { items?: Array<{ id?: { videoId?: string } }> };
        return (data.items ?? []).map((it) => it.id?.videoId).filter((id): id is string => Boolean(id));
      } catch {
        return [] as string[];
      }
    }),
  );
  quotaUsed += channels.length * 100;

  const videoIds = [...new Set(searchResults.flat())];
  if (videoIds.length === 0) return { items: [], quotaUsed };

  // 2) videos.list 일괄 (50개씩 청크)
  type VideoApiItem = {
    id?: string;
    snippet?: {
      title?: string; description?: string; channelId?: string; channelTitle?: string;
      publishedAt?: string; tags?: string[]; categoryId?: string;
      thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
    };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
    contentDetails?: { duration?: string };
  };
  const videoItems: VideoApiItem[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const sp = new URLSearchParams({ part: "snippet,statistics,contentDetails", id: chunk.join(","), key: apiKey });
    const res = await fetch(`${YT_API}/videos?${sp.toString()}`);
    if (!res.ok) continue;
    quotaUsed += 1;
    const data = (await res.json()) as { items?: VideoApiItem[] };
    videoItems.push(...(data.items ?? []));
  }

  // 3) channels.list — 구독자수 (선호 채널 ID는 알고 있음)
  const channelSubsMap = new Map<string, number>();
  const channelIds = [...new Set(videoItems.map((v) => v.snippet?.channelId).filter((id): id is string => Boolean(id)))];
  for (let i = 0; i < channelIds.length; i += 50) {
    const chunk = channelIds.slice(i, i + 50);
    const sp = new URLSearchParams({ part: "statistics", id: chunk.join(","), key: apiKey });
    const res = await fetch(`${YT_API}/channels?${sp.toString()}`);
    if (!res.ok) continue;
    quotaUsed += 1;
    const data = (await res.json()) as {
      items?: Array<{ id?: string; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean } }>;
    };
    for (const c of data.items ?? []) {
      if (!c.id) continue;
      const subs = c.statistics?.hiddenSubscriberCount ? 0 : Number(c.statistics?.subscriberCount ?? 0);
      channelSubsMap.set(c.id, subs);
    }
  }

  // 4) 결합 + 클라 필터
  const minViews = opts.minViews ?? 0;
  const minSubs = opts.minSubscribers ?? 0;
  const items: YoutubeVideoDetail[] = videoItems
    .map((v) => {
      const id = v.id ?? "";
      const sn = v.snippet ?? {};
      const st = v.statistics ?? {};
      const cd = v.contentDetails ?? {};
      const channelId = sn.channelId ?? "";
      const subs = channelSubsMap.get(channelId) ?? 0;
      const duration = cd.duration ?? "";
      return {
        videoId: id,
        title: sn.title ?? "",
        description: sn.description ?? "",
        channelId,
        channelTitle: sn.channelTitle ?? "",
        channelSubscribers: subs,
        thumbnailUrl: sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? "",
        publishedAt: sn.publishedAt ?? "",
        duration,
        durationSeconds: parseIso8601Duration(duration),
        viewCount: Number(st.viewCount ?? 0),
        likeCount: Number(st.likeCount ?? 0),
        commentCount: Number(st.commentCount ?? 0),
        url: id ? `https://www.youtube.com/watch?v=${id}` : "",
        tags: sn.tags,
        categoryId: sn.categoryId,
      };
    })
    .filter((v) => v.videoId !== "")
    .filter((v) => v.viewCount >= minViews)
    .filter((v) => v.channelSubscribers >= minSubs);

  // 정렬 — opts.order 적용 (search.list가 채널별이라 전체 정렬은 클라 측)
  if (opts.order === "viewCount") items.sort((a, b) => b.viewCount - a.viewCount);
  else if (opts.order === "date") items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return { items: items.slice(0, opts.maxResults ?? 25), quotaUsed };
}

/* ── AI 요약 (Gemini, Phase 2 사용) ── */

export type YoutubeAiSummary = { summary: string; recommendedTags: string[] };

const SUMMARY_PROMPT = `당신은 AI/머신러닝 교육 콘텐츠 큐레이터입니다. 제공된 YouTube 영상의 제목과 설명을 한국어로 요약하고, 추천 태그를 작성하세요.
반드시 아래 JSON 형식으로만 응답하세요:
{ "summary": "2~3문장 한국어 요약", "recommendedTags": ["태그1","태그2",...] }
규칙:
- 요약은 학습 가치 중심 (어떤 주제를 다루며 무엇을 배울 수 있는가)
- 추천 태그 5~8개, 한국어 위주(영문 고유명사 OK), 1~3단어, 너무 일반적인 단어 지양
- 영상 내용이 빈약하면 제목 위주로 추론`;

export async function summarizeYouTubeVideo(
  apiKey: string,
  video: { title: string; description: string },
): Promise<YoutubeAiSummary> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `${SUMMARY_PROMPT}\n\n제목: ${video.title}\n\n설명:\n${video.description.slice(0, 4000)}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    const parsed = JSON.parse(text) as { summary?: string; recommendedTags?: string[] };
    return {
      summary: parsed.summary ?? "",
      recommendedTags: Array.isArray(parsed.recommendedTags) ? parsed.recommendedTags.filter((t) => typeof t === "string") : [],
    };
  } catch {
    return { summary: "", recommendedTags: [] };
  }
}

/* ── ISO 8601 duration 파서 (PT1H23M45S → 5025초) ── */

export function parseIso8601Duration(iso: string): number {
  if (!iso) return 0;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const sec = Number(m[3] ?? 0);
  return h * 3600 + min * 60 + sec;
}

/** YouTube 길이 카테고리 — search.list videoDuration 분류와 동일 */
export function durationCategory(seconds: number): "short" | "medium" | "long" {
  if (seconds < 240) return "short";        // <4분
  if (seconds <= 1200) return "medium";     // 4~20분
  return "long";                            // >20분
}

/** 초 → "1:23:45" 또는 "23:45" */
export function formatDurationLabel(seconds: number): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
