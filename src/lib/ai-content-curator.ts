/**
 * AI 콘텐츠 큐레이터 — Gemini API 기반
 * 수집된 콘텐츠를 교차 검증 → 한국어 요약 → 품질 점수 → boardKey 분류 → 태그 추출한다.
 */

import type { RawCollectedItem, ContentSource } from "./ai-content-collector";
import type { MediaType } from "@/types/content";
import { isBlockedContent } from "./ai-content-blocklist";

export interface CuratedItem {
  /** 원본 제목(영문 등) */
  title: string;
  /** 원본 본문/설명 */
  body: string;
  /** 한국어 표시 제목 (Gemini 번역) — Content.titleKo로 저장 */
  titleKo?: string;
  /** 한국어 요약 본문 (Gemini 요약) — Content.bodyKo로 저장 */
  bodyKo?: string;
  boardKey: string;
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  tags: string[];
  qualityScore: number;
  source: ContentSource;
  publishedAt: string;
}

export interface BoardCurationHint {
  boardKey: string;
  label: string;
  maxItems: number;
  sources: ContentSource[];
}

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function curateItems(
  items: RawCollectedItem[],
  geminiApiKey: string,
  minScore = 7,
  boardHints?: BoardCurationHint[],
): Promise<CuratedItem[]> {
  if (items.length === 0) return [];

  // 사전 차단 — Gemini 호출 전 명백히 부적합한 콘텐츠(정치·시사·게임·도박 등) 제거.
  // 큐레이션 비용·시간 절감 + 명확한 정책 일관성.
  const filtered = items.filter((it) => {
    const text = `${it.title} ${it.description ?? ""}`;
    return !isBlockedContent(text).blocked;
  });
  if (filtered.length === 0) return [];

  if (!geminiApiKey) return filtered.map(fallbackCurate);

  const prompt = buildPrompt(filtered, boardHints);

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) return filtered.map(fallbackCurate);

    const data = await res.json();
    const text: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return parseGeminiResponse(text, filtered, minScore, boardHints);
  } catch {
    return filtered.map(fallbackCurate);
  }
}

// ── Prompt ──

function buildPrompt(items: RawCollectedItem[], boardHints?: BoardCurationHint[]): string {
  const listing = items
    .map(
      (it, i) =>
        `[${i}] source=${it.source} | title=${it.title} | url=${it.url} | desc=${it.description.slice(0, 200)}`,
    )
    .join("\n");

  const validKeys = boardHints?.length
    ? boardHints.map((h) => h.boardKey)
    : ["media-lecture", "media-resource"];

  const boardRules = boardHints?.length
    ? boardHints.map((h) => `- ${h.boardKey}(${h.label}): 소스=${h.sources.join(",")}, 최대 ${h.maxItems}건`).join("\n")
    : `- media-lecture: 영상/튜토리얼\n- media-resource: 도구/리포/자료/기타`;

  return `You are an AI content curator for AISH, a Korean AI education platform.

**Task**: Evaluate each item below. Return a JSON array ONLY (no markdown fences, no explanation).

**Items**:
${listing}

**For each item, output**:
{
  "index": <number>,
  "titleKo": "<Korean title, max 60 chars>",
  "bodyKo": "<Korean summary, 2-3 informative sentences>",
  "boardKey": "<${validKeys.join(" | ")}>",
  "tags": ["<3-5 Korean tags>"],
  "qualityScore": <1-10>
}

**Board classification rules**:
${boardRules}

**Scoring rules**:
- 가산: 여러 소스에서 동일 주제가 등장하면 교차검증 보너스 +2
- 가산: 실무/교육적 가치가 높은 콘텐츠 (YouTube 영상, GitHub 프로젝트 등 실체 있는 미디어)
- 감점: 클릭베이트, 홍보성, 오래된 정보
- 감점 (qualityScore 3 이하): 단순 링크 나열, 미디어 없는 텍스트 요약, 뉴스/토론 스레드

**도메인 적합성 (반드시 적용)**:
이 플랫폼은 **AI·머신러닝·데이터·코딩·교육 콘텐츠 전용**이다.
다음 카테고리는 qualityScore 를 2 이하로 강제하여 사실상 제외:
- 정치·시사 평론, 정치인·정당·선거 관련 영상·기사
- 게임 스트리밍·리뷰 (단, '게임 AI', 'AI 게임 개발' 등 기술 맥락은 정상 평가)
- 도박·성인·혐오·음모론 콘텐츠
- 단순 뉴스·연예·일상 vlog (AI 교육 관련성 없음)
- 자기개발 동기부여·강연 (AI 실무 관련성 없으면)

가산: 'LLM', 'RAG', '프롬프트 엔지니어링', '파인튜닝', '머신러닝',
'데이터 분석', '코딩', 'GitHub', 'Hugging Face' 등 핵심 키워드 포함 시 +1

- community-free는 사용하지 않는다

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
  boardHints?: BoardCurationHint[],
): CuratedItem[] {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed: GeminiCurateItem[] = JSON.parse(cleaned);

    const validKeys = boardHints?.length
      ? new Set(boardHints.map((h) => h.boardKey))
      : VALID_BOARD_KEYS;

    return parsed
      .filter((p) => p.qualityScore >= minScore && items[p.index])
      .map((p) => {
        const orig = items[p.index];
        return {
          // 원본 보존 + 한국어 번역은 별도 필드 → 카드 표시는 titleKo 우선
          title: orig.title,
          body: orig.description || orig.title,
          titleKo: p.titleKo?.trim() || undefined,
          bodyKo: p.bodyKo?.trim() || undefined,
          boardKey: validKeys.has(p.boardKey)
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
]);

function inferBoardKey(item: RawCollectedItem): string {
  if (item.source === "youtube") return "media-lecture";
  return "media-resource";
}

function inferMediaType(item: RawCollectedItem): MediaType {
  if (item.source === "youtube") return "youtube";
  return "link";
}
