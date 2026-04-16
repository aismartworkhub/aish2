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
  collectAll,
  type RawCollectedItem,
  type ContentSource,
} from "../src/lib/ai-content-collector";
import { curateItems, type CuratedItem } from "../src/lib/ai-content-curator";

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

interface AiCollectorSettings {
  youtubeApiKey?: string;
  maxItemsPerRun?: number;
  minQualityScore?: number;
  boardConfigs?: BoardCollectionConfig[];
  defaultRequireReview?: boolean;
}

const DEFAULT_BOARD_CONFIGS: BoardCollectionConfig[] = [
  { boardKey: "media-lecture", label: "강의 영상", enabled: true, maxItems: 5, minQualityScore: 7, sources: ["youtube"], requireReview: false },
  { boardKey: "media-resource", label: "자료실", enabled: true, maxItems: 5, minQualityScore: 7, sources: ["github", "reddit"], requireReview: false },
];

// ── Firestore에서 설정 로드 ──

async function loadSettings(): Promise<{ maxItems: number; minScore: number; boardConfigs: BoardCollectionConfig[]; defaultRequireReview: boolean; youtubeKey: string }> {
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
      };
    }
  } catch (e) {
    console.warn("[Settings] Failed to load, using defaults:", e);
  }
  return { maxItems: ENV_MAX_ITEMS, minScore: ENV_MIN_SCORE, boardConfigs: DEFAULT_BOARD_CONFIGS, defaultRequireReview: false, youtubeKey: YOUTUBE_KEY };
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

async function main() {
  const startTime = Date.now();
  const settings = await loadSettings();
  const { maxItems, minScore, boardConfigs, defaultRequireReview, youtubeKey } = settings;

  const enabledBoards = boardConfigs.filter((b) => b.enabled);
  const enabledBoardKeys = new Set(enabledBoards.map((b) => b.boardKey));

  console.log(`[AI Collector] Starting — max=${maxItems}, minScore=${minScore}, boards=${enabledBoards.map((b) => b.boardKey).join(",")}`);

  // 1. 수집
  const perSource = Math.ceil(maxItems / 3);
  const { items, sourceResults } = await collectAll({
    youtubeApiKey: youtubeKey,
    maxPerSource: perSource,
  });
  console.log(`[Collect] ${items.length} items from sources:`);
  for (const [src, r] of Object.entries(sourceResults)) {
    console.log(`  ${src}: ${r.count}건${r.error ? ` (오류: ${r.error})` : ""}`);
  }

  // 2. 중복 제거
  const existingUrls = await getExistingUrlsAdmin();
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const url = normalizeUrl(item.url);
    if (!url || existingUrls.has(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
  console.log(`[Dedup] ${unique.length} unique items (${items.length - unique.length} duplicates removed)`);

  if (unique.length === 0) {
    console.log("[Done] No new items to insert.");
    await saveRunResult(startTime, items.length, 0, 0, 0, 0, {});
    return;
  }

  // 3. Gemini 큐레이션
  let curated: CuratedItem[];
  if (GEMINI_KEY) {
    curated = await curateItems(unique, GEMINI_KEY, minScore);
    console.log(`[Curate] ${curated.length} items passed quality threshold`);
  } else {
    console.log("[Curate] No Gemini key, using fallback curation");
    curated = unique.map((item: RawCollectedItem) => ({
      title: item.title,
      body: item.description || item.title,
      boardKey: item.source === "youtube" ? "media-lecture" : "media-resource",
      mediaType: (item.source === "youtube" ? "youtube" : "link") as "youtube" | "link",
      mediaUrl: item.url,
      thumbnailUrl: item.thumbnailUrl,
      tags: ["AI"],
      qualityScore: 5,
      source: item.source,
      publishedAt: item.publishedAt,
    }));
  }

  // 4. 보드별 삽입 (설정 반영)
  curated
    .filter((c) => c.boardKey !== "community-free")
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());

  const boardBreakdown: Record<string, number> = {};
  let inserted = 0;
  let skipped = 0;

  for (const item of curated) {
    if (item.boardKey === "community-free") { skipped++; continue; }
    if (!enabledBoardKeys.has(item.boardKey)) { skipped++; continue; }

    const bc = enabledBoards.find((b) => b.boardKey === item.boardKey);
    if (!bc) { skipped++; continue; }

    const boardMax = bc.maxItems;
    const currentBoardCount = boardBreakdown[item.boardKey] ?? 0;
    if (currentBoardCount >= boardMax) { skipped++; continue; }

    const boardMinScore = bc.minQualityScore;
    if (item.qualityScore < boardMinScore) { skipped++; continue; }

    try {
      if (item.mediaUrl) {
        const dup = await firestore
          .collection("contents")
          .where("mediaUrl", "==", item.mediaUrl)
          .limit(1)
          .get();
        if (!dup.empty) { skipped++; continue; }
      }

      const shouldReview = bc.requireReview || defaultRequireReview;

      await firestore.collection("contents").add({
        boardKey: item.boardKey,
        title: item.title,
        body: item.body,
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl,
        thumbnailUrl: item.thumbnailUrl || null,
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
      console.error(`[Insert] Failed: ${item.title}`, e);
    }
  }
  if (skipped > 0) console.log(`[Insert] ${skipped} items skipped`);

  console.log(`[Done] Inserted ${inserted} items`, boardBreakdown);
  await saveRunResult(startTime, items.length, unique.length, curated.length, inserted, curated.length - inserted - skipped, boardBreakdown);
}

async function saveRunResult(
  startTime: number,
  collected: number,
  unique: number,
  curated: number,
  inserted: number,
  failed: number,
  boardBreakdown: Record<string, number>,
) {
  const runResult = { collected, unique, curated, inserted, failed };

  await firestore.doc("siteSettings/ai-collector").set(
    { lastRunAt: new Date().toISOString(), lastRunResult: runResult },
    { merge: true },
  );

  await firestore.collection("aiCollectorHistory").add({
    runAt: new Date().toISOString(),
    trigger: "cron" as const,
    result: runResult,
    boardBreakdown,
    duration: Date.now() - startTime,
  });
}

main().catch((e) => {
  console.error("[Fatal]", e);
  process.exit(1);
});
