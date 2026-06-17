import { HELP_TEXTS } from "@/lib/help-texts";
import { NAV_GROUPS } from "@/lib/admin-nav";
import { getRunmoaContents } from "@/lib/runmoa-api";
import { loadBusinessInfo } from "@/lib/site-settings-public";

/** "어디서 무엇을 수정하나" — 도움말 페이지 표 + 관리자 AI 지식 공용 데이터. */
export interface EditTarget {
  what: string;
  menu: string;
  path: string;
  note?: string;
}

export const EDIT_TARGETS: EditTarget[] = [
  { what: "메인 섹션 표시/순서/제목/여백", menu: "사이트 관리 → 메인 페이지 편집", path: "/admin/home-layout", note: "섹션 끄기·순서·헤딩" },
  { what: "메인 히어로(배경 이미지·문구·버튼)", menu: "사이트 설정 → 히어로 섹션", path: "/admin/settings?tab=hero", note: "슬라이드 여러 장" },
  { what: "숫자 실적(수강생 수 등)", menu: "사이트 설정 → 실적 수치", path: "/admin/settings?tab=stats" },
  { what: "상단/하단 CTA 버튼 문구·링크", menu: "사이트 설정 → CTA 설정", path: "/admin/settings?tab=cta" },
  { what: "상단 D-Day 배너", menu: "사이트 설정 → 배너 관리", path: "/admin/settings?tab=banner" },
  { what: "홈 디자인 템플릿", menu: "사이트 설정 → 홈 테마", path: "/admin/settings?tab=theme" },
  { what: "푸터 사업자 정보", menu: "사이트 설정 → 사업자 정보", path: "/admin/settings?tab=business" },
  { what: "페이지 히어로·소개 카드(이미지 포함)", menu: "사이트 관리 → 페이지 관리", path: "/admin/pages", note: "홈·소개 등 탭별" },
  { what: "강사(프로필 이미지·소개)", menu: "교육 운영 → 강사 관리", path: "/admin/instructors", note: "메인 'AI실전마스터' 섹션" },
  { what: "교육 프로그램 노출 순서·숨김·표시내용(제목·설명·이미지·가격)", menu: "교육 운영 → 프로그램 관리", path: "/admin/programs", note: "등록·수정 원본은 Runmoa(aish.runmoa.com). 이 화면은 홈·교육과정 카드 표시를 덮어쓰기. 행 클릭/연필로 편집·저장" },
  { what: "스마트워크톤 / 행사", menu: "교육 운영 → 스마트워크톤 / 일반 행사", path: "/admin/workathon" },
  { what: "갤러리(드라이브 일괄 가져오기)", menu: "콘텐츠 관리 → 갤러리", path: "/admin/gallery" },
  { what: "AI 상담 지식", menu: "사이트 설정 → AI 지식", path: "/admin/settings?tab=knowledge", note: "상담창 답변 근거" },
];

/** 이미지 넣는 법 — 페이지 + AI 공용. */
export const IMAGE_GUIDE_STEPS = [
  "이 사이트는 이미지를 'URL'로만 받습니다(파일 업로드 저장소 미사용).",
  "구글 드라이브(권장): 파일 우클릭 → 공유 → '링크가 있는 모든 사용자(보기)'로 변경(필수) → 링크 복사 → 이미지 URL 칸에 붙여넣기.",
  "drive.google.com/file/d/...  ·  open?id=...  ·  uc?id=... 형식 모두 자동 인식됩니다.",
  "외부 직접 이미지 주소(https://....jpg/png/webp)나 내장 경로(/images/defaults/...)도 가능합니다.",
  "'미리보기를 불러올 수 없습니다'가 뜨면 대개 드라이브 파일이 '링크가 있는 모든 사용자' 공개가 아닙니다.",
];

/** 프로그램–Runmoa 연동 구조 설명 — AI 도우미가 "왜 여기서만 일부만 바뀌나"를 정확히 안내. */
export const RUNMOA_INTEGRATION_NOTE = [
  "교육 프로그램(과정) 데이터는 외부 플랫폼 Runmoa(aish.runmoa.com)와 연동됩니다.",
  "- 원본 등록·수정·삭제·수강신청/결제는 모두 Runmoa에서 이뤄집니다. 새 과정을 '만드는' 곳은 Runmoa 관리자(aish.runmoa.com/admin/contents)입니다.",
  "- 이 사이트(aish.co.kr)는 Runmoa의 공개 API로 과정 목록을 '읽기 전용'으로 가져와 홈의 'Program' 섹션과 교육과정 페이지(/programs)에 표시합니다.",
  "- 따라서 이 사이트에서는 Runmoa 원본을 직접 못 고칩니다. 대신 '교육 운영 → 프로그램 관리(/admin/programs)'에서 카드의 노출 순서·숨김과 표시 내용(제목·설명·대표이미지·유형·가격)을 '덮어쓰기(오버레이)'할 수 있습니다.",
  "- 오버레이는 이 사이트의 카드 표시에만 적용됩니다. 카드를 클릭하면 가는 Runmoa 수강신청 상세 페이지는 Runmoa 원본 그대로입니다. 카드와 상세를 똑같이 맞추려면 Runmoa 원본도 함께 수정해야 합니다.",
  "- 오버레이에서 비워둔 항목은 Runmoa 원본 값을 자동으로 따라갑니다(원본이 바뀌면 자동 반영).",
].join("\n");

