"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users, GraduationCap, UserCheck, Building,
  Bell, FolderOpen, Star, HelpCircle, Handshake, Images, MessageCircle, Award,
} from "lucide-react";
import { DEMO_STATS, DEMO_PROGRAMS, DEMO_REVIEWS, DEMO_WORKATHON, DEMO_INSTRUCTORS } from "@/lib/demo-data";
import { getCollection, getSingletonDoc, COLLECTIONS } from "@/lib/firestore";
import { getContents } from "@/lib/content-engine";
import type { Content } from "@/types/content";
import { getRunmoaContents } from "@/lib/runmoa-api";
import type { RunmoaContent } from "@/types/runmoa";
import type { AdminEvent } from "@/types/firestore";
import {
  loadSiteCta,
  pickActiveHeroSlides,
  resolveHeroCtaLink,
  resolveHeroCtaText,
  DEFAULT_SITE_CTA,
  type HeroSlidePublic,
  type SiteBannerConfig,
} from "@/lib/site-settings-public";
import { loadPageContent, DEFAULT_HOME } from "@/lib/page-content-public";
import type { HomePageContent } from "@/types/page-content";
import { calculateDDay, toDateString } from "@/lib/utils";

export const STAT_ICONS: Record<string, React.ElementType> = {
  Users, GraduationCap, UserCheck, Building,
};

export const SPECIALTY_CARDS = [
  {
    title: "체계적 교육",
    subtitle: "SYSTEM",
    description: "단계별 커리큘럼으로 AI 기초부터 실무까지 체계적으로 학습합니다.",
    image: "/images/defaults/spec-system.jpg",
  },
  {
    title: "실무 중심",
    subtitle: "PRACTICE",
    description: "이론에 그치지 않고 실제 프로젝트로 실무 역량을 키웁니다.",
    image: "/images/defaults/spec-practice.jpg",
  },
  {
    title: "커뮤니티",
    subtitle: "COMMUNITY",
    description: "같은 목표를 가진 동료들과 네트워킹하며 함께 성장합니다.",
    image: "/images/defaults/spec-community.jpg",
  },
];

export const COMMUNITY_SHORTCUTS = [
  { label: "공지사항", href: "/community?tab=notice", icon: Bell },
  { label: "갤러리", href: "/community?tab=gallery", icon: Images },
  { label: "자료실", href: "/community?tab=resource", icon: FolderOpen },
  { label: "수강 후기", href: "/community?tab=review", icon: Star },
  { label: "묻고 답하기", href: "/community?tab=free", icon: MessageCircle },
  { label: "FAQ", href: "/community?tab=faq", icon: HelpCircle },
  { label: "수료증 발급", href: "/community?tab=certificate", icon: Award },
  { label: "협력 문의", href: "/community?tab=inquiry", icon: Handshake },
];

const RECENT_NOTICES = [
  { id: "", tag: "모집", title: "AI 기초 정규과정 11기 수강생 모집 안내", date: "2026.03.15" },
  { id: "", tag: "소식", title: "제4회 스마트워크톤 사전 등록으로 참가 신청이 곧 마감됩니다", date: "2026.03.14" },
  { id: "", tag: "안내", title: "2026년 상반기 교육 일정 안내", date: "2026.03.10" },
  { id: "", tag: "성과", title: "제3회 스마트워크톤 결과 발표", date: "2026.02.28" },
];

