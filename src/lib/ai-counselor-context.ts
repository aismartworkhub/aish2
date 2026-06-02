import { HELP_TEXTS } from "@/lib/help-texts";
import { NAV_ITEMS } from "@/lib/constants";
import { getCollection, getSingletonDoc, COLLECTIONS } from "@/lib/firestore";
import type { Program, Instructor, Post } from "@/types/firestore";
import type { BusinessInfoConfig } from "@/lib/site-settings-public";

/** 관리자가 채우는 AI 상담사 배경지식 (Firestore siteSettings/ai-knowledge). */
export interface AiKnowledge {
  /** 관리자 직접 입력 */
  manual: string;
  /** 구글 드라이브 공개 폴더에서 가져온 텍스트 */
  drive: string;
  /** 유튜브 채널에서 가져온 영상 제목·설명 */
  youtube: string;
  /** 가져오기 소스: 드라이브 공개 폴더 ID (재가져오기용 기억) */
  driveFolderId?: string;
  /** 가져오기 소스: 유튜브 채널 ID(UC...) 또는 @핸들 */
  youtubeChannelId?: string;
}

/** "직접 입력" 배경지식 권장 상한 (관리자 UI 글자수 경고 기준). */
export const KNOWLEDGE_MAX_CHARS = 16_000;
/** 최종 조립된 시스템 프롬프트 안전 상한 (≈7k 토큰). 무료 Gemini 쿼터 보호용. */
export const MAX_CONTEXT_CHARS = 24_000;

const PROGRAMS_LIMIT = 35;
const INSTRUCTORS_LIMIT = 20;
const NOTICES_LIMIT = 5;
const FAQ_LIMIT = 40;
const BIO_MAX_CHARS = 200;

/** 길이 상한 초과 시 잘라내고 생략 표시를 붙인다. */
function cap(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…(이하 생략)`;
}

/** 관리자 배경지식(직접 입력 + 가져온 드라이브/유튜브) 블록. */
async function buildKnowledgeBlock(): Promise<string> {
  try {
    const kn = await getSingletonDoc<Partial<AiKnowledge>>(COLLECTIONS.SETTINGS, "ai-knowledge");
    if (!kn) return "";
    const parts = [
      kn.manual?.trim(),
      kn.drive?.trim() ? `### 구글 드라이브 자료\n${kn.drive.trim()}` : "",
      kn.youtube?.trim() ? `### 유튜브 콘텐츠\n${kn.youtube.trim()}` : "",
    ].filter(Boolean);
    if (parts.length === 0) return "";
    return cap(parts.join("\n\n"), KNOWLEDGE_MAX_CHARS);
  } catch {
    return "";
  }
}

/** 등록된 교육 프로그램(제목 + 요약 + 일정). */
async function buildProgramsBlock(): Promise<string> {
  try {
    const programs = await getCollection<Program>(COLLECTIONS.PROGRAMS);
    return programs
      .slice(0, PROGRAMS_LIMIT)
      .map((p) => {
        const head = `- ${p.title ?? "과정"}`;
        const summary = p.summary?.trim() ? `: ${p.summary.trim()}` : "";
        const schedule = p.schedule?.trim() ? ` (일정: ${p.schedule.trim()})` : "";
        return `${head}${summary}${schedule}`;
      })
      .join("\n");
  } catch {
    return "";
  }
}

/** 강사진(이름·소속·전문분야·약력 요약). */
async function buildInstructorsBlock(): Promise<string> {
  try {
    const instructors = await getCollection<Instructor>(COLLECTIONS.INSTRUCTORS);
    return instructors
      .filter((i) => i.isActive !== false && i.name?.trim())
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999))
      .slice(0, INSTRUCTORS_LIMIT)
      .map((i) => {
        const org = [i.title, i.organization].filter((v) => v?.trim()).join(" · ");
        const specialties = i.specialties?.length ? ` / 전문: ${i.specialties.join(", ")}` : "";
        const bio = i.bio?.trim() ? ` — ${i.bio.trim().slice(0, BIO_MAX_CHARS)}` : "";
        return `- ${i.name}${org ? ` (${org})` : ""}${specialties}${bio}`;
      })
      .join("\n");
  } catch {
    return "";
  }
}

