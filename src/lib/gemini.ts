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

function parseResponse<T = GeminiEventResult>(text: string): T {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {} as T;
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

/* ── 강사 프로필 분석 ── */

export interface GeminiInstructorResult {
  name?: string;
  title?: string;
  organization?: string;
  bio?: string;
  specialties?: string[];
  experience?: { period: string; description: string }[];
  education?: { degree: string; institution: string; year: string }[];
  certifications?: string[];
  contactEmail?: string;
  socialLinks?: {
    linkedin?: string;
    youtube?: string;
    instagram?: string;
    github?: string;
    personalSite?: string;
  };
}

const INSTRUCTOR_PROMPT = `당신은 강사/전문가 프로필 정보 추출 전문가입니다. 제공된 문서/콘텐츠를 분석하여 강사 정보를 추출하세요.
반드시 아래 JSON 형식으로만 응답하세요 (판단할 수 없는 필드는 생략):
{
  "name": "이름",
  "title": "직책/직함",
  "organization": "소속 기관/회사",
  "bio": "약력 요약 (3-5문장, 한국어)",
  "specialties": ["전문분야1", "전문분야2"],
  "experience": [
    { "period": "2020 - 현재", "description": "직책/역할, 기관/회사" }
  ],
  "education": [
    { "degree": "학위", "institution": "학교/기관", "year": "졸업연도" }
  ],
  "certifications": ["자격증1", "자격증2"],
  "contactEmail": "이메일",
  "socialLinks": {
    "linkedin": "URL", "youtube": "URL", "instagram": "URL",
    "github": "URL", "personalSite": "URL"
  }
}
경력 기간은 "YYYY - YYYY" 또는 "YYYY - 현재" 형식으로 작성하세요.`;

export async function analyzeInstructorFile(
  apiKey: string,
  base64Data: string,
  mimeType: string
): Promise<GeminiInstructorResult> {
  const model = getModel(apiKey);
  const result = await model.generateContent([
    INSTRUCTOR_PROMPT,
    { inlineData: { data: base64Data, mimeType } },
  ]);
  return parseResponse<GeminiInstructorResult>(result.response.text());
}

export async function analyzeInstructorUrl(
  apiKey: string,
  url: string
): Promise<GeminiInstructorResult> {
  let content = `아래 URL에서 강사/전문가 프로필 정보를 분석하세요: ${url}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const text = await res.text();
      content = `아래 웹페이지에서 강사 프로필 정보를 추출하세요:\n\n${text.slice(0, 30000)}`;
    }
  } catch { /* CORS/타임아웃 */ }
  const model = getModel(apiKey);
  const result = await model.generateContent([INSTRUCTOR_PROMPT, content]);
  return parseResponse<GeminiInstructorResult>(result.response.text());
}

export async function analyzeInstructorText(
  apiKey: string,
  text: string
): Promise<GeminiInstructorResult> {
  const model = getModel(apiKey);
  const result = await model.generateContent([
    INSTRUCTOR_PROMPT,
    `아래 이력서/소개글에서 강사 프로필 정보를 추출하세요:\n\n${text.slice(0, 30000)}`,
  ]);
  return parseResponse<GeminiInstructorResult>(result.response.text());
}
