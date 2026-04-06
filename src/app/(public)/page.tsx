"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Search, SlidersHorizontal, ChevronRight,
  Users, GraduationCap, UserCheck, Building, Star, Play,
  BookOpen, Trophy, Bell, FolderOpen, Award, HelpCircle, Handshake, Images,
} from "lucide-react";
import { PROGRAM_CATEGORY_LABELS, EVENT_STATUS_LABELS, EVENT_STATUS_COLORS, RUNMOA_CONTENT_TYPE_LABELS } from "@/lib/constants";
import { DEMO_STATS, DEMO_PROGRAMS, DEMO_REVIEWS, DEMO_WORKATHON } from "@/lib/demo-data";
import { getCollection, getSingletonDoc, COLLECTIONS } from "@/lib/firestore";
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
import { calculateDDay, cn, isExternalHref, toDateString } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import YouTubeThumbnailImage from "@/components/ui/YouTubeThumbnailImage";

const STAT_ICONS: Record<string, React.ElementType> = {
  Users, GraduationCap, UserCheck, Building,
};

const EDUCATION_CATEGORIES = [
  {
    title: "AI 기초",
    subtitle: "Foundation",
    description: "인공지능의 기본 개념부터 실무 활용까지",
    image: "/images/defaults/edu-ai.jpg",
    span: "big",
  },
  {
    title: "데이터 분석",
    subtitle: "Data Analysis",
    description: "Python 기반 데이터 분석과 시각화",
    image: "/images/defaults/edu-data.jpg",
    span: "normal",
  },
  {
    title: "바이브 코딩",
    subtitle: "Vibe Coding",
    description: "코드로 만드는 크리에이티브 작품",
    image: "/images/defaults/edu-vibe.jpg",
    span: "normal",
  },
  {
    title: "정부과제",
    subtitle: "Government",
    description: "정부과제 연계 전문 교육 프로그램",
    image: "/images/defaults/edu-cloud.jpg",
    span: "normal",
  },
  {
    title: "스마트워크",
    subtitle: "Smart Work",
    description: "업무 자동화와 AI 활용 실무",
    image: "/images/defaults/edu-smart.jpg",
    span: "normal",
  },
];

