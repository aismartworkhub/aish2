"use client";

import Link from "next/link";
import {
  ArrowRight, Search, SlidersHorizontal, ChevronRight,
  Star, Play, BookOpen, Trophy,
} from "lucide-react";
import { PROGRAM_CATEGORY_LABELS, EVENT_STATUS_LABELS, EVENT_STATUS_COLORS, RUNMOA_CONTENT_TYPE_LABELS } from "@/lib/constants";
import { calculateDDay, cn, isExternalHref } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import YouTubeThumbnailImage from "@/components/ui/YouTubeThumbnailImage";
import DriveOrExternalImage from "@/components/ui/DriveOrExternalImage";
import { STAT_ICONS, COMMUNITY_SHORTCUTS } from "@/hooks/useHomeData";
import type { HomeDataProps } from "@/hooks/useHomeData";

export default function HomeDefault(props: HomeDataProps) {
  const {
    router, searchTerm, setSearchTerm,
    stats, programs, runmoaPrograms, adminEvents,
    reviews, workathon, notices, featuredVideos,
    heroSlides, heroIndex, setHeroIndex,
    siteBanner, ctaCfg, pageContent, instructors,
    dDay, addRevealRef,
    specialtyCardsResolved, currentHero,
    primaryCtaHref, primaryCtaLabel,
  } = props;

  return (
    <>
      {siteBanner?.enabled && siteBanner.title && siteBanner.dDayDate && (() => {
        const bannerHref = siteBanner.link?.trim() || "/workathon";
        const external = isExternalHref(bannerHref);
        const bannerDDay = calculateDDay(siteBanner.dDayDate);
        return (
          <div className="bg-brand-dark text-white text-center text-sm" role="banner">
            {external ? (
              <a
                href={bannerHref}
                className="block w-full py-3 px-4 hover:bg-brand-dark/50 transition-colors font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                {siteBanner.title} · {bannerDDay}
              </a>
            ) : (
              <Link
                href={bannerHref}
                className="block w-full py-3 px-4 hover:bg-brand-dark/50 transition-colors font-medium"
              >
                {siteBanner.title} · {bannerDDay}
              </Link>
            )}
          </div>
        );
      })()}

      {/* S1: 히어로 */}
      <section className="relative h-[85vh] min-h-[600px] overflow-hidden">
        <img
          src={currentHero?.imageUrl || "/images/defaults/hero-main.jpg"}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[rgba(0,75,147,0.85)] to-transparent" />

        <div className="relative z-10 h-full flex items-center">
          <div className="ml-[8%] md:ml-[10%] max-w-[700px] text-white">
            <p className="text-brand-lightBlue text-sm font-medium tracking-widest uppercase mb-4">
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
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-brand-blue text-white text-base font-medium rounded-sm uppercase tracking-widest hover:bg-brand-lightBlue transition-colors"
              >
                {primaryCtaLabel}
                <ArrowRight size={18} />
              </a>
            </div>
            {heroSlides.length > 1 && (
              <div className="mt-8 flex gap-2">
                {heroSlides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`슬라이드 ${i + 1}`}
                    onClick={() => setHeroIndex(i)}
                    className="p-2"
                  >
                    <span className={cn(
                      "block h-2 rounded-full transition-all",
                      i === heroIndex ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
                    )} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* S2: 검색 섹션 */}
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
                className="text-gray-500 hover:text-brand-blue transition-colors"
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
          <div className="flex-1 bg-brand-blue p-8 md:p-11 text-white">
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

      {/* S3: 실무전문가 */}
      <section className="py-24 md:py-28">
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-[42px] font-bold text-brand-blue uppercase tracking-tight mb-4">
            {pageContent.sections.education?.title ?? "실무전문가"}
          </h2>
          <p className="text-gray-500 text-lg max-w-[800px] mx-auto">
            {pageContent.sections.education?.description ?? "각 분야 현업 전문가가 여러분의 성장을 이끕니다."}
          </p>
        </div>

        <div className={cn("max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6")}>
          {instructors.map((ins) => (
            <Link
              key={ins.id}
              href="/instructors"
              ref={addRevealRef}
              className={cn(
                "bg-white rounded-sm border border-brand-border shadow-sm overflow-hidden group",
                "cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              )}
            >
              <div className={cn("relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-brand-gray to-gray-200")}>
                {(ins.imageUrl || ins.profileImageUrl) ? (
                  <DriveOrExternalImage
                    src={(ins.imageUrl || ins.profileImageUrl)!}
                    alt={ins.name}
                    className={cn("w-full h-full object-cover object-top")}
                    quiet
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-gray to-gray-200">
                    <span className="text-5xl font-bold text-brand-blue">{ins.name.charAt(0)}</span>
                  </div>
                )}
                <div className={cn("absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent")} />
              </div>

              <div className={cn("px-6 py-4")}>
                <div className={cn("mb-3 min-w-0")}>
                  <h3 className={cn("text-xl font-bold text-gray-900 tracking-tighter leading-tight")}>
                    {ins.name}
                  </h3>
                  {ins.title && (
                    <p className={cn("mt-0.5 text-sm font-bold text-brand-blue tracking-tighter line-clamp-2 break-keep")}>
                      {ins.title}
                    </p>
                  )}
                </div>

                {(ins.specialties || []).length > 0 && (
                  <div className={cn("space-y-0.5 mb-3")}>
                    {(ins.specialties || []).slice(0, 3).map((s, i) => (
                      <div key={i} className={cn("flex items-center gap-2.5 py-0.5")}>
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-brand-blue" />
                        <span className={cn("text-[13px] text-gray-700 font-medium truncate tracking-tighter")}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                {ins.bio && (
                  <div className={cn("bg-brand-gray/60 rounded-xl px-3.5 py-2.5 max-h-[5rem] overflow-hidden")}>
                    <p className={cn(
                      "text-[13px] text-gray-600 italic leading-snug text-center tracking-tighter font-medium",
                      "line-clamp-3 break-keep"
                    )}>
                      &ldquo;{ins.bio}&rdquo;
                    </p>
                  </div>
                )}
              </div>
              <div className="px-6 pb-3">
                <span className="text-xs text-brand-blue font-medium group-hover:underline">프로필 보기 →</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/instructors"
            className={cn(
              "inline-flex items-center gap-2 px-6 py-3 rounded-full",
              "text-sm font-semibold text-brand-blue border border-brand-blue/20",
              "hover:bg-brand-blue/5 transition-colors"
            )}
          >
            전체 전문가 보기
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* S4: Specialty */}
      <section className="py-24 md:py-28 bg-brand-gray">
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-[42px] font-bold text-brand-blue uppercase tracking-tight mb-4">
            {pageContent.sections.specialty?.title ?? "Specialty"}
          </h2>
          <p className="text-gray-500 text-lg max-w-[800px] mx-auto">
            {pageContent.sections.specialty?.description ?? "AISH만의 차별화된 교육 가치를 경험하세요."}
          </p>
        </div>

        <div className="w-[90%] max-w-[1200px] mx-auto flex flex-col md:flex-row justify-center gap-6">
          {specialtyCardsResolved.map((card) => (
            <div
              key={card.subtitle}
              ref={addRevealRef}
              className="flex-1 rounded overflow-hidden bg-white border border-brand-border shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
            >
              <div className="h-[220px] overflow-hidden">
                <img
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                />
              </div>
              <div className="p-7 md:p-8">
                <h4 className="text-xl font-bold text-brand-blue mb-3">{card.title}</h4>
                <p className="text-[15px] text-gray-600 leading-relaxed">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* S5: 숫자 실적 */}
      <section className="py-20 md:py-24">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200 rounded-sm overflow-hidden">
            {stats.map((stat) => {
              const Icon = STAT_ICONS[stat.icon] || Star;
              return (
                <div key={stat.label} className="bg-white p-8 text-center" ref={addRevealRef}>
                  <Icon size={28} className="text-brand-blue mx-auto mb-3" />
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

      {/* S6: 워크톤 + 쇼룸 */}
      <section className="flex flex-col md:flex-row min-h-[550px]">
        <div className="flex-1 relative flex items-center px-[6%] md:px-[8%] py-16 text-white overflow-hidden">
          <img
            src={workathon.posterUrl || "/images/defaults/workathon-bg.jpg"}
            alt="Smart Workathon"
            className="absolute inset-0 w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-brand-blue/60" />
          <div className="relative z-10">
            <p className="text-brand-lightBlue text-xs font-semibold tracking-widest uppercase mb-3">Smart Workathon</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-5">{workathon.title}</h2>
            <p className="text-white/80 text-base leading-relaxed max-w-[400px]">{workathon.description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-white/60">
              <span className="text-white font-bold text-xl">{dDay}</span>
              <span className="w-px h-4 bg-white/30" />
              <span>{workathon.eventDate}</span>
              <span className="w-px h-4 bg-white/30" />
              <span>{workathon.venue}</span>
            </div>
            <Link
              href="/workathon"
              className="mt-7 inline-flex items-center justify-center w-[60px] h-[60px] rounded-full bg-white text-brand-blue text-2xl font-bold hover:bg-brand-blue hover:text-white hover:-rotate-45 transition-all duration-300"
            >
              &#10148;
            </Link>
          </div>
        </div>
        <div className="flex-1 bg-white p-12 md:p-16 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-8">
            <Trophy size={28} className="text-brand-blue" />
            <h3 className="text-2xl font-bold text-gray-900">참가 현황</h3>
          </div>
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>현재 참가자</span>
              <span className="font-bold text-brand-blue">{workathon.currentParticipantCount}/{workathon.maxParticipants}명</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-blue rounded-full transition-all duration-1000" style={{ width: `${(workathon.currentParticipantCount / workathon.maxParticipants) * 100}%` }} />
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
          <Link href="/workathon" className="mt-8 inline-flex items-center gap-2 text-brand-blue font-semibold text-sm hover:text-brand-blue transition-colors">
            워크톤 자세히 보기 <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* S7: 교육 프로그램 */}
      <section className="py-24 md:py-28 bg-brand-gray">
        <div className="container-custom">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-2xl md:text-[42px] font-bold text-brand-blue tracking-tight">Program</h2>
              <p className="mt-2 text-gray-500 text-lg">진행중인 교육 과정</p>
            </div>
            <Link href="/programs" className="hidden md:inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-blue transition-colors font-medium">
              전체 보기 <ChevronRight size={16} />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {runmoaPrograms.length > 0
              ? runmoaPrograms.slice(0, 8).map((c) => (
                  <a key={c.content_id} href={`https://aish.runmoa.com/classes/${c.content_id}`} target="_blank" rel="noopener noreferrer" ref={addRevealRef}
                    className="group bg-white rounded overflow-hidden border border-brand-border hover-lift">
                    <div className="aspect-[16/9] bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden">
                      {c.featured_image ? (
                        <img src={c.featured_image} alt={c.title} className="w-full h-full object-cover object-top" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><BookOpen size={36} className="text-gray-300" /></div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
                          {RUNMOA_CONTENT_TYPE_LABELS[c.content_type] ?? c.content_type}
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-xs text-gray-400 mb-1">{c.categories.map((cat) => cat.name).join(", ") || "교육과정"}</p>
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-brand-blue transition-colors line-clamp-1">{c.title}</h3>
                      <p className="mt-1.5">
                        {c.is_free ? <span className="text-sm font-semibold text-green-600">무료</span> : c.is_on_sale && c.sale_price > 0 ? <span className="text-sm font-semibold text-gray-900">₩{c.sale_price.toLocaleString("ko-KR")}</span> : c.base_price > 0 ? <span className="text-sm font-semibold text-gray-900">₩{c.base_price.toLocaleString("ko-KR")}</span> : null}
                      </p>
                    </div>
                  </a>
                ))
              : programs.filter((p) => p.status !== "CLOSED").map((program) => (
                  <Link key={program.id} href={`/programs#${program.id}`} ref={addRevealRef}
                    className="group bg-white rounded overflow-hidden border border-brand-border hover-lift">
                    <div className="aspect-[16/9] bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center relative">
                      <BookOpen size={36} className="text-gray-300" />
                      <div className="absolute top-3 left-3"><StatusBadge status={program.status} /></div>
                    </div>
                    <div className="p-5">
                      <p className="text-xs text-gray-400 mb-1">{PROGRAM_CATEGORY_LABELS[program.category] ?? program.category}</p>
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-brand-blue transition-colors line-clamp-1">{program.title}</h3>
                      <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{program.summary}</p>
                    </div>
                  </Link>
                ))}
          </div>
          <div className="text-center mt-10 md:hidden">
            <Link href="/programs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-blue transition-colors font-medium">
              전체 보기 <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* S7.2: Event */}
      {adminEvents.length > 0 && (
        <section className="py-24 md:py-28">
          <div className="container-custom">
            <div className="flex items-end justify-between mb-12">
              <div>
                <h2 className="text-2xl md:text-[42px] font-bold text-brand-blue tracking-tight">Event</h2>
                <p className="mt-2 text-gray-500 text-lg">진행 예정 행사 및 이벤트</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adminEvents.slice(0, 6).map((evt) => (
                <div key={evt.id} ref={addRevealRef}
                  className="bg-white rounded-sm overflow-hidden border border-brand-border hover:shadow-lg hover:border-t-4 hover:border-t-brand-blue transition-shadow">
                  {evt.thumbnailUrl ? (
                    <div className="h-40 overflow-hidden">
                      <img src={evt.thumbnailUrl} alt={evt.title} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className="h-40 bg-gradient-to-br from-brand-gray to-blue-50 flex items-center justify-center">
                      <Trophy size={36} className="text-brand-lightBlue" />
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

      {/* S7.5: Featured Videos */}
      {featuredVideos.length > 0 && (
        <section className="py-24 md:py-28">
          <div className="container-custom">
            <div className="flex items-end justify-between mb-12">
              <div>
                <h2 className="text-2xl md:text-[42px] font-bold text-brand-blue tracking-tight">Video</h2>
                <p className="mt-2 text-gray-500 text-lg">주요 교육 영상</p>
              </div>
              <Link href="/videos" className="hidden md:inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-blue transition-colors font-medium">
                전체 보기 <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {featuredVideos.map((video) => (
                <a key={video.id} href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" ref={addRevealRef}
                  className="group bg-white rounded overflow-hidden border border-brand-border hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="aspect-video bg-gray-100 relative overflow-hidden">
                    <YouTubeThumbnailImage videoUrl={video.youtubeUrl} alt={video.title} preferredThumbnailUrl={video.thumbnailUrl} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <Play size={20} className="text-brand-blue ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-gray-900 group-hover:text-brand-blue transition-colors line-clamp-2">{video.title}</h3>
                  </div>
                </a>
              ))}
            </div>
            <div className="text-center mt-10 md:hidden">
              <Link href="/videos" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-blue transition-colors font-medium">
                전체 보기 <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* S8: 수강생 후기 */}
      <section className="py-24 md:py-28">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-[42px] font-bold text-brand-blue tracking-tight">Review</h2>
            <p className="mt-3 text-gray-500 text-lg">수강생들의 생생한 후기</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {reviews.map((review, index) => (
              <div key={index} ref={addRevealRef} className="bg-white rounded-sm p-6 border border-brand-border hover:shadow-md transition-shadow">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} className={i < review.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"} />
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{review.content}</p>
                <div className="mt-5 pt-4 border-t border-brand-border flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-brand-gray flex items-center justify-center">
                    <span className="text-brand-blue font-semibold text-xs">{review.authorName.charAt(0)}</span>
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

      {/* S9: 커뮤니티 아이콘 바 */}
      <section className="py-16 md:py-20 bg-white border-t border-brand-border">
        <div className="container-custom">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
            {COMMUNITY_SHORTCUTS.map((item) => (
              <Link key={item.label} href={item.href}
                className="group flex min-h-[112px] flex-col items-center justify-center gap-3 rounded-xl border border-brand-border bg-brand-gray/40 px-4 py-5 text-center hover:border-brand-blue/30 hover:bg-white hover:shadow-sm transition-all">
                <item.icon size={34} strokeWidth={1.5} className="text-brand-blue transition-colors" />
                <span className="text-sm font-semibold text-gray-700 group-hover:text-brand-blue transition-colors">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* S10: NewsRoom + CTA */}
      <section className="flex flex-col md:flex-row min-h-[500px] bg-brand-gray">
        <div className="flex-1 bg-[#1a1a2e] p-12 md:p-16 flex flex-col justify-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-5">AI 시대,<br />지금 시작하세요</h2>
          <p className="text-white/60 text-base leading-relaxed max-w-[400px] mb-8">
            AISH와 함께라면 누구나 AI 전문가로 성장할 수 있습니다.
            무료 정규 과정부터 실무 프로젝트까지, 단계별로 설계된 커리큘럼이 준비되어 있습니다.
          </p>
          <div>
            <a href={ctaCfg.buttonUrl} target={isExternalHref(ctaCfg.buttonUrl) ? "_blank" : undefined} rel={isExternalHref(ctaCfg.buttonUrl) ? "noopener noreferrer" : undefined}
              className="inline-flex items-center justify-center w-[60px] h-[60px] rounded-full bg-white text-brand-blue text-2xl font-bold hover:bg-brand-blue hover:text-white hover:-rotate-45 transition-all duration-300">
              &#10148;
            </a>
          </div>
        </div>
        <div className="flex-1 bg-white p-12 md:p-16">
          <div className="flex items-end justify-between border-b-2 border-brand-blue pb-5 mb-8">
            <h3 className="text-[28px] font-bold text-gray-900">NewsRoom</h3>
            <Link href="/community?tab=notice" className="text-sm text-gray-500 hover:text-brand-blue transition-colors">전체보기 +</Link>
          </div>
          <ul className="space-y-0">
            {notices.map((notice, index) => (
              <li key={index}>
                <Link href="/community?tab=notice"
                  className="flex items-center justify-between py-5 border-b border-brand-border hover:pl-2.5 hover:text-brand-blue transition-all group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-brand-blue shrink-0">[{notice.tag}]</span>
                    <span className="text-sm text-gray-700 group-hover:text-brand-blue truncate transition-colors">{notice.title}</span>
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
