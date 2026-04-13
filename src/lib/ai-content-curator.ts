/**
 * AI 콘텐츠 큐레이터 — Gemini API 기반
 * 수집된 콘텐츠를 교차 검증 → 한국어 요약 → 품질 점수 → boardKey 분류 → 태그 추출한다.
 */

import type { RawCollectedItem, ContentSource } from "./ai-content-collector";
import type { MediaType } from "@/types/content";

export interface CuratedItem {
  title: string;
  body: string;
  boardKey: string;
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  tags: string[];
  qualityScore: number;
  source: ContentSource;
  publishedAt: string;
}

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function curateItems(
  items: RawCollectedItem[],
  geminiApiKey: string,
  minScore = 7,
): Promise<CuratedItem[]> {
  if (items.length === 0) return [];
  if (!geminiApiKey) return items.map(fallbackCurate);

  const prompt = buildPrompt(items);

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) return items.map(fallbackCurate);

    const data = await res.json();
    const text: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return parseGeminiResponse(text, items, minScore);
  } catch {
    return items.map(fallbackCurate);
  }
}

// ── Prompt ──

function buildPrompt(items: RawCollectedItem[]): string {
  const listing = items
    .map(
      (it, i) =>
        `[${i}] source=${it.source} | title=${it.title} | url=${it.url} | desc=${it.description.slice(0, 200)}`,
    )
    .join("\n");

  return `You are an AI content curator for AISH, a Korean AI education platform.

**Task**: Evaluate each item below. Return a JSON array ONLY (no markdown fences, no explanation).

**Items**:
${listing}

**For each item, output**:
{
  "index": <number>,
  "titleKo": "<Korean title, max 60 chars>",
  "bodyKo": "<Korean summary, 2-3 informative sentences>",
  "boardKey": "<media-lecture | media-resource | community-free>",
  "tags": ["<3-5 Korean tags>"],
  "qualityScore": <1-10>
}

**Scoring rules**:
- 가산: 여러 소스에서 동일 주제가 등장하면 교차검증 보너스 +2
- 가산: 실무/교육적 가치가 높은 콘텐츠
- 감점: 클릭베이트, 홍보성, 오래된 정보
- boardKey 기준: 영상/튜토리얼→media-lecture, 도구/리포/자료→media-resource, 뉴스/토론/일반→community-free

**Output**: Valid JSON array only.`;
}

// ── 응답 파싱 ──

interface GeminiCurateItem {
  index: number;
  titleKo: string;
  bodyKo: string;
  boardKey: string;
  tags: string[];
  qualityScore: number;
}

function parseGeminiResponse(
  text: string,
  items: RawCollectedItem[],
  minScore: number,
): CuratedItem[] {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed: GeminiCurateItem[] = JSON.parse(cleaned);

    return parsed
      .filter((p) => p.qualityScore >= minScore && items[p.index])
      .map((p) => {
        const orig = items[p.index];
        return {
          title: p.titleKo || orig.title,
          body: p.bodyKo || orig.description,
          boardKey: isValidBoardKey(p.boardKey)
            ? p.boardKey
            : inferBoardKey(orig),
          mediaType: inferMediaType(orig),
          mediaUrl: orig.url,
          thumbnailUrl: orig.thumbnailUrl,
          tags: Array.isArray(p.tags) ? p.tags.slice(0, 5) : ["AI"],
          qualityScore: p.qualityScore,
          source: orig.source,
          publishedAt: orig.publishedAt,
        };
      });
  } catch {
    return items.map(fallbackCurate);
  }
}

// ── 폴백 (Gemini 실패 시) ──

function fallbackCurate(item: RawCollectedItem): CuratedItem {
  return {
    title: item.title,
    body: item.description || item.title,
    boardKey: inferBoardKey(item),
    mediaType: inferMediaType(item),
    mediaUrl: item.url,
    thumbnailUrl: item.thumbnailUrl,
    tags: ["AI"],
    qualityScore: 5,
    source: item.source,
    publishedAt: item.publishedAt,
  };
}

// ── 유틸 ──

const VALID_BOARD_KEYS = new Set([
  "media-lecture",
  "media-resource",
  "community-free",
]);

function isValidBoardKey(key: string): boolean {
  return VALID_BOARD_KEYS.has(key);
}

function inferBoardKey(item: RawCollectedItem): string {
  if (item.source === "youtube") return "media-lecture";
  if (item.source === "github") return "media-resource";
  return "community-free";
}

function inferMediaType(item: RawCollectedItem): MediaType {
  if (item.source === "youtube") return "youtube";
  return "link";
}
