/**
 * AI 콘텐츠 자동 수집 엔진
 * 5개 소스(YouTube, GitHub, Reddit, X.com, Instagram)에서 AI 관련 콘텐츠를 수집한다.
 * 브라우저(즉시 수집)와 서버(GitHub Actions 크론) 양쪽에서 동작하도록 fetch 기반.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type ContentSource = "youtube" | "github" | "reddit" | "xcom" | "instagram" | "hackernews" | "devto";

export interface RawCollectedItem {
  source: ContentSource;
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  thumbnailUrl?: string;
}

export interface CollectOptions {
  youtubeApiKey?: string;
  maxPerSource?: number;
  youtubeKeywords?: string;
  githubKeywords?: string;
  redditSubreddits?: string[];
}

export interface CollectResult {
  items: RawCollectedItem[];
  sourceResults: Record<ContentSource, { count: number; error?: string }>;
}

function sevenDaysAgoISO(): string {
  return new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
}

function withTimeout(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

// ── YouTube Data API v3 ──

const DEFAULT_YT_KEYWORDS = "AI OR 인공지능 OR LLM OR 머신러닝 OR GPT";

export async function fetchYouTubeAI(
  apiKey: string,
  maxResults = 5,
  keywords?: string,
): Promise<RawCollectedItem[]> {
  if (!apiKey) return [];

  const publishedAfter = sevenDaysAgoISO();
  const params = new URLSearchParams({
    part: "snippet",
    q: keywords || DEFAULT_YT_KEYWORDS,
    type: "video",
    order: "date",
    relevanceLanguage: "ko",
    publishedAfter,
    maxResults: String(maxResults),
    key: apiKey,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
    { signal: withTimeout(10_000) },
  );
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);

  const data = await res.json();
  return (data.items ?? [])
    .filter((item: Record<string, Record<string, string>>) => item.id?.videoId)
    .map((item: Record<string, Record<string, unknown>>) => ({
      source: "youtube" as const,
      title: String(item.snippet?.title ?? ""),
      url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
      description: String(item.snippet?.description ?? ""),
      publishedAt: String(item.snippet?.publishedAt ?? ""),
      thumbnailUrl: String(
        (item.snippet?.thumbnails as Record<string, Record<string, string>>)
          ?.medium?.url ?? "",
      ),
    }));
}

// ── GitHub Search API ──

const DEFAULT_GH_KEYWORDS = 'AI OR LLM OR "machine learning" OR "deep learning"';

export async function fetchGitHubAI(maxResults = 5, keywords?: string): Promise<RawCollectedItem[]> {
  const since = sevenDaysAgoISO().split("T")[0];
  const q = encodeURIComponent(
    `${keywords || DEFAULT_GH_KEYWORDS} pushed:>${since} stars:>10`,
  );

  const res = await fetch(
    `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${maxResults}`,
    {
      headers: { Accept: "application/vnd.github.v3+json" },
      signal: withTimeout(10_000),
    },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);

  const data = await res.json();
  return (data.items ?? []).map(
    (item: Record<string, string>) => ({
      source: "github" as const,
      title: item.full_name,
      url: item.html_url,
      description: (item.description || "").slice(0, 500),
      publishedAt: item.pushed_at || item.updated_at,
    }),
  );
}

// ── Reddit JSON API ──

const DEFAULT_SUBREDDITS = ["artificial", "MachineLearning", "LocalLLaMA"];
const REDDIT_USER_AGENT = "aish-content-collector/1.0 (+https://www.aish.co.kr)";

export async function fetchRedditAI(maxResults = 5, subredditOverrides?: string[]): Promise<RawCollectedItem[]> {
  const subreddits = subredditOverrides?.length ? subredditOverrides : DEFAULT_SUBREDDITS;
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const all: RawCollectedItem[] = [];

  for (const sub of subreddits) {
    if (all.length >= maxResults) break;
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=${maxResults}&raw_json=1`,
        // reddit은 명시적 User-Agent가 없으면 데이터센터 IP 요청을 403/429로 차단한다.
        { signal: withTimeout(8_000), headers: { "User-Agent": REDDIT_USER_AGENT } },
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const post of data.data?.children ?? []) {
        const d = post.data;
        if (!d || d.stickied) continue;
        if (d.created_utc * 1000 < cutoff) continue;
        all.push({
          source: "reddit",
          title: d.title,
          url: `https://www.reddit.com${d.permalink}`,
          description: (d.selftext || "").slice(0, 500),
          publishedAt: new Date(d.created_utc * 1000).toISOString(),
          thumbnailUrl: d.thumbnail?.startsWith("http") ? d.thumbnail : undefined,
        });
      }
    } catch {
      /* Reddit CORS 실패 시 무시 */
    }
  }
  return all.slice(0, maxResults);
}

// ── X.com via Nitter RSS (불안정) ──