/** 관리자 AI 도우미 시스템 프롬프트(컨텍스트). 매뉴얼 + 화면별 도움말 기반. */
export function buildAdminAssistantContext(): string {
  const editMap = EDIT_TARGETS.map((t) => `- ${t.what} → ${t.menu} (${t.path})${t.note ? ` · ${t.note}` : ""}`).join("\n");
  const help = Object.entries(HELP_TEXTS)
    .map(([k, v]) => `[${k}] ${v}`)
    .join("\n");
  return [
    "당신은 AISH(AI Smartwork Hub) 관리자 페이지의 내부 운영 도우미입니다. 사용자는 사이트 운영자(관리자)입니다.",
    "당신의 역할은 두 가지입니다:",
    "1) 운영자가 '어디서/어떻게 수정하나요?'라고 물으면, 아래 '편집 화면 안내'를 근거로 정확한 메뉴 경로와 절차를 알려줍니다.",
    "2) 콘텐츠 초안을 작성·개선합니다(히어로 문구, 프로그램 소개, 공지글, 섹션 제목·설명, 강사 소개 등). 운영자가 복사해서 붙여넣을 수 있게 바로 쓸 수 있는 문구로 제시합니다.",
    "",
    "지켜야 할 규칙:",
    "- 당신은 설정을 직접 바꾸거나 저장할 수 없습니다. 항상 '안내'와 '복사용 텍스트'만 제공하고, 마지막에 어디서 저장하는지 알려주세요.",
    "- 메뉴 경로·방법은 아래 자료에만 근거하세요. 자료에 없으면 모른다고 하고 추측하지 마세요.",
    "- 이미지는 모두 URL 방식임을 전제로 안내하세요(아래 '이미지 넣는 법').",
    "- 한국어로 간결하고 친절하게. 단계가 있으면 번호로.",
    "- 마크다운 강조 기호(**, ##, ` 등)는 쓰지 말고 일반 텍스트로 작성하세요(화면에 그대로 노출됩니다).",
    "",
    "## 편집 화면 안내 (어디서 무엇을 수정하나)",
    editMap,
    "",
    "## 이미지 넣는 법",
    IMAGE_GUIDE_STEPS.map((s) => `- ${s}`).join("\n"),
    "",
    "## 프로그램 ↔ Runmoa 연동",
    RUNMOA_INTEGRATION_NOTE,
    "",
    "## 반영 규칙",
    "- 각 화면의 '저장하기'를 눌러야 반영됩니다. 공개 페이지는 약 30초 캐시가 있어, 바로 확인하려면 강제 새로고침(Cmd/Ctrl+Shift+R) 하라고 안내하세요.",
    "",
    "## 화면별 상세 도움말",
    help,
  ].join("\n");
}

/** 실제 사이드바 메뉴 구조(자동 추출) — 메뉴가 바뀌면 도우미 안내도 자동 반영. */
function buildLiveMenuMap(): string {
  const lines: string[] = [];
  for (const group of NAV_GROUPS) {
    const title = group.title || "기본";
    for (const item of group.items) {
      lines.push(`- [${title}] ${item.label} → ${item.href}`);
      for (const child of item.children ?? []) {
        lines.push(`   - ${item.label} > ${child.label} → ${child.href}`);
      }
    }
  }
  return lines.join("\n");
}

/**
 * 사용 시점의 라이브 상태를 주입한 동적 컨텍스트.
 * 정적 매뉴얼 + 실제 메뉴 구조 + 현재 프로그램/사업자 정보를 합친다.
 * 각 라이브 조회는 실패해도 무시(정적 부분은 항상 제공).
 */
export async function buildAdminAssistantContextLive(): Promise<string> {
  const parts: string[] = [
    buildAdminAssistantContext(),
    "",
    "## 실제 관리자 메뉴 구조 (사이드바에서 자동 반영 — 항상 최신)",
    buildLiveMenuMap(),
  ];

  try {
    const res = await getRunmoaContents({ status: "publish", limit: 50 });
    const list = res.data.map((c, i) => `${i + 1}. ${c.title} (id ${c.content_id})`).join("\n");
    parts.push("", `## 현재 공개 중인 교육 프로그램 (${res.data.length}건 · Runmoa 실시간)`, list || "(없음)");
  } catch {
    /* Runmoa 조회 실패 시 생략 */
  }

  try {
    const b = await loadBusinessInfo();
    parts.push(
      "",
      "## 현재 사업자 정보 (푸터 표시값)",
      `상호: ${b.companyName} / 대표: ${b.ceo} / 사업자등록번호: ${b.businessNumber} / 통신판매업: ${b.mailOrderNumber} / 주소: ${b.address} / 고객센터: ${b.phone} / 이메일: ${b.email} / 개인정보 보호책임자: ${b.privacyManager}`,
    );
  } catch {
    /* 사업자 정보 조회 실패 시 생략 */
  }

  parts.push(
    "",
    "참고: 위 '실제 메뉴 구조'와 '현재 …' 항목은 이 대화를 연 시점의 실시간 값입니다. 운영자가 메뉴·프로그램·사업자 정보를 바꾸면 다음에 대화를 새로 열 때 자동 갱신됩니다.",
  );
  return parts.join("\n");
}
