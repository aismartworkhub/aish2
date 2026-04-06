import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSingletonDoc, setSingletonDoc, COLLECTIONS } from "@/lib/firestore";

/* ── Gemini API 키 관리 (Firestore siteSettings/gemini) ── */

interface GeminiSettings {
  apiKey: string;
}

let cachedKey: string | null = null;

export async function getGeminiApiKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  const doc = await getSingletonDoc<GeminiSettings>(COLLECTIONS.SETTINGS, "gemini");
  if (doc?.apiKey) {
    cachedKey = doc.apiKey;
    return cachedKey;
  }
  return null;
}

export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  await setSingletonDoc(COLLECTIONS.SETTINGS, "gemini", { apiKey });
  cachedKey = apiKey;
}

/* ── Gemini AI 분석 ── */

export interface GeminiEventResult {
  title?: string;
  tags?: string[];
  startDate?: string;
  endDate?: string;
  organizer?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  summary?: string;
  thumbnailUrl?: string;
}

const SYSTEM_PROMPT = `당신은 행사/이벤트 정보 추출 전문가입니다. 제공된 문서/콘텐츠를 분석하여 이벤트 정보를 추출하세요.
반드시 아래 JSON 형식으로만 응답하세요 (판단할 수 없는 필드는 생략):
{
  "title": "이벤트 제목",
  "tags": ["태그1", "태그2"],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "organizer": "주관 기관/단체",
  "contactPerson": "담당자 이름",
  "phone": "연락처",
  "email": "이메일",
  "summary": "이벤트 요약 (2-3문장)"
}
날짜는 반드시 YYYY-MM-DD 형식으로 변환하세요. 태그는 1-5개의 관련 키워드를 한국어로 작성하세요.`;

function getModel(apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

function parseResponse(text: string): GeminiEventResult {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

export async function analyzeFile(
  apiKey: string,
  base64Data: string,
  mimeType: string
): Promise<GeminiEventResult> {
  const model = getModel(apiKey);
  const result = await model.generateContent([
    SYSTEM_PROMPT,
    { inlineData: { data: base64Data, mimeType } },
  ]);
  return parseResponse(result.response.text());
}

export async function analyzeUrl(
  apiKey: string,
  url: string
): Promise<GeminiEventResult> {
  let content = `아래 URL의 이벤트/행사 정보를 분석하세요: ${url}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const text = await res.text();
      content = `아래 웹페이지 내용에서 이벤트 정보를 추출하세요:\n\n${text.slice(0, 30000)}`;
    }
  } catch {
    // CORS 또는 타임아웃 — URL만 전달
  }
  const model = getModel(apiKey);
  const result = await model.generateContent([SYSTEM_PROMPT, content]);
  return parseResponse(result.response.text());
}