export async function fetchXcomAI(maxResults = 5): Promise<RawCollectedItem[]> {
  const nitterHosts = [
    "nitter.privacydev.net",
    "nitter.poast.org",
  ];
  const searches = ["AI", "LLM"];
  const cutoff = Date.now() - SEVEN_DAYS_MS;

  for (const host of nitterHosts) {
    for (const term of searches) {
      try {
        const res = await fetch(
          `https://${host}/search/rss?f=tweets&q=${encodeURIComponent(term)}`,
          { signal: withTimeout(5_000) },
        );
        if (!res.ok) continue;
        const xml = await res.text();
        const items = parseRssItems(xml, cutoff, maxResults);
        if (items.length > 0) {
          return items.map((i) => ({
            ...i,
            source: "xcom" as const,
            url: i.url.replace(/nitter\.[^/]+/, "x.com"),
          }));
        }
      } catch {
        continue;
      }
    }
  }
  return [];
}

// ── Hacker News via Algolia API (무료·무키, CORS·데이터센터 IP 허용) ──
// reddit이 클라우드 IP를 차단하는 환경(GitHub Actions)에서 커뮤니티 소스로 사용.

const HN_QUERIES = ["AI", "LLM", "machine learning", "ChatGPT", "Claude", "OpenAI", "AI agent", "Gemini"];
const HN_MIN_POINTS = 10;

export async function fetchHackerNewsAI(maxResults = 5): Promise<RawCollectedItem[]> {
  const cutoffSec = Math.floor((Date.now() - SEVEN_DAYS_MS) / 1000);
  const all: RawCollectedItem[] = [];
  const seen = new Set<string>();

  for (const query of HN_QUERIES) {
    if (all.length >= maxResults) break;
    try {
      const res = await fetch(
        `https://hn.algolia.com/api/v1/search?tags=story&query=${encodeURIComponent(query)}` +
          `&numericFilters=created_at_i>${cutoffSec},points>${HN_MIN_POINTS}&hitsPerPage=${maxResults}`,
        { signal: withTimeout(8_000) },
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const hit of data.hits ?? []) {
        if (!hit?.title || seen.has(hit.objectID)) continue;
        seen.add(hit.objectID);
        all.push({
          source: "hackernews",
          title: hit.title,
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          description: (hit.story_text || "").slice(0, 500),
          publishedAt: new Date((hit.created_at_i ?? cutoffSec) * 1000).toISOString(),
        });
      }
    } catch {
      /* HN API 실패 시 무시 */
    }
  }
  return all.slice(0, maxResults);
}

// ── dev.to via 공개 API (무료·무키, CI·CORS 허용) ──
// 커뮤니티 소스 보강용 — reddit 차단 환경에서도 안정적인 개발자 아티클 피드.

const DEVTO_TAGS = ["ai", "machinelearning", "llm"];

interface DevToArticle {
  title?: string;
  url?: string;
  description?: string;
  published_at?: string;
  cover_image?: string | null;
  social_image?: string | null;
}

export async function fetchDevToAI(maxResults = 5): Promise<RawCollectedItem[]> {
  const all: RawCollectedItem[] = [];
  const seen = new Set<string>();

  for (const tag of DEVTO_TAGS) {
    if (all.length >= maxResults) break;
    try {
      const res = await fetch(
        `https://dev.to/api/articles?tag=${tag}&top=7&per_page=${maxResults}`,
        { signal: withTimeout(8_000) },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as DevToArticle[];
      for (const a of Array.isArray(data) ? data : []) {
        if (!a?.title || !a?.url || seen.has(a.url)) continue;
        seen.add(a.url);
        all.push({
          source: "devto",
          title: a.title,
          url: a.url,
          description: (a.description || "").slice(0, 500),
          publishedAt: a.published_at || new Date().toISOString(),
          thumbnailUrl: a.cover_image || a.social_image || undefined,
        });
      }
    } catch {
      /* dev.to API 실패 시 무시 */
    }
  }
  return all.slice(0, maxResults);
}

function parseRssItems(
  xml: string,
  cutoff: number,
  max: number,
): Omit<RawCollectedItem, "source">[] {
  const items: Omit<RawCollectedItem, "source">[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) && items.length < max) {
    const c = match[1];
    const title =
      c.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
      c.match(/<title>(.*?)<\/title>/)?.[1] ??
      "";
    const link = c.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
    const desc =
      c.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ??
      c.match(/<description>(.*?)<\/description>/)?.[1] ??
      "";
    const pubDate = c.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";

    const date = new Date(pubDate);
    if (isNaN(date.getTime()) || date.getTime() < cutoff) continue;

    items.push({
      title: title.replace(/<[^>]+>/g, "").trim(),
      url: link,
      description: desc.replace(/<[^>]+>/g, "").trim().slice(0, 500),
      publishedAt: date.toISOString(),
    });
  }
  return items;
}

// ── Instagram 해시태그 스크래핑 (불안정) ──

