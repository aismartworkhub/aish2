import { COLLECTIONS, getSingletonDoc } from "@/lib/firestore";
import type { HomeLayout, HomeSectionItem, HomeTemplateKey } from "@/types/home-layout";

interface SectionMeta {
  key: string;
  label: string;
  supportsHeading: boolean;
  title?: string;
  description?: string;
}

/** 템플릿별 섹션 구성(순서·라벨·기본 제목). 현재 화면을 그대로 재현. */
export const TEMPLATE_SECTIONS: Record<HomeTemplateKey, SectionMeta[]> = {
  default: [
    { key: "banner", label: "상단 D-Day 배너", supportsHeading: false },
    { key: "hero", label: "히어로 (메인 비주얼)", supportsHeading: false },
    { key: "newsticker", label: "최신 소식 띠", supportsHeading: false },
    { key: "search", label: "빠른 교육과정 검색", supportsHeading: false },
    { key: "education", label: "AI실전마스터 (강사)", supportsHeading: true, title: "AI실전마스터", description: "각 분야 현업 전문가가 여러분의 성장을 이끕니다." },
    { key: "specialty", label: "Specialty (교육 가치)", supportsHeading: true, title: "Specialty", description: "AISH만의 차별화된 교육 가치를 경험하세요." },
    { key: "stats", label: "숫자 실적", supportsHeading: false },
    { key: "workathon", label: "스마트워크톤", supportsHeading: false },
    { key: "programs", label: "교육 프로그램", supportsHeading: true, title: "Program", description: "진행중인 교육 과정" },
    { key: "event", label: "행사 / 이벤트", supportsHeading: true, title: "Event", description: "진행 예정 행사 및 이벤트" },
    { key: "insight", label: "Insight (콘텐츠)", supportsHeading: true, title: "Insight", description: "실무에 바로 쓰는 AI 콘텐츠" },
    { key: "review", label: "수강생 후기", supportsHeading: true, title: "Review", description: "수강생들의 생생한 후기" },
    { key: "community", label: "커뮤니티 바로가기", supportsHeading: false },
    { key: "newsroom", label: "뉴스룸 + 최근 활동", supportsHeading: false },
    { key: "cta", label: "하단 CTA", supportsHeading: true, title: "AI 시대,\n지금 시작하세요", description: "AISH와 함께라면 누구나 AI 전문가로 성장할 수 있습니다. 무료 정규 과정부터 실무 프로젝트까지, 단계별로 설계된 커리큘럼이 준비되어 있습니다." },
  ],
  community: [
    { key: "banner", label: "상단 D-Day 배너", supportsHeading: false },
    { key: "hero", label: "히어로 (메인 비주얼)", supportsHeading: false },
    { key: "search", label: "빠른 교육과정 검색", supportsHeading: false },
    { key: "programs", label: "교육 프로그램", supportsHeading: true, title: "Program", description: "진행중인 교육 과정" },
    { key: "education", label: "AI실전마스터 (강사)", supportsHeading: true, title: "AI실전마스터", description: "각 분야 현업 전문가가 여러분의 성장을 이끕니다." },
    { key: "memberBenefits", label: "회원 혜택", supportsHeading: true, title: "Member Benefits", description: "AISH 회원이라면 누리는 혜택 — 자료, 지원, 네트워크를 한 곳에서" },
    { key: "insight", label: "Insight (콘텐츠 + 교육 가치)", supportsHeading: true, title: "Insight", description: "실무에 바로 쓰는 교육 영상과 양질의 콘텐츠" },
    { key: "workathon", label: "스마트워크톤", supportsHeading: false },
    { key: "event", label: "행사 / 이벤트", supportsHeading: true, title: "Event", description: "진행 예정 행사 및 이벤트" },
    { key: "reviewStats", label: "후기 + 숫자 실적", supportsHeading: true, title: "Review", description: "수강생들의 생생한 후기" },
    { key: "recent", label: "최근 커뮤니티 활동", supportsHeading: false },
    { key: "newsroomCta", label: "하단 CTA + 뉴스룸", supportsHeading: false },
  ],
  modern: [],
};

/** 해당 템플릿의 기본 레이아웃(전부 표시, order 10 간격). */
export function defaultLayoutFor(template: HomeTemplateKey): HomeLayout {
  return {
    sections: TEMPLATE_SECTIONS[template].map((m, i) => ({
      key: m.key,
      visible: true,
      order: (i + 1) * 10,
      ...(m.title != null ? { title: m.title } : {}),
      ...(m.description != null ? { description: m.description } : {}),
      paddingTop: null,
      paddingBottom: null,
    })),
  };
}

/** 키 → 항목 맵. 누락 키는 템플릿 기본값으로 보강 (렌더에서 사용). */
export function indexHomeSections(layout: HomeLayout, template: HomeTemplateKey): Record<string, HomeSectionItem> {
  const map: Record<string, HomeSectionItem> = {};
  for (const d of defaultLayoutFor(template).sections) map[d.key] = d;
  for (const s of layout?.sections ?? []) {
    if (s && map[s.key]) map[s.key] = { ...map[s.key], ...s };
  }
  return map;
}

/** 저장된 부분 데이터를 템플릿 기본값에 머지해 완전한 레이아웃 생성(순서 정렬). */
function mergeLayout(raw: Partial<HomeLayout> | null, template: HomeTemplateKey): HomeLayout {
  const byKey = new Map<string, Partial<HomeSectionItem>>();
  for (const s of raw?.sections ?? []) {
    if (s && typeof s.key === "string") byKey.set(s.key, s);
  }
  const sections = defaultLayoutFor(template).sections.map((def) => ({ ...def, ...(byKey.get(def.key) ?? {}) }));
  sections.sort((a, b) => a.order - b.order);
  return { sections };
}

/** Firestore 문서: siteSettings/home-layout = { templates: { [template]: { sections } } } */
type LayoutDoc = { templates?: Partial<Record<HomeTemplateKey, HomeLayout>> };

const cache: Partial<Record<HomeTemplateKey, HomeLayout>> = {};
let inflightDoc: Promise<LayoutDoc | null> | null = null;

async function fetchDoc(): Promise<LayoutDoc | null> {
  if (!inflightDoc) {
    inflightDoc = getSingletonDoc<LayoutDoc>(COLLECTIONS.SETTINGS, "home-layout").catch(() => null);
  }
  return inflightDoc;
}

export async function loadHomeLayout(template: HomeTemplateKey): Promise<HomeLayout> {
  if (cache[template]) return cache[template]!;
  const doc = await fetchDoc();
  const merged = mergeLayout(doc?.templates?.[template] ?? null, template);
  cache[template] = merged;
  return merged;
}

/** 관리자 편집기용 — 저장된 원본(머지 전) 문서 전체. */
export async function loadHomeLayoutDoc(): Promise<LayoutDoc | null> {
  invalidateHomeLayoutCache();
  return fetchDoc();
}

export function invalidateHomeLayoutCache(): void {
  for (const k of Object.keys(cache) as HomeTemplateKey[]) delete cache[k];
  inflightDoc = null;
}