/** 고정 공지(NOTICE 중 isPinned) 제목. */
async function buildNoticesBlock(): Promise<string> {
  try {
    const posts = await getCollection<Post>(COLLECTIONS.POSTS);
    return posts
      .filter((p) => p.type === "NOTICE" && p.isPinned && p.title?.trim())
      .slice(0, NOTICES_LIMIT)
      .map((p) => `- ${p.title}`)
      .join("\n");
  } catch {
    return "";
  }
}

/** 사업자 정보(상호·주소·연락처). */
async function buildBusinessBlock(): Promise<string> {
  try {
    const biz = await getSingletonDoc<BusinessInfoConfig>(COLLECTIONS.SETTINGS, "business");
    if (!biz) return "";
    const lines = [
      biz.companyName?.trim() ? `상호: ${biz.companyName.trim()}` : "",
      biz.address?.trim() ? `주소: ${biz.address.trim()}` : "",
      biz.phone?.trim() ? `고객센터: ${biz.phone.trim()}` : "",
      biz.email?.trim() ? `이메일: ${biz.email.trim()}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  } catch {
    return "";
  }
}

/** FAQ(displayOrder 순, 상위 일부). */
async function buildFaqBlock(): Promise<string> {
  try {
    const faq = await getCollection<{ question?: string; answer?: string; displayOrder?: number }>(COLLECTIONS.FAQ);
    return [...faq]
      .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999))
      .slice(0, FAQ_LIMIT)
      .map((f) => `Q: ${f.question ?? ""}\nA: ${f.answer ?? ""}`)
      .join("\n\n");
  } catch {
    return "";
  }
}

/**
 * AI 상담사 시스템 프롬프트용 컨텍스트.
 * 관리자 배경지식(siteSettings/ai-knowledge) + 사이트 콘텐츠(프로그램·강사·공지·FAQ·사업자)를 합쳐
 * 답변 근거로 주입한다. 무료 쿼터 보호를 위해 MAX_CONTEXT_CHARS로 최종 절단한다.
 */
export async function buildCounselorContext(): Promise<string> {
  const helpBlock = Object.entries(HELP_TEXTS)
    .map(([k, v]) => `[${k}] ${v}`)
    .join("\n");
  const navBlock = NAV_ITEMS.map((i) => `- ${i.label}: ${i.href}`).join("\n");

  const [knowledgeBlock, programsBlock, instructorsBlock, noticesBlock, businessBlock, faqBlock] =
    await Promise.all([
      buildKnowledgeBlock(),
      buildProgramsBlock(),
      buildInstructorsBlock(),
      buildNoticesBlock(),
      buildBusinessBlock(),
      buildFaqBlock(),
    ]);

  const assembled = [
    "당신은 AISH(AI Smartwork Hub) 교육 플랫폼의 공식 안내 챗봇입니다.",
    "답변 원칙:",
    "- 사이트 고유 사실(과정·일정·가격·환불/정책·연락처·강사 등)은 아래 제공된 자료에만 근거해 답하세요. 자료에 없으면 추측하지 말고, 모른다고 밝힌 뒤 커뮤니티(/community)나 문의를 안내하세요.",
    "- AI·스마트워크 등 일반 지식 질문에는 일반적인 지식으로 친절히 도움을 주되, AISH 고유의 사실(없는 과정·가격 등)을 지어내지 마세요.",
    "- 한국어로 간결하고 친절하게 답합니다.",
    "",
    "## 사이트 메뉴",
    navBlock,
    "",
    "## 도움말",
    helpBlock,
    knowledgeBlock ? `\n## 관리자 배경지식\n${knowledgeBlock}` : "",
    businessBlock ? `\n## 사업자 정보\n${businessBlock}` : "",
    programsBlock ? `\n## 교육 프로그램\n${programsBlock}` : "",
    instructorsBlock ? `\n## 강사진\n${instructorsBlock}` : "",
    noticesBlock ? `\n## 주요 공지\n${noticesBlock}` : "",
    faqBlock ? `\n## FAQ\n${faqBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return cap(assembled, MAX_CONTEXT_CHARS);
}