const SPECIALTY_CARDS = [
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

const COMMUNITY_SHORTCUTS = [
  { label: "공지사항", href: "/community?tab=notice", icon: Bell },
  { label: "자료실", href: "/community?tab=resource", icon: FolderOpen },
  { label: "수료증 발급", href: "/community?tab=certificate", icon: Award },
  { label: "FAQ", href: "/community?tab=faq", icon: HelpCircle },
  { label: "협력 문의", href: "/community?tab=inquiry", icon: Handshake },
  { label: "갤러리", href: "/community?tab=gallery", icon: Images },
];

const RECENT_NOTICES = [
  { tag: "모집", title: "AI 기초 정규과정 11기 수강생 모집 안내", date: "2026.03.15" },
  { tag: "소식", title: "제4회 스마트워크톤 사전 등록으로 참가 신청이 곧 마감됩니다", date: "2026.03.14" },
  { tag: "안내", title: "2026년 상반기 교육 일정 안내", date: "2026.03.10" },
  { tag: "성과", title: "제3회 스마트워크톤 결과 발표", date: "2026.02.28" },
];

export default function HomePage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState(DEMO_STATS);
  const [programs, setPrograms] = useState(DEMO_PROGRAMS);
  const [runmoaPrograms, setRunmoaPrograms] = useState<RunmoaContent[]>([]);
  const [adminEvents, setAdminEvents] = useState<(AdminEvent & { id: string })[]>([]);
  const [reviews, setReviews] = useState(DEMO_REVIEWS);
  const [workathon, setWorkathon] = useState<typeof DEMO_WORKATHON & { posterUrl?: string }>(DEMO_WORKATHON);
  const [notices, setNotices] = useState(RECENT_NOTICES);
  const [featuredVideos, setFeaturedVideos] = useState<{ id: string; title: string; youtubeUrl: string; category?: string }[]>([]);
  const [heroSlides, setHeroSlides] = useState<HeroSlidePublic[]>(() => pickActiveHeroSlides(undefined));
  const [heroIndex, setHeroIndex] = useState(0);
  const [eduImages, setEduImages] = useState<Record<string, string>>({});
  const [specImages, setSpecImages] = useState<Record<string, string>>({});
  const [siteBanner, setSiteBanner] = useState<SiteBannerConfig | null>(null);
  const [ctaCfg, setCtaCfg] = useState(DEFAULT_SITE_CTA);

  const dDay = calculateDDay(workathon.eventDate);
  const revealRefs = useRef<HTMLElement[]>([]);

  const educationCategoriesResolved = useMemo(
    () =>
      EDUCATION_CATEGORIES.map((cat) => ({
        ...cat,
        image: eduImages[cat.title] || cat.image,
      })),
    [eduImages]
  );

  const specialtyCardsResolved = useMemo(
    () =>
      SPECIALTY_CARDS.map((card) => ({
        ...card,
        image: specImages[card.title] || card.image,
      })),
    [specImages]
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

  // Load real data from Firestore, fallback to demo data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [
          ctaLoaded,
          heroDoc,
          bannerDoc,
          firestorePrograms,
          firestoreReviews,
          firestoreEvents,
          firestorePosts,
          statDoc,
          firestoreVideos,
        ] = await Promise.all([
          loadSiteCta(),
          getSingletonDoc<{
            slides?: HeroSlidePublic[];
            educationImages?: Record<string, string>;
            specialtyImages?: Record<string, string>;
          }>(COLLECTIONS.SETTINGS, "hero"),
          getSingletonDoc<SiteBannerConfig>(COLLECTIONS.SETTINGS, "banner"),
          getCollection<typeof DEMO_PROGRAMS[0]>(COLLECTIONS.PROGRAMS),
          getCollection<typeof DEMO_REVIEWS[0]>(COLLECTIONS.REVIEWS),
          getCollection<typeof DEMO_WORKATHON & { posterUrl?: string }>(COLLECTIONS.EVENTS),
          getCollection<{ id: string; type?: string; boardType?: string; title: string; category?: string; createdAt?: string; date?: string }>(COLLECTIONS.POSTS),
          getSingletonDoc<{ items: typeof DEMO_STATS }>(COLLECTIONS.SETTINGS, "stats"),
          getCollection<{ id: string; title: string; youtubeUrl: string; category?: string; featured?: boolean; isFeatured?: boolean }>(COLLECTIONS.VIDEOS),
        ]);
        setCtaCfg(ctaLoaded);
        setHeroSlides(pickActiveHeroSlides(heroDoc?.slides));
        if (heroDoc?.educationImages && Object.keys(heroDoc.educationImages).length > 0) {
          setEduImages(heroDoc.educationImages);
        }
        if (heroDoc?.specialtyImages && Object.keys(heroDoc.specialtyImages).length > 0) {
          setSpecImages(heroDoc.specialtyImages);
        }
        if (bannerDoc) setSiteBanner(bannerDoc);
        if (firestorePrograms.length > 0) setPrograms(firestorePrograms);
        // Runmoa 콘텐츠 + Event 로드
        try {
          const [runmoaRes, eventsData] = await Promise.all([
            getRunmoaContents({ status: "publish", limit: 8 }),
            getCollection<AdminEvent & { id: string }>(COLLECTIONS.ADMIN_EVENTS),
          ]);
          if (runmoaRes.data.length > 0) setRunmoaPrograms(runmoaRes.data);
          if (eventsData.length > 0) setAdminEvents(eventsData.filter((e) => e.status !== "COMPLETED" && e.status !== "CANCELLED"));
        } catch { /* Runmoa/Event 실패 시 무시 */ }
        if (firestoreReviews.length > 0) setReviews(firestoreReviews.filter((r) => (r as { isApproved?: boolean }).isApproved !== false));
        if (firestoreEvents.length > 0) {
          const sortedEv = [...firestoreEvents].sort((a, b) =>
            (b.eventDate || "").localeCompare(a.eventDate || "")
          );
          setWorkathon(sortedEv[0]);
        }
        if (statDoc?.items && statDoc.items.length > 0) setStats(statDoc.items);
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
            .map((p) => ({ tag: p.category || "공지", title: p.title, date: toDateString(p.createdAt || p.date) }));
          if (recentNotices.length > 0) setNotices(recentNotices);
        }
      } catch (e) {
        console.error("Failed to load data, using demo data:", e);
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
      { threshold: 0.1 }
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

  const primaryCtaHref = currentHero
    ? resolveHeroCtaLink(currentHero, ctaCfg.buttonUrl)
    : ctaCfg.buttonUrl;
  const primaryCtaLabel = currentHero
    ? resolveHeroCtaText(currentHero, ctaCfg.buttonText)
    : ctaCfg.buttonText;

  return (
    <>
      {siteBanner?.enabled && siteBanner.title && siteBanner.dDayDate && (() => {
        const bannerHref = siteBanner.link?.trim() || "/workathon";
        const external = isExternalHref(bannerHref);
        const dDay = calculateDDay(siteBanner.dDayDate);
        return (
          <div className="bg-primary-800 text-white text-center text-sm" role="banner">
            {external ? (
              <a
                href={bannerHref}
                className="block w-full py-3 px-4 hover:bg-primary-900/50 transition-colors font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                {siteBanner.title} · {dDay}
              </a>
            ) : (
              <Link
                href={bannerHref}
                className="block w-full py-3 px-4 hover:bg-primary-900/50 transition-colors font-medium"
              >
                {siteBanner.title} · {dDay}
              </Link>
            )}
          </div>
        );
      })()}

      {/* ── S1: 히어로 (EDU-TECH 스타일) — siteSettings/hero ── */}
      <section className="relative h-[85vh] min-h-[600px] overflow-hidden">
        <img
          src={currentHero?.imageUrl || "/images/defaults/hero-main.jpg"}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[rgba(0,58,120,0.85)] to-transparent" />

        <div className="relative z-10 h-full flex items-center">
          <div className="ml-[8%] md:ml-[10%] max-w-[700px] text-white">
            <p className="text-primary-300 text-sm font-medium tracking-widest uppercase mb-4">
              AI Smart Work Hub
            </p>
            <h1 className="text-[clamp(36px,5vw,64px)] font-bold leading-[1.1] tracking-tight whitespace-pre-line">
              {currentHero?.title}
            </h1>
            <p className="mt-5 text-lg md:text-xl font-light opacity-90 leading-relaxed max-w-[500px] whitespace-pre-line">
              {currentHero?.subtitle}
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href={primaryCtaHref}
                target={isExternalHref(primaryCtaHref) ? "_blank" : undefined}
                rel={isExternalHref(primaryCtaHref) ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary-500 text-white text-base font-medium rounded hover:bg-primary-600 transition-colors"
              >
                {primaryCtaLabel}
                <ArrowRight size={18} />
              </a>
              <Link
                href="/programs"
                className="inline-flex items-center gap-2 px-8 py-3.5 border border-white/50 text-white text-base font-medium rounded-full hover:bg-white hover:text-primary-700 transition-all"
              >
                교육 과정 보기 +
              </Link>
            </div>
            {heroSlides.length > 1 && (
              <div className="mt-8 flex gap-2">
                {heroSlides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`슬라이드 ${i + 1}`}
                    onClick={() => setHeroIndex(i)}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      i === heroIndex ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── S2: 검색 섹션 (히어로 겹침) ── */}
      <section className="relative z-30 -mt-[60px]">
        <div className="w-[90%] max-w-[1200px] mx-auto flex flex-col md:flex-row shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
          <div className="flex-1 bg-white p-8 md:p-11">
            <h3 className="text-lg font-medium text-gray-900 mb-5">빠른 교육과정 탐색</h3>
            <div className="flex items-center border-b-2 border-gray-300 pb-1">
              <input
                type="text"
                placeholder="과정명 또는 키워드를 입력하세요."
                className="flex-1 py-2.5 text-base outline-none bg-transparent placeholder:text-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchTerm.trim()) {
                    router.push(`/programs?q=${encodeURIComponent(searchTerm.trim())}`);
                  }
                }}
              />
              <button
                className="text-gray-500 hover:text-primary-600 transition-colors"
                onClick={() => {
                  if (searchTerm.trim()) {
                    router.push(`/programs?q=${encodeURIComponent(searchTerm.trim())}`);
                  }
                }}
              >
                <Search size={22} />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-primary-500 p-8 md:p-11 text-white">
            <h3 className="text-lg font-medium mb-5">카테고리 맞춤 검색</h3>
            <div className="flex items-center border-b-2 border-white/40 pb-1">
              <select
                className="flex-1 py-2.5 text-base outline-none bg-transparent text-white/90 appearance-none cursor-pointer [&>option]:text-gray-900"
                onChange={(e) => {
                  const selected = e.target.value;
                  if (selected) {
                    router.push(`/programs?category=${encodeURIComponent(selected)}`);
                  }
                }}
                defaultValue=""
              >
                <option value="">전체 카테고리</option>
                {Object.entries(PROGRAM_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <SlidersHorizontal size={22} className="text-white/70" />
            </div>
          </div>
        </div>
      </section>

      {/* ── S3: Education (이미지 모자이크 그리드) ── */}
      <section className="py-24 md:py-28">
        <div className="text-center mb-16">
          <h2 className="text-[42px] font-bold text-primary-700 mb-4">Education</h2>
          <p className="text-gray-500 text-lg max-w-[800px] mx-auto">
            목표에 맞는 최적의 AI 교육 과정을 제공합니다.
          </p>
        </div>

        <div className="w-[90%] max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 auto-rows-[280px] gap-4">
          {educationCategoriesResolved.map((cat) => (
            <Link
              key={cat.title}
              href="/programs"
              ref={addRevealRef}
              className={`group relative rounded overflow-hidden cursor-pointer transition-transform duration-500 hover:-translate-y-2.5 ${
                cat.span === "big" ? "col-span-2 row-span-2" : ""
              }`}
            >
              <img
                src={cat.image}
                alt={cat.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 text-white">
                <h3 className={`font-medium ${cat.span === "big" ? "text-2xl md:text-3xl" : "text-lg md:text-xl"}`}>
                  {cat.title}
                </h3>
                <p className="text-sm text-white/60 mt-1">{cat.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── S4: Specialty (이미지 카드) ── */}
      <section className="py-24 md:py-28 bg-gray-50">
        <div className="text-center mb-16">
          <h2 className="text-[42px] font-bold text-primary-700 mb-4">Specialty</h2>
          <p className="text-gray-500 text-lg max-w-[800px] mx-auto">
            AISH만의 차별화된 교육 가치를 경험하세요.
          </p>
        </div>

        <div className="w-[90%] max-w-[1200px] mx-auto flex flex-col md:flex-row justify-center gap-6">
          {specialtyCardsResolved.map((card) => (
            <div
              key={card.subtitle}
              ref={addRevealRef}
              className="flex-1 rounded overflow-hidden bg-white border border-gray-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
            >
              <div className="h-[220px] overflow-hidden">
                <img
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                />
              </div>
              <div className="p-7 md:p-8">
                <h4 className="text-xl font-bold text-primary-700 mb-3">{card.title}</h4>
                <p className="text-[15px] text-gray-600 leading-relaxed">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── S5: 숫자 실적 ── */}
      <section className="py-20 md:py-24">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {stats.map((stat) => {
              const Icon = STAT_ICONS[stat.icon] || Users;
              return (
                <div key={stat.label} className="bg-white p-8 text-center" ref={addRevealRef}>
                  <Icon size={28} className="text-primary-600 mx-auto mb-3" />
                  <div className="text-3xl md:text-4xl font-bold text-gray-900">
                    {stat.value.toLocaleString()}
                    <span className="text-base text-gray-400 font-medium ml-0.5">{stat.unit}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── S6: 워크톤 + 쇼룸 (2분할) ── */}
      <section className="flex flex-col md:flex-row min-h-[550px]">
        {/* 쇼룸 패널 */}
        <div className="flex-1 relative flex items-center px-[6%] md:px-[8%] py-16 text-white overflow-hidden">
          <img
            src={workathon.posterUrl || "/images/defaults/workathon-bg.jpg"}
            alt="Smart Workathon"
            className="absolute inset-0 w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-primary-700/60" />
          <div className="relative z-10">
            <p className="text-primary-300 text-xs font-semibold tracking-widest uppercase mb-3">
              Smart Workathon
            </p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-5">
              {workathon.title}
            </h2>
            <p className="text-white/80 text-base leading-relaxed max-w-[400px]">
              {workathon.description}
            </p>
            <div className="mt-5 flex items-center gap-4 text-sm text-white/60">
              <span className="text-white font-bold text-xl">{dDay}</span>
              <span className="w-px h-4 bg-white/30" />
              <span>{workathon.eventDate}</span>
              <span className="w-px h-4 bg-white/30" />
              <span>{workathon.venue}</span>
            </div>
            <Link
              href="/workathon"
              className="mt-7 inline-flex items-center justify-center w-[60px] h-[60px] rounded-full bg-white text-primary-700 text-2xl font-bold hover:bg-primary-500 hover:text-white hover:-rotate-45 transition-all duration-300"
            >
              &#10148;
            </Link>
          </div>
        </div>

        {/* 워크톤 상세 패널 */}
        <div className="flex-1 bg-white p-12 md:p-16 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-8">
            <Trophy size={28} className="text-primary-600" />
            <h3 className="text-2xl font-bold text-gray-900">참가 현황</h3>
          </div>

          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>현재 참가자</span>
              <span className="font-bold text-primary-600">
                {workathon.currentParticipantCount}/{workathon.maxParticipants}명
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-1000"
                style={{ width: `${(workathon.currentParticipantCount / workathon.maxParticipants) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            {(workathon.schedule || []).slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-center gap-4 text-sm">
                <span className="text-gray-400 font-medium w-[120px] shrink-0">{item.time}</span>
                <span className="text-gray-700 font-medium">{item.title}</span>
              </div>
            ))}
          </div>

          <Link
            href="/workathon"
            className="mt-8 inline-flex items-center gap-2 text-primary-600 font-semibold text-sm hover:text-primary-700 transition-colors"
          >
            워크톤 자세히 보기
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── S7: 교육 프로그램 카드 (Runmoa 연동 + Firestore 폴백) ── */}
      <section className="py-24 md:py-28 bg-gray-50">
        <div className="container-custom">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-[42px] font-bold text-primary-700 tracking-tight">Program</h2>
              <p className="mt-2 text-gray-500 text-lg">진행중인 교육 과정</p>
            </div>
            <Link
              href="/programs"
              className="hidden md:inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors font-medium"
            >
              전체 보기
              <ChevronRight size={16} />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {runmoaPrograms.length > 0
              ? runmoaPrograms.slice(0, 8).map((c) => (
                  <a
                    key={c.content_id}
                    href={`https://aish.runmoa.com/classes/${c.content_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    ref={addRevealRef}
                    className="group bg-white rounded overflow-hidden border border-gray-200/80 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden">
                      {c.featured_image ? (
                        <img src={c.featured_image} alt={c.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen size={36} className="text-gray-300" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
                          {RUNMOA_CONTENT_TYPE_LABELS[c.content_type] ?? c.content_type}
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-xs text-gray-400 mb-1">
                        {c.categories.map((cat) => cat.name).join(", ") || "교육과정"}
                      </p>
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-1">
                        {c.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {c.is_free ? "무료" : c.is_on_sale && c.sale_price > 0 ? `₩${c.sale_price.toLocaleString("ko-KR")}` : c.base_price > 0 ? `₩${c.base_price.toLocaleString("ko-KR")}` : ""}
                      </p>
                    </div>
                  </a>
                ))
              : programs.filter((p) => p.status !== "CLOSED").map((program) => (
                  <Link
                    key={program.id}
                    href={`/programs#${program.id}`}
                    ref={addRevealRef}
                    className="group bg-white rounded overflow-hidden border border-gray-200/80 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center relative">
                      <BookOpen size={36} className="text-gray-300" />
                      <div className="absolute top-3 left-3">
                        <StatusBadge status={program.status} />
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-xs text-gray-400 mb-1">
                        {PROGRAM_CATEGORY_LABELS[program.category] ?? program.category}
                      </p>
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-1">
                        {program.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{program.summary}</p>
                    </div>
                  </Link>
                ))}
          </div>

          <div className="text-center mt-10 md:hidden">
            <Link
              href="/programs"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors font-medium"
            >
              전체 보기
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── S7.2: Event 섹션 ── */}
      {adminEvents.length > 0 && (
        <section className="py-24 md:py-28">
          <div className="container-custom">
            <div className="flex items-end justify-between mb-12">
              <div>
                <h2 className="text-[42px] font-bold text-primary-700 tracking-tight">Event</h2>
                <p className="mt-2 text-gray-500 text-lg">진행 예정 행사 및 이벤트</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adminEvents.slice(0, 6).map((evt) => (
                <div
                  key={evt.id}
                  ref={addRevealRef}
                  className="bg-white rounded-xl overflow-hidden border border-gray-200/80 hover:shadow-lg transition-shadow"
                >
                  {evt.thumbnailUrl ? (
                    <div className="h-40 overflow-hidden">
                      <img src={evt.thumbnailUrl} alt={evt.title} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className="h-40 bg-gradient-to-br from-primary-50 to-blue-50 flex items-center justify-center">
                      <Trophy size={36} className="text-primary-300" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", EVENT_STATUS_COLORS[evt.status] ?? "bg-gray-100 text-gray-600")}>
                        {EVENT_STATUS_LABELS[evt.status] ?? evt.status}
                      </span>
                      {evt.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{tag}</span>
                      ))}
                    </div>
                    <h3 className="text-base font-bold text-gray-900 line-clamp-1">{evt.title}</h3>
                    {evt.summary && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{evt.summary}</p>}
                    <div className="mt-3 text-xs text-gray-500 space-y-0.5">
                      <p>{evt.startDate} ~ {evt.endDate}</p>
                      {evt.organizer && <p>주관: {evt.organizer}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── S7.5: Featured Videos ── */}
      {featuredVideos.length > 0 && (
        <section className="py-24 md:py-28">
          <div className="container-custom">
            <div className="flex items-end justify-between mb-12">
              <div>
                <h2 className="text-[42px] font-bold text-primary-700 tracking-tight">Video</h2>
                <p className="mt-2 text-gray-500 text-lg">주요 교육 영상</p>
              </div>
              <Link href="/videos" className="hidden md:inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors font-medium">
                전체 보기 <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {featuredVideos.map((video) => {
                const thumb = (video as { thumbnailUrl?: string }).thumbnailUrl;
                return (
                  <a key={video.id} href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" ref={addRevealRef}
                    className="group bg-white rounded overflow-hidden border border-gray-200/80 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="aspect-video bg-gray-100 relative overflow-hidden">
                      <YouTubeThumbnailImage
                        videoUrl={video.youtubeUrl}
                        alt={video.title}
                        preferredThumbnailUrl={thumb}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                          <Play size={20} className="text-primary-600 ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2">{video.title}</h3>
                    </div>
                  </a>
                );
              })}
            </div>
            <div className="text-center mt-10 md:hidden">
              <Link href="/videos" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors font-medium">
                전체 보기 <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── S8: 수강생 후기 ── */}
      <section className="py-24 md:py-28">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-[42px] font-bold text-primary-700 tracking-tight">Review</h2>
            <p className="mt-3 text-gray-500 text-lg">수강생들의 생생한 후기</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {reviews.map((review, index) => (
              <div
                key={index}
                ref={addRevealRef}
                className="bg-white rounded-lg p-6 border border-gray-200/80 hover:shadow-md transition-shadow"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={i < review.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{review.content}</p>
                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
                    <span className="text-primary-600 font-semibold text-xs">{review.authorName.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{review.authorName}</p>
                    <p className="text-[11px] text-gray-400">{review.authorCohort}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── S9: 커뮤니티 아이콘 바 ── */}
      <section className="py-16 md:py-20 bg-white border-t border-gray-100">
        <div className="container-custom">
          <div className="flex flex-wrap justify-center gap-8 md:gap-0 md:divide-x md:divide-gray-200">
            {COMMUNITY_SHORTCUTS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex flex-col items-center gap-3 px-8 md:px-12 py-4 hover:opacity-80 transition-opacity"
              >
                <item.icon size={40} strokeWidth={1.2} className="text-primary-500 group-hover:text-primary-600 transition-colors" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-primary-600 transition-colors">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── S10: NewsRoom + CTA (2분할) ── */}
      <section className="flex flex-col md:flex-row min-h-[500px] bg-gray-50">
        {/* CTA / Showroom 패널 */}
        <div className="flex-1 bg-[#1a1a2e] p-12 md:p-16 flex flex-col justify-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-5">
            AI 시대,
            <br />
            지금 시작하세요
          </h2>
          <p className="text-white/60 text-base leading-relaxed max-w-[400px] mb-8">
            AISH와 함께라면 누구나 AI 전문가로 성장할 수 있습니다.
            무료 정규 과정부터 실무 프로젝트까지, 단계별로 설계된 커리큘럼이 준비되어 있습니다.
          </p>
          <div>
            <a
              href={ctaCfg.buttonUrl}
              target={isExternalHref(ctaCfg.buttonUrl) ? "_blank" : undefined}
              rel={isExternalHref(ctaCfg.buttonUrl) ? "noopener noreferrer" : undefined}
              className="inline-flex items-center justify-center w-[60px] h-[60px] rounded-full bg-white text-primary-700 text-2xl font-bold hover:bg-primary-500 hover:text-white hover:-rotate-45 transition-all duration-300"
            >
              &#10148;
            </a>
          </div>
        </div>

        {/* 뉴스룸 패널 */}
        <div className="flex-1 bg-white p-12 md:p-16">
          <div className="flex items-end justify-between border-b-2 border-primary-700 pb-5 mb-8">
            <h3 className="text-[28px] font-bold text-gray-900">NewsRoom</h3>
            <Link
              href="/community?tab=notice"
              className="text-sm text-gray-500 hover:text-primary-600 transition-colors"
            >
              전체보기 +
            </Link>
          </div>
          <ul className="space-y-0">
            {notices.map((notice, index) => (
              <li key={index}>
                <Link
                  href="/community?tab=notice"
                  className="flex items-center justify-between py-5 border-b border-gray-100 hover:pl-2.5 hover:text-primary-500 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-primary-600 shrink-0">[{notice.tag}]</span>
                    <span className="text-sm text-gray-700 group-hover:text-primary-600 truncate transition-colors">
                      {notice.title}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400 shrink-0 ml-4">{notice.date}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