export async function fetchInstagramAI(
  maxResults = 5,
): Promise<RawCollectedItem[]> {
  try {
    const res = await fetch(
      `https://www.instagram.com/explore/tags/artificialintelligence/?__a=1&__d=dis`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: withTimeout(5_000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();

    const edges =
      data?.graphql?.hashtag?.edge_hashtag_to_media?.edges ?? [];
    return edges.slice(0, maxResults).map(
      (edge: {
        node?: {
          shortcode?: string;
          taken_at_timestamp?: number;
          thumbnail_src?: string;
          edge_media_to_caption?: {
            edges?: { node?: { text?: string } }[];
          };
        };
      }) => {
        const n = edge.node ?? {};
        const caption =
          n.edge_media_to_caption?.edges?.[0]?.node?.text ?? "";
        return {
          source: "instagram" as const,
          title: caption.slice(0, 100) || "Instagram AI Post",
          url: `https://www.instagram.com/p/${n.shortcode ?? ""}/`,
          description: caption.slice(0, 500),
          publishedAt: new Date(
            (n.taken_at_timestamp ?? 0) * 1000,
          ).toISOString(),
          thumbnailUrl: n.thumbnail_src,
        };
      },
    );
  } catch {
    return [];
  }
}

// ── 전체 소스 통합 수집 ──

export async function collectAll(
  options: CollectOptions = {},
): Promise<CollectResult> {
  const max = options.maxPerSource ?? 3;
  const sourceResults: CollectResult["sourceResults"] = {
    youtube: { count: 0 },
    github: { count: 0 },
    reddit: { count: 0 },
    xcom: { count: 0 },
    instagram: { count: 0 },
    hackernews: { count: 0 },
    devto: { count: 0 },
  };

  const fetchers: [ContentSource, Promise<RawCollectedItem[]>][] = [
    ["youtube", fetchYouTubeAI(options.youtubeApiKey ?? "", max, options.youtubeKeywords)],
    ["github", fetchGitHubAI(max, options.githubKeywords)],
    ["reddit", fetchRedditAI(max, options.redditSubreddits)],
    ["xcom", fetchXcomAI(max)],
    ["instagram", fetchInstagramAI(max)],
    ["hackernews", fetchHackerNewsAI(max)],
    ["devto", fetchDevToAI(max)],
  ];

  const results = await Promise.allSettled(fetchers.map(([, p]) => p));
  const all: RawCollectedItem[] = [];

  results.forEach((r, i) => {
    const [source] = fetchers[i];
    if (r.status === "fulfilled") {
      sourceResults[source] = { count: r.value.length };
      all.push(...r.value);
    } else {
      sourceResults[source] = {
        count: 0,
        error: r.reason?.message ?? "Unknown error",
      };
    }
  });

  all.sort(
    (a, b) =>
      new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );

  return { items: all, sourceResults };
}

// ── 카테고리별 수집 (B 안: 영상·게시판글·교육자료 분리) ──

/**
 * 카테고리에 매핑된 소스만 fetch. CATEGORY_SOURCES에 정의된 소스 외에는 실행 안 함.
 * - video    → youtube
 * - article  → reddit, xcom
 * - resource → github
 *
 * 결과의 sourceResults는 5소스 키를 모두 포함하지만 비활성 소스는 count=0으로 표시.
 */
export async function collectByCategory(
  category: import("./ai-content-categories").AiCategory,
  options: CollectOptions = {},
): Promise<CollectResult> {
  const { CATEGORY_SOURCES } = await import("./ai-content-categories");
  const enabledSources = new Set<ContentSource>(CATEGORY_SOURCES[category]);
  const max = options.maxPerSource ?? 5;

  const sourceResults: CollectResult["sourceResults"] = {
    youtube: { count: 0 },
    github: { count: 0 },
    reddit: { count: 0 },
    xcom: { count: 0 },
    instagram: { count: 0 },
    hackernews: { count: 0 },
    devto: { count: 0 },
  };

  const fetchers: [ContentSource, () => Promise<RawCollectedItem[]>][] = [
    ["youtube", () => fetchYouTubeAI(options.youtubeApiKey ?? "", max, options.youtubeKeywords)],
    ["github", () => fetchGitHubAI(max, options.githubKeywords)],
    ["reddit", () => fetchRedditAI(max, options.redditSubreddits)],
    ["xcom", () => fetchXcomAI(max)],
    ["instagram", () => fetchInstagramAI(max)],
    ["hackernews", () => fetchHackerNewsAI(max)],
    ["devto", () => fetchDevToAI(max)],
  ];

  const activeFetchers = fetchers.filter(([source]) => enabledSources.has(source));
  const results = await Promise.allSettled(activeFetchers.map(([, fn]) => fn()));
  const all: RawCollectedItem[] = [];

  results.forEach((r, i) => {
    const [source] = activeFetchers[i];
    if (r.status === "fulfilled") {
      sourceResults[source] = { count: r.value.length };
      all.push(...r.value);
    } else {
      sourceResults[source] = {
        count: 0,
        error: (r.reason as { message?: string })?.message ?? "Unknown error",
      };
    }
  });

  all.sort(
    (a, b) =>
      new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );

  return { items: all, sourceResults };
}
