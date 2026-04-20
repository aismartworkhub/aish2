import { HELP_TEXTS } from "@/lib/help-texts";
import { NAV_ITEMS } from "@/lib/constants";
import { getCollection, COLLECTIONS } from "@/lib/firestore";

/** AI 상담사 시스템 프롬프트용 컨텍스트 (도움말 + 메뉴 + FAQ 일부) */
export async function buildCounselorContext(): Promise<string> {
  const helpBlock = Object.entries(HELP_TEXTS)
    .map(([k, v]) => `[${k}] ${v}`)
    .join("\n");
  const navBlock = NAV_ITEMS.map((i) => `- ${i.label}: ${i.href}`).join("\n");

  let faqBlock = "";
  try {
    const faq = await getCollection<{ question?: string; answer?: string; displayOrder?: number }>(COLLECTIONS.FAQ);
    const sorted = [...faq].sort(
      (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999),
    );
    faqBlock = sorted
      .slice(0, 40)
      .map((f) => `Q: ${f.question ?? ""}\nA: ${f.answer ?? ""}`)
      .join("\n\n");
  } catch {
    faqBlock = "";
  }

  let programsBlock = "";
  try {
    const programs = await getCollection<{ title?: string; name?: string }>(COLLECTIONS.PROGRAMS);
    programsBlock = programs
      .slice(0, 35)
      .map((p) => `- ${p.title ?? p.name ?? "과정"}`)
      .join("\n");
  } catch {
    programsBlock = "";
  }

  return [
    "당신은 AISH(AI Smartwork Hub) 교육 플랫폼의 공식 안내 챗봇입니다.",
    "아래에 제공된 사이트 구조·도움말·FAQ만 근거로 답변하세요.",
    "정보가 없으면 모른다고 말하고, 커뮤니티(/community) 또는 프로필·관리자 문의를 안내하세요.",
    "한국어로 간결하고 친절하게 답합니다.",
    "",
    "## 사이트 메뉴",
    navBlock,
    "",
    "## 도움말",
    helpBlock,
    programsBlock ? `\n## 등록된 프로그램 예시 (일부)\n${programsBlock}` : "",
    faqBlock ? `\n## FAQ (일부)\n${faqBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