export function useHomeData() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState(DEMO_STATS);
  const [programs, setPrograms] = useState(DEMO_PROGRAMS);
  const [runmoaPrograms, setRunmoaPrograms] = useState<RunmoaContent[]>([]);
  const [adminEvents, setAdminEvents] = useState<(AdminEvent & { id: string })[]>([]);
  const [reviews, setReviews] = useState(DEMO_REVIEWS);
  const [workathon, setWorkathon] = useState<typeof DEMO_WORKATHON & { posterUrl?: string }>(DEMO_WORKATHON);
  const [notices, setNotices] = useState(RECENT_NOTICES);

  const [isDemoStats, setIsDemoStats] = useState(true);
  const [isDemoPrograms, setIsDemoPrograms] = useState(true);
  const [isDemoReviews, setIsDemoReviews] = useState(true);
  const [isDemoWorkathon, setIsDemoWorkathon] = useState(true);
  const [isDemoNotices, setIsDemoNotices] = useState(true);
  const [isDemoInstructors, setIsDemoInstructors] = useState(true);
  const [featuredVideos, setFeaturedVideos] = useState<{ id: string; title: string; youtubeUrl: string; category?: string; thumbnailUrl?: string }[]>([]);
  const [heroSlides, setHeroSlides] = useState<HeroSlidePublic[]>(() => pickActiveHeroSlides(undefined));
  const [heroIndex, setHeroIndex] = useState(0);
  const [siteBanner, setSiteBanner] = useState<SiteBannerConfig | null>(null);
  const [ctaCfg, setCtaCfg] = useState(DEFAULT_SITE_CTA);
  const [pageContent, setPageContent] = useState<HomePageContent>(DEFAULT_HOME);
  const [instructors, setInstructors] = useState<(typeof DEMO_INSTRUCTORS[number] & { imageUrl?: string })[]>(
    DEMO_INSTRUCTORS.filter((i) => i.isActive !== false)
  );
  const [latestContents, setLatestContents] = useState<Content[]>([]);
  const [isHomeDataLoading, setIsHomeDataLoading] = useState(true);

  const dDay = calculateDDay(workathon.eventDate);
  const revealRefs = useRef<HTMLElement[]>([]);

  const specialtyCardsResolved = useMemo(
    () =>
      (pageContent.specialtyCards.length > 0 ? pageContent.specialtyCards : SPECIALTY_CARDS).map((card) => ({
        ...card,
        image: ("imageUrl" in card ? card.imageUrl : (card as (typeof SPECIALTY_CARDS)[number]).image) || "",
      })),
    [pageContent.specialtyCards],
  );

  const currentHero = heroSlides[heroIndex] ?? heroSlides[0];

  useEffect(() => {
    setHeroIndex(0);
  }, [heroSlides]);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const id = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroSlides.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [heroSlides]);

  useEffect(() => {
    loadPageContent<HomePageContent>("home").then(setPageContent).catch(() => {});
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsHomeDataLoading(true);
      try {
        const [
          ctaLoaded, heroDoc, bannerDoc,
          firestorePrograms, firestoreReviews, firestoreEvents,
          firestorePosts, statDoc, firestoreVideos, firestoreInstructors,
        ] = await Promise.all([
          loadSiteCta(),
          getSingletonDoc<{ slides?: HeroSlidePublic[] }>(COLLECTIONS.SETTINGS, "hero"),
          getSingletonDoc<SiteBannerConfig>(COLLECTIONS.SETTINGS, "banner"),
          getCollection<typeof DEMO_PROGRAMS[0]>(COLLECTIONS.PROGRAMS),
          getCollection<typeof DEMO_REVIEWS[0]>(COLLECTIONS.REVIEWS),
          getCollection<typeof DEMO_WORKATHON & { posterUrl?: string }>(COLLECTIONS.EVENTS),
          getCollection<{ id: string; type?: string; boardType?: string; title: string; category?: string; createdAt?: string; date?: string }>(COLLECTIONS.POSTS),
          getSingletonDoc<{ items: typeof DEMO_STATS }>(COLLECTIONS.SETTINGS, "stats"),
          getCollection<{ id: string; title: string; youtubeUrl: string; category?: string; featured?: boolean; isFeatured?: boolean; thumbnailUrl?: string }>(COLLECTIONS.VIDEOS),
          getCollection<typeof DEMO_INSTRUCTORS[0] & { id: string; imageUrl?: string }>(COLLECTIONS.INSTRUCTORS),
        ]);
        setCtaCfg(ctaLoaded);
        setHeroSlides(pickActiveHeroSlides(heroDoc?.slides));
        if (bannerDoc) setSiteBanner(bannerDoc);
        if (firestorePrograms.length > 0) { setPrograms(firestorePrograms); setIsDemoPrograms(false); }
        if (firestoreInstructors.length > 0) {
          const active = firestoreInstructors
            .filter((ins) => {
              const i = ins as { isActive?: boolean; status?: string };
              return i.isActive !== false && i.status !== "pending" && i.status !== "rejected";
            })
            .sort((a, b) => ((a as { displayOrder?: number }).displayOrder ?? 999) - ((b as { displayOrder?: number }).displayOrder ?? 999));
          setInstructors(active);
          setIsDemoInstructors(false);
        }
        try {
          const [runmoaRes, eventsData, lectureContents, resourceContents] = await Promise.all([
            getRunmoaContents({ status: "publish", limit: 8 }),
            getCollection<AdminEvent & { id: string }>(COLLECTIONS.ADMIN_EVENTS),
            getContents("media-lecture", { maxItems: 4 }),
            getContents("media-resource", { maxItems: 4 }),
          ]);
          if (runmoaRes.data.length > 0) setRunmoaPrograms(runmoaRes.data);
          if (eventsData.length > 0) setAdminEvents(eventsData.filter((e) => e.status !== "COMPLETED" && e.status !== "CANCELLED"));
          const merged = [...lectureContents, ...resourceContents]
            .filter((c) => c.isApproved !== false)
            .sort((a, b) => {
              const ta = typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() : 0;
              const tb = typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() : 0;
              return tb - ta;
            })
            .slice(0, 4);
          if (merged.length > 0) setLatestContents(merged);
        } catch { /* Runmoa/Event/Contents 실패 시 무시 */ }
        if (firestoreReviews.length > 0) { setReviews(firestoreReviews.filter((r) => (r as { isApproved?: boolean }).isApproved !== false)); setIsDemoReviews(false); }
        if (firestoreEvents.length > 0) {
          const sortedEv = [...firestoreEvents].sort((a, b) => (b.eventDate || "").localeCompare(a.eventDate || ""));
          setWorkathon(sortedEv[0]);
          setIsDemoWorkathon(false);
        }
        if (statDoc?.items && statDoc.items.length > 0) { setStats(statDoc.items); setIsDemoStats(false); }
        if (firestoreVideos.length > 0) {
          const withUrl = firestoreVideos.filter((v) => v.youtubeUrl?.trim());
          const pool = withUrl.length > 0 ? withUrl : firestoreVideos;
          const featured = pool.filter((v) => v.featured || v.isFeatured).slice(0, 4);
          if (featured.length > 0) setFeaturedVideos(featured);
          else setFeaturedVideos(pool.slice(0, 4));
        }
        if (firestorePosts.length > 0) {
          const recentNotices = firestorePosts
            .filter((p) => (p.type || p.boardType) === "NOTICE")
            .sort((a, b) => {
              const da = a.createdAt || a.date || "";
              const db = b.createdAt || b.date || "";
              return db > da ? 1 : db < da ? -1 : 0;
            })
            .slice(0, 4)
            .map((p) => ({ id: p.id || "", tag: p.category || "공지", title: p.title, date: toDateString(p.createdAt || p.date) }));
          if (recentNotices.length > 0) { setNotices(recentNotices); setIsDemoNotices(false); }
        }
      } catch (e) {
        console.error("Failed to load data, using demo data:", e);
      } finally {
        setIsHomeDataLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.opacity = "1";
            (entry.target as HTMLElement).style.transform = "translateY(0)";
          }
        });
      },
      { threshold: 0.1 },
    );
    revealRefs.current.forEach((el) => {
      if (el) {
        el.style.opacity = "0";
        el.style.transform = "translateY(40px)";
        el.style.transition = "all 0.8s ease-out";
        observer.observe(el);
      }
    });
    return () => observer.disconnect();
  }, []);

  const addRevealRef = (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
    }
  };

  const primaryCtaHref = currentHero ? resolveHeroCtaLink(currentHero, ctaCfg.buttonUrl) : ctaCfg.buttonUrl;
  const primaryCtaLabel = currentHero ? resolveHeroCtaText(currentHero, ctaCfg.buttonText) : ctaCfg.buttonText;

  return {
    router, searchTerm, setSearchTerm,
    stats, programs, runmoaPrograms, adminEvents,
    reviews, workathon, notices, featuredVideos,
    heroSlides, heroIndex, setHeroIndex,
    siteBanner, ctaCfg, pageContent, instructors,
    dDay, revealRefs, addRevealRef,
    specialtyCardsResolved, currentHero,
    primaryCtaHref, primaryCtaLabel,
    latestContents,
    isDemoStats, isDemoPrograms, isDemoReviews,
    isDemoWorkathon, isDemoNotices, isDemoInstructors,
    isHomeDataLoading,
  };
}

export type HomeDataProps = ReturnType<typeof useHomeData>;
