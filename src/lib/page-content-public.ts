import { COLLECTIONS, PAGE_DOC_ID, getSingletonDoc } from "@/lib/firestore";
import type {
  PageKey,
  PageContentBase,
  HomePageContent,
  AboutPageContent,
  EducationCard,
  SpecialtyCard,
  ValueItem,
} from "@/types/page-content";

/* ── 페이지별 기본값 (현재 하드코딩 값 그대로) ── */

export const DEFAULT_HOME: HomePageContent = {
  hero: { imageUrl: "", title: "", subtitle: "" },
  sections: {
    education: { title: "Education", description: "목표에 맞는 최적의 AI 교육 과정을 제공합니다." },
    specialty: { title: "Specialty", description: "AISH만의 차별화된 교육 가치를 경험하세요." },
  },
  educationCards: [
    { title: "AI 기초", subtitle: "Foundation", description: "인공지능의 기본 개념부터 실무 활용까지", imageUrl: "/images/defaults/edu-ai.jpg", span: "big" },
    { title: "데이터 분석", subtitle: "Data Analysis", description: "Python 기반 데이터 분석과 시각화", imageUrl: "/images/defaults/edu-data.jpg", span: "normal" },
    { title: "바이브 코딩", subtitle: "Vibe Coding", description: "코드로 만드는 크리에이티브 작품", imageUrl: "/images/defaults/edu-vibe.jpg", span: "normal" },
    { title: "정부과제", subtitle: "Government", description: "정부과제 연계 전문 교육 프로그램", imageUrl: "/images/defaults/edu-cloud.jpg", span: "normal" },
    { title: "스마트워크", subtitle: "Smart Work", description: "업무 자동화와 AI 활용 실무", imageUrl: "/images/defaults/edu-smart.jpg", span: "normal" },
  ],
  specialtyCards: [
    { title: "체계적 교육", subtitle: "SYSTEM", description: "단계별 커리큘럼으로 AI 기초부터 실무까지 체계적으로 학습합니다.", imageUrl: "/images/defaults/spec-system.jpg" },
    { title: "실무 중심", subtitle: "PRACTICE", description: "이론에 그치지 않고 실제 프로젝트로 실무 역량을 키웁니다.", imageUrl: "/images/defaults/spec-practice.jpg" },
    { title: "커뮤니티", subtitle: "COMMUNITY", description: "같은 목표를 가진 동료들과 네트워킹하며 함께 성장합니다.", imageUrl: "/images/defaults/spec-community.jpg" },
  ],
};

export const DEFAULT_ABOUT: AboutPageContent = {
  hero: {
    imageUrl: "/images/defaults/spec-system.jpg",
    title: "미래를 선도하는 AI 교육 플랫폼",
    subtitle: "AISH는 체계적인 교육과 실무 중심 연구, 커뮤니티를 통해 AI 시대의 인재를 양성합니다.",
  },
  sections: {
    values: { title: "핵심 가치" },
    history: { title: "연혁" },
    partners: { title: "파트너" },
  },
  values: [
    { icon: "Target", title: "체계적 교육", desc: "입문부터 실무까지 단계별 커리큘럼" },
    { icon: "Eye", title: "실무 중심", desc: "현업 전문가와 함께하는 프로젝트 기반 학습" },
    { icon: "Heart", title: "열린 커뮤니티", desc: "함께 성장하는 AI 교육 생태계" },
  ],
};

export const DEFAULT_PROGRAMS: PageContentBase = {
  hero: {
    imageUrl: "",
    title: "교육 프로그램",
    subtitle: "AISH의 다양한 AI 교육 과정을 확인하세요.",
  },
  sections: {},
};

export const DEFAULT_INSTRUCTORS: PageContentBase = {
  hero: {
    imageUrl: "",
    title: "전문 강사진",
    subtitle: "각 분야 최고의 전문가들이 여러분의 성장을 이끕니다.",
  },
  sections: {},
};

export const DEFAULT_WORKATHON: PageContentBase = {
  hero: {
    imageUrl: "/images/defaults/workathon-bg.jpg",
    title: "",
    subtitle: "",
  },
  sections: {},
};

export const DEFAULT_VIDEOS: PageContentBase = {
  hero: {
    imageUrl: "",
    title: "영상 콘텐츠",
    subtitle: "AISH의 다양한 영상 콘텐츠를 만나보세요.",
  },
  sections: {},
};

export const DEFAULT_COMMUNITY: PageContentBase = {
  hero: {
    imageUrl: "",
    title: "커뮤니티",
    subtitle: "AISH 커뮤니티에서 다양한 정보와 서비스를 이용하세요.",
  },
  sections: {},
};

const PAGE_DEFAULTS: Record<PageKey, PageContentBase | HomePageContent | AboutPageContent> = {
  home: DEFAULT_HOME,
  about: DEFAULT_ABOUT,
  programs: DEFAULT_PROGRAMS,
  instructors: DEFAULT_INSTRUCTORS,
  workathon: DEFAULT_WORKATHON,
  videos: DEFAULT_VIDEOS,
  community: DEFAULT_COMMUNITY,
};

/* ── 인메모리 캐시 (세션 중 한 번만 fetch) ── */
const cache = new Map<string, PageContentBase>();
const inflight = new Map<string, Promise<PageContentBase>>();

export async function loadPageContent<T extends PageContentBase = PageContentBase>(
  pageKey: PageKey,
): Promise<T> {
  const defaults = PAGE_DEFAULTS[pageKey] as T;
  const cached = cache.get(pageKey);
  if (cached) return cached as T;

  if (!inflight.has(pageKey)) {
    const p = getSingletonDoc<Record<string, unknown>>(COLLECTIONS.SETTINGS, PAGE_DOC_ID(pageKey))
      .then((raw) => {
        if (!raw) {
          cache.set(pageKey, defaults);
          return defaults;
        }
        const merged = deepMergePageContent(defaults, raw);
        cache.set(pageKey, merged);
        return merged as T;
      })
      .catch(() => {
        cache.set(pageKey, defaults);
        return defaults;
      })
      .finally(() => {
        inflight.delete(pageKey);
      });
    inflight.set(pageKey, p);
  }
  return inflight.get(pageKey) as Promise<T>;
}

function deepMergePageContent<T extends PageContentBase>(
  defaults: T,
  raw: Record<string, unknown>,
): T {
  const hero = defaults.hero;
  const rawHero = (raw.hero ?? {}) as Partial<typeof hero>;
  const mergedHero = {
    imageUrl: rawHero.imageUrl?.toString().trim() || hero.imageUrl,
    title: rawHero.title?.toString().trim() || hero.title,
    subtitle: rawHero.subtitle?.toString().trim() || hero.subtitle,
  };

  const sections = { ...defaults.sections };
  const rawSections = (raw.sections ?? {}) as Record<string, Record<string, string>>;
  for (const key of Object.keys(sections)) {
    if (rawSections[key]) {
      sections[key] = {
        title: rawSections[key].title?.trim() || sections[key].title,
        description: rawSections[key].description?.trim() || sections[key].description,
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = { ...defaults, hero: mergedHero, sections };

  if (Array.isArray(raw.values) && raw.values.length > 0) {
    result.values = raw.values as ValueItem[];
  }
  if (Array.isArray(raw.educationCards) && raw.educationCards.length > 0) {
    result.educationCards = raw.educationCards as EducationCard[];
  }
  if (Array.isArray(raw.specialtyCards) && raw.specialtyCards.length > 0) {
    result.specialtyCards = raw.specialtyCards as SpecialtyCard[];
  }

  return result as T;
}

export { PAGE_DEFAULTS };
