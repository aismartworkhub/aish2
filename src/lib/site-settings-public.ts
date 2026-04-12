import { CTA_URL, CTA_TEXT } from "@/lib/constants";
import { COLLECTIONS, getSingletonDoc } from "@/lib/firestore";

export type SiteCtaConfig = {
  buttonText: string;
  buttonUrl: string;
  floatingEnabled: boolean;
};

export const DEFAULT_SITE_CTA: SiteCtaConfig = {
  buttonText: CTA_TEXT,
  buttonUrl: CTA_URL,
  floatingEnabled: true,
};

let ctaCache: SiteCtaConfig | null = null;
let ctaInflight: Promise<SiteCtaConfig> | null = null;

/** 공개 페이지용 CTA 설정 — 동일 세션에서 중복 요청 방지 */
export async function loadSiteCta(): Promise<SiteCtaConfig> {
  if (ctaCache) return ctaCache;
  if (!ctaInflight) {
    ctaInflight = getSingletonDoc<{
      buttonText?: string;
      buttonUrl?: string;
      floatingEnabled?: boolean;
    }>(COLLECTIONS.SETTINGS, "cta")
      .then((doc) => {
        const next: SiteCtaConfig = {
          buttonText: doc?.buttonText?.trim() || CTA_TEXT,
          buttonUrl: doc?.buttonUrl?.trim() || CTA_URL,
          floatingEnabled: doc?.floatingEnabled !== false,
        };
        ctaCache = next;
        return next;
      })
      .catch(() => {
        ctaCache = DEFAULT_SITE_CTA;
        return DEFAULT_SITE_CTA;
      })
      .finally(() => {
        ctaInflight = null;
      });
  }
  return ctaInflight;
}

export type HeroSlidePublic = {
  imageUrl: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  isActive: boolean;
};

export type SiteBannerConfig = {
  enabled: boolean;
  title: string;
  dDayDate: string;
  link: string;
};

const DEFAULT_HERO_SLIDE: HeroSlidePublic = {
  imageUrl: "/images/defaults/hero-main.jpg",
  title: "미래를 선도하는\nAI 교육 플랫폼",
  subtitle: "체계적인 교육과 실무 중심 연구로\n당신의 AI 역량을 한 단계 끌어올립니다.",
  ctaText: CTA_TEXT,
  ctaLink: "",
  isActive: true,
};

/** 활성 슬라이드만 — 없으면 기본 1장 */
export function pickActiveHeroSlides(slides: HeroSlidePublic[] | undefined): HeroSlidePublic[] {
  if (!slides?.length) return [{ ...DEFAULT_HERO_SLIDE }];
  const active = slides.filter((s) => s.isActive !== false);
  return active.length > 0 ? active : [{ ...DEFAULT_HERO_SLIDE }];
}

export function resolveHeroCtaLink(slide: HeroSlidePublic, siteCtaUrl: string): string {
  const s = slide.ctaLink?.trim();
  if (s) return s;
  return siteCtaUrl || CTA_URL;
}

export function resolveHeroCtaText(slide: HeroSlidePublic, siteCtaText: string): string {
  const t = slide.ctaText?.trim();
  if (t) return t;
  return siteCtaText || CTA_TEXT;
}

export { DEFAULT_HERO_SLIDE };

/* ── 홈 테마 설정 ── */

export type HomeTemplate = "default" | "modern" | "community";

export interface SiteThemeConfig {
  homeTemplate: HomeTemplate;
}

export const DEFAULT_THEME: SiteThemeConfig = { homeTemplate: "default" };

export async function loadSiteTheme(): Promise<SiteThemeConfig> {
  const doc = await getSingletonDoc<SiteThemeConfig>(COLLECTIONS.SETTINGS, "theme");
  return doc ?? DEFAULT_THEME;
}
