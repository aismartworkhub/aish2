/**
 * GitHub Actions 크론에서 실행되는 AI 콘텐츠 수집 스크립트
 * Firebase Admin SDK를 사용하여 Firestore에 직접 쓴다.
 * Firestore siteSettings/ai-collector 의 boardConfigs를 읽어 보드별 수량/소스/점수/검토 설정을 반영한다.
 *
 * 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY — Firebase 서비스 계정 JSON (GitHub Secret)
 *   YOUTUBE_API_KEY — YouTube Data API v3 키
 *   GEMINI_API_KEY — Gemini API 키
 *   MAX_ITEMS — 최대 수집 건수 (기본 10)
 *   MIN_QUALITY_SCORE — 최소 품질 점수 (기본 7)
 */

import * as admin from "firebase-admin";

const SA_KEY = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY ?? "";
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const ENV_MAX_ITEMS = Number(process.env.MAX_ITEMS) || 10;
const ENV_MIN_SCORE = Number(process.env.MIN_QUALITY_SCORE) || 7;

// ── Firebase Admin 초기화 ──

if (!SA_KEY) {
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY is required");
  process.exit(1);
}

const serviceAccount = JSON.parse(SA_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const firestore = admin.firestore();

// ── 수집 함수 재사용 (fetch 기반이라 서버에서도 동작) ──

import {
  collectByCategory,
  type RawCollectedItem,
  type ContentSource,
} from "../src/lib/ai-content-collector";
import { curateItems, type CuratedItem } from "../src/lib/ai-content-curator";
import { ALL_CATEGORIES, CATEGORY_BOARD_HINTS, CATEGORY_LABELS, type AiCategory } from "../src/lib/ai-content-categories";

// ── 보드별 설정 타입 ──

interface BoardCollectionConfig {
  boardKey: string;
  label: string;
  enabled: boolean;
  maxItems: number;
  minQualityScore: number;
  sources: ContentSource[];
  requireReview: boolean;
}

interface CategorySettings {
  enabled: boolean;
  autoPublish: boolean;
  maxPerRun: number;
  lastRunAt?: string;
}

interface AiCollectorSettings {
  youtubeApiKey?: string;
  maxItemsPerRun?: number;
  minQualityScore?: number;
  boardConfigs?: BoardCollectionConfig[];
  defaultRequireReview?: boolean;
  categorySettings?: Partial<Record<AiCategory, CategorySettings>>;
}

const DEFAULT_BOARD_CONFIGS: BoardCollectionConfig[] = [
  { boardKey: "media-lecture", label: "강의 영상", enabled: true, maxItems: 5, minQualityScore: 7, sources: ["youtube"], requireReview: false },
  { boardKey: "media-resource", label: "자료실", enabled: true, maxItems: 5, minQualityScore: 7, sources: ["github", "reddit"], requireReview: false },
];

const DEFAULT_CATEGORY_SETTINGS: Record<AiCategory, CategorySettings> = {
  video: { enabled: true, autoPublish: false, maxPerRun: 5 },
  article: { enabled: true, autoPublish: false, maxPerRun: 5 },
  resource: { enabled: true, autoPublish: false, maxPerRun: 5 },
};

// ── Firestore에서 설정 로드 ──

async function loadSettings(): Promise<{
  maxItems: number;
  minScore: number;
  boardConfigs: BoardCollectionConfig[];
  defaultRequireReview: boolean;
  youtubeKey: string;
  categorySettings: Partial<Record<AiCategory, CategorySettings>>;
}> {
  try {
    const doc = await firestore.doc("siteSettings/ai-collector").get();
    const data = doc.data() as AiCollectorSettings | undefined;
    if (data) {
      return {
        maxItems: data.maxItemsPerRun ?? ENV_MAX_ITEMS,
        minScore: data.minQualityScore ?? ENV_MIN_SCORE,
        boardConfigs: data.boardConfigs?.length ? data.boardConfigs : DEFAULT_BOARD_CONFIGS,
        defaultRequireReview: data.defaultRequireReview ?? false,
        youtubeKey: data.youtubeApiKey || YOUTUBE_KEY,
        categorySettings: data.categorySettings ?? {},
      };
    }
  } catch (e) {
    console.warn("[Settings] Failed to load, using defaults:", e);
  }
  return {
    maxItems: ENV_MAX_ITEMS,
    minScore: ENV_MIN_SCORE,
    boardConfigs: DEFAULT_BOARD_CONFIGS,
    defaultRequireReview: false,
    youtubeKey: YOUTUBE_KEY,
    categorySettings: {},
  };
}

function resolveCategorySettings(
  fromConfig: Partial<Record<AiCategory, CategorySettings>>,
  cat: AiCategory,
): CategorySettings {
  return fromConfig[cat] ?? DEFAULT_CATEGORY_SETTINGS[cat];
}

// ── 중복 확인 (Admin SDK 버전) ──

async function getExistingUrlsAdmin(): Promise<Set<string>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const snap = await firestore
    .collection("contents")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(sevenDaysAgo))
    .get();

  const urls = new Set<string>();
  snap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.mediaUrl) urls.add(normalizeUrl(data.mediaUrl));
  });
  return urls;
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.hostname = u.hostname.replace(/^www\./, "");
    if (u.hostname.includes("youtube.com") || u.hostname === "youtu.be") {
      const vid =
        u.searchParams.get("v") ||
        (u.hostname === "youtu.be" ? u.pathname.slice(1) : null);
      if (vid) return `yt:${vid}`;
    }
    if (u.hostname === "github.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) return `gh:${parts[0]}/${parts[1]}`;
    }
    return `${u.hostname}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return url.toLowerCase().trim();
  }
}

// ── 메인 ──

/**
 * 단일 카테고리 수집 1 cycle.
 * collectByCategory + curateItems(boardHints) → Firestore 삽입 → 카테고리 단위
 * aiCollectorHistory 기록.
 */
async function runCategory(
  category: AiCategory,
  ctx: {
    youtubeKey: string;
    minScore: number;
    boardConfigs: BoardCollectionConfig[];
    enabledBoards: BoardCollectionConfig[];
    enabledBoardKeys: Set<string>;
    defaultRequireReview: boolean;
    existingUrls: Set<string>;
    categorySettings: Partial<Record<AiCategory, CategorySettings>>;
  },
): Promise<{ collected: number; unique: number; curated: number; inserted: number; skipped: number; boardBreakdown: Record<string, number> }> {
  const catLabel = CATEGORY_LABELS[category];
  const cs = resolveCategorySettings(ctx.categorySettings, category);
  const startTime = Date.now();
  const hints = CATEGORY_BOARD_HINTS[category];
  const categoryBoardKeys = new Set(hints.map((h) => h.boardKey));

  console.log(`\n[${catLabel}] 수집 시작 (maxPerRun=${cs.maxPerRun}, autoPublish=${cs.autoPublish})`);
  const { items, sourceResults } = await collectByCategory(category, {
    youtubeApiKey: ctx.youtubeKey,
    maxPerSource: cs.maxPerRun,
  });
  console.log(`[${catLabel}] ${items.length}건 수집:`, Object.fromEntries(
    Object.entries(sourceResults).filter(([, r]) => r.count > 0).map(([s, r]) => [s, r.count]),
  ));

  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const url = normalizeUrl(item.url);
    if (!url || ctx.existingUrls.has(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
  if (unique.length === 0) {
    console.log(`[${catLabel}] 신규 0건 — skip`);
    await saveCategoryRun(category, startTime, items.length, 0, 0, 0, 0, {});
    return { collected: items.length, unique: 0, curated: 0, inserted: 0, skipped: 0, boardBreakdown: {} };
  }
  console.log(`[${catLabel}] 신규 ${unique.length}건. Gemini 큐레이션...`);

  // Gemini 큐레이션 — 카테고리별 boardHints 전달 (Phase 1 합의)
  let curated: CuratedItem[];
  if (GEMINI_KEY) {
    curated = await curateItems(unique, GEMINI_KEY, ctx.minScore, hints);
  } else {
    console.log(`[${catLabel}] Gemini 키 없음 — fallback`);
    curated = unique.map((item: RawCollectedItem) => ({
      title: item.title,
      body: item.description || item.title,
      boardKey: hints[0]?.boardKey ?? "media-resource",
      mediaType: (item.source === "youtube" ? "youtube" : "link") as "youtube" | "link",
      mediaUrl: item.url,
      thumbnailUrl: item.thumbnailUrl,
      tags: ["AI"],
      qualityScore: 5,
      source: item.source,
      publishedAt: item.publishedAt,
    }));
  }

  // 안전망 — 카테고리 보드만 통과
  curated = curated.filter((c) => categoryBoardKeys.has(c.boardKey));
  curated.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());

  const boardBreakdown: Record<string, number> = {};
  let inserted = 0;
  let skipped = 0;

  for (const item of curated) {
    if (!ctx.enabledBoardKeys.has(item.boardKey)) { skipped++; continue; }
    const bc = ctx.enabledBoards.find((b) => b.boardKey === item.boardKey);
    if (!bc) { skipped++; continue; }
    const boardMax = bc.maxItems;
    const currentBoardCount = boardBreakdown[item.boardKey] ?? 0;
    if (currentBoardCount >= boardMax) { skipped++; continue; }
    if (item.qualityScore < bc.minQualityScore) { skipped++; continue; }

    try {
      if (item.mediaUrl) {
        const dup = await firestore.collection("contents").where("mediaUrl", "==", item.mediaUrl).limit(1).get();
        if (!dup.empty) { skipped++; continue; }
      }

      const shouldReview = cs.autoPublish ? false : (bc.requireReview || ctx.defaultRequireReview);

      // 썸네일 fallback 체인:
      //  1) 원본 thumbnailUrl
      //  2) og:image (Gemini URL Context, Phase 4-A)
      //  3) (article 카테고리만) 화면 캡처 (Puppeteer, Phase 4-C) → Drive 업로드
      //  4) AI 이미지 생성 (Gemini Image, Phase 4-A) → Drive 업로드 → data URL 폴백
      let thumbnailUrl: string | null = item.thumbnailUrl ?? null;
      if (!thumbnailUrl && item.mediaUrl && /^https?:\/\//.test(item.mediaUrl) && GEMINI_KEY) {
        try {
          const { extractOgImageWithAI } = await import("../src/lib/og-image-ai");
          const og = await extractOgImageWithAI(item.mediaUrl, GEMINI_KEY);
          if (og.ok) thumbnailUrl = og.ogImage;
        } catch { /* graceful */ }
      }
      // Phase 4-C — article 카테고리(뉴스·블로그)일 때 화면 캡처 시도
      if (!thumbnailUrl && category === "article" && item.mediaUrl && /^https?:\/\//.test(item.mediaUrl)) {
        try {
          const { captureUrl } = await import("./screenshot");
          const shot = await captureUrl(item.mediaUrl);
          if (shot.ok) {
            try {
              const { uploadImageToDrive } = await import("./drive-upload");
              const safeTitle = (item.titleKo || item.title).slice(0, 40).replace(/[^\w가-힣]+/g, "-");
              const fileName = `screenshot-${Date.now()}-${safeTitle}.jpg`;
              const upload = await uploadImageToDrive({
                buffer: shot.buffer,
                mimeType: shot.mimeType,
                fileName,
              });
              if (upload.ok) thumbnailUrl = upload.url;
              // Drive 미설정이면 캡처 결과는 버림 (data URL로 base64 인코딩하면 너무 큼)
            } catch { /* graceful */ }
          }
        } catch { /* graceful */ }
      }
      if (!thumbnailUrl && GEMINI_KEY) {
        try {
          const { generateThumbnailImage } = await import("../src/lib/gemini-image");
          const gen = await generateThumbnailImage({
            apiKey: GEMINI_KEY,
            title: item.titleKo || item.title,
            body: item.bodyKo || item.body,
            tags: item.tags,
            category: CATEGORY_LABELS[category],
          });
          if (gen.ok) {
            // Drive 업로드 시도 — 실패 시 data URL 그대로 사용 (Firestore doc 부피 ↑)
            try {
              const { uploadImageToDrive } = await import("./drive-upload");
              const safeTitle = (item.titleKo || item.title).slice(0, 40).replace(/[^\w가-힣]+/g, "-");
              const fileName = `${category}-${Date.now()}-${safeTitle}.png`;
              const upload = await uploadImageToDrive({ dataUrl: gen.dataUrl, fileName });
              thumbnailUrl = upload.ok ? upload.url : gen.dataUrl;
              if (!upload.ok) console.log(`[Drive] 업로드 실패(${upload.error}) — data URL 폴백`);
            } catch {
              thumbnailUrl = gen.dataUrl;
            }
          }
        } catch { /* graceful */ }
      }

      await firestore.collection("contents").add({
        boardKey: item.boardKey,
        title: item.title,
        titleKo: item.titleKo ?? null,
        body: item.body,
        bodyKo: item.bodyKo ?? null,
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl,
        thumbnailUrl,
        tags: item.tags,
        authorUid: "ai-collector",
        authorName: "AI 큐레이터",
        isPinned: false,
        isApproved: !shouldReview,
        views: 0,
        likeCount: 0,
        commentCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      inserted++;
      boardBreakdown[item.boardKey] = (boardBreakdown[item.boardKey] ?? 0) + 1;
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.error(`[${catLabel}] Insert 실패: ${item.title}`, e);
    }
  }

  console.log(`[${catLabel}] 완료 — inserted=${inserted}, skipped=${skipped}`);
  await saveCategoryRun(
    category, startTime, items.length, unique.length, curated.length,
    inserted, curated.length - inserted - skipped, boardBreakdown,
  );
  return { collected: items.length, unique: unique.length, curated: curated.length, inserted, skipped, boardBreakdown };
}

async function main() {
  const startTime = Date.now();
  const settings = await loadSettings();
  const { minScore, boardConfigs, defaultRequireReview, youtubeKey, categorySettings } = settings;

  const enabledBoards = boardConfigs.filter((b) => b.enabled);
  const enabledBoardKeys = new Set(enabledBoards.map((b) => b.boardKey));

  console.log(`[AI Collector] 카테고리별 수집 시작 — minScore=${minScore}, boards=${enabledBoards.map((b) => b.boardKey).join(",")}`);

  const existingUrls = await getExistingUrlsAdmin();
  const ctx = { youtubeKey, minScore, boardConfigs, enabledBoards, enabledBoardKeys, defaultRequireReview, existingUrls, categorySettings };

  let totalInserted = 0;
  const updatedCategorySettings: Partial<Record<AiCategory, CategorySettings>> = { ...categorySettings };
  for (const cat of ALL_CATEGORIES) {
    const cs = resolveCategorySettings(categorySettings, cat);
    if (!cs.enabled) {
      console.log(`[${CATEGORY_LABELS[cat]}] 비활성 — skip`);
      continue;
    }
    try {
      const r = await runCategory(cat, ctx);
      totalInserted += r.inserted;
      updatedCategorySettings[cat] = { ...cs, lastRunAt: new Date().toISOString() };
    } catch (e) {
      console.error(`[${CATEGORY_LABELS[cat]}] 실행 실패`, e);
    }
  }

  // 통합 lastRunResult + 카테고리별 lastRunAt 갱신
  await firestore.doc("siteSettings/ai-collector").set(
    {
      lastRunAt: new Date().toISOString(),
      lastRunResult: { collected: 0, unique: 0, curated: 0, inserted: totalInserted, failed: 0 },
      categorySettings: updatedCategorySettings,
    },
    { merge: true },
  );

  console.log(`\n[Done] 전체 ${totalInserted}건 삽입, 총 소요 ${Math.round((Date.now() - startTime) / 1000)}초`);
}

async function saveCategoryRun(
  category: AiCategory,
  startTime: number,
  collected: number,
  unique: number,
  curated: number,
  inserted: number,
  failed: number,
  boardBreakdown: Record<string, number>,
) {
  await firestore.collection("aiCollectorHistory").add({
    runAt: new Date().toISOString(),
    trigger: "cron" as const,
    category,
    result: { collected, unique, curated, inserted, failed },
    boardBreakdown,
    duration: Date.now() - startTime,
  });
}

main().catch((e) => {
  console.error("[Fatal]", e);
  process.exit(1);
});
