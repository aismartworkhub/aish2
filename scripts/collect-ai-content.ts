/**
 * GitHub Actions 크론에서 실행되는 AI 콘텐츠 수집 스크립트
 * Firebase Admin SDK를 사용하여 Firestore에 직접 쓴다.
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
const MAX_ITEMS = Number(process.env.MAX_ITEMS) || 10;
const MIN_SCORE = Number(process.env.MIN_QUALITY_SCORE) || 7;

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
} from "../src/lib/ai-content-collector";
import { curateItems, type CuratedItem } from "../src/lib/ai-content-curator";

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
  console.log(
    `[AI Collector] Starting — max=${MAX_ITEMS}, minScore=${MIN_SCORE}`,
  );

  // 1. 수집
  const perSource = Math.ceil(MAX_ITEMS / 3);
  const { items, sourceResults } = await collectAll({
    youtubeApiKey: YOUTUBE_KEY,
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
    await saveRunResult(items.length, 0, 0, 0, 0);
    return;
  }

  // 3. Gemini 큐레이션
  let curated: CuratedItem[];
  if (GEMINI_KEY) {
    curated = await curateItems(unique, GEMINI_KEY, MIN_SCORE);
    console.log(`[Curate] ${curated.length} items passed quality threshold`);
  } else {
    console.log("[Curate] No Gemini key, using fallback curation");
    curated = unique.map((item: RawCollectedItem) => ({
      title: item.title,
      body: item.description || item.title,
      boardKey:
        item.source === "youtube"
          ? "media-lecture"
          : item.source === "github"
            ? "media-resource"
            : "community-free",
      mediaType: (item.source === "youtube" ? "youtube" : "link") as
        | "youtube"
        | "link",
      mediaUrl: item.url,
      thumbnailUrl: item.thumbnailUrl,
      tags: ["AI"],
      qualityScore: 5,
      source: item.source,
      publishedAt: item.publishedAt,
    }));
  }

  // 4. 오래된 순서로 정렬 후 삽입 (최신이 가장 마지막 → createdAt이 가장 최근)
  curated.sort(
    (a, b) =>
      new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );
  const toInsert = curated.slice(0, MAX_ITEMS);

  let inserted = 0;
  let skipped = 0;
  for (const item of toInsert) {
    try {
      // mediaUrl 기준 최종 중복 체크
      if (item.mediaUrl) {
        const dup = await firestore
          .collection("contents")
          .where("mediaUrl", "==", item.mediaUrl)
          .limit(1)
          .get();
        if (!dup.empty) {
          skipped++;
          continue;
        }
      }

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
        isApproved: true,
        views: 0,
        likeCount: 0,
        commentCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      inserted++;
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.error(`[Insert] Failed: ${item.title}`, e);
    }
  }
  if (skipped > 0) console.log(`[Insert] ${skipped} items skipped (already exist)`);

  console.log(`[Done] Inserted ${inserted}/${toInsert.length} items`);
  await saveRunResult(
    items.length,
    unique.length,
    curated.length,
    inserted,
    toInsert.length - inserted,
  );
}

async function saveRunResult(
  collected: number,
  unique: number,
  curated: number,
  inserted: number,
  failed: number,
) {
  await firestore.doc("siteSettings/ai-collector").set(
    {
      lastRunAt: new Date().toISOString(),
      lastRunResult: { collected, unique, curated, inserted, failed },
    },
    { merge: true },
  );
}

main().catch((e) => {
  console.error("[Fatal]", e);
  process.exit(1);
});
