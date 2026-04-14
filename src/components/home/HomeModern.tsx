"use client";

import Link from "next/link";
import {
  ChevronRight, Star, Users, ArrowRight, Calendar, Award, Play,
  BookOpen, MessageCircle,
} from "lucide-react";
import { PROGRAM_CATEGORY_LABELS, RUNMOA_CONTENT_TYPE_LABELS } from "@/lib/constants";
import { calculateDDay, cn, isExternalHref } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import YouTubeThumbnailImage from "@/components/ui/YouTubeThumbnailImage";
import DriveOrExternalImage from "@/components/ui/DriveOrExternalImage";
import type { HomeDataProps } from "@/hooks/useHomeData";

function Badge({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "secondary" | "accent" }) {
  const styles = {
    primary: "bg-brand-blue/10 text-brand-blue",
    secondary: "bg-gray-100 text-gray-800",
    accent: "bg-indigo-100 text-indigo-800",
  };
  return (
    <span className={cn("px-2.5 py-1 rounded-sm text-xs font-semibold", styles[variant])}>
      {children}
    </span>
  );
}

export default function HomeModern(props: HomeDataProps) {
  const {
    router, searchTerm, setSearchTerm,
    stats, programs, runmoaPrograms,
    reviews, workathon, notices, featuredVideos,
    heroSlides, heroIndex, setHeroIndex,
    siteBanner, ctaCfg, instructors,
    dDay, addRevealRef, currentHero,
    primaryCtaHref, primaryCtaLabel,
    latestContents,
  } = props;

  return (
    <>
      {/* 배너 */}
      {siteBanner?.enabled && siteBanner.title && siteBanner.dDayDate && (() => {
        const bannerHref = siteBanner.link?.trim() || "/workathon";
        const external = isExternalHref(bannerHref);
        const bannerDDay = calculateDDay(siteBanner.dDayDate);
        return (
          <div className="bg-brand-dark text-white text-center text-sm" role="banner">
            {external ? (
              <a href={bannerHref} className="block w-full py-3 px-4 hover:bg-brand-dark/50 transition-colors font-medium"
                target="_blank" rel="noopener noreferrer">
                {siteBanner.title} · {bannerDDay}
              </a>
            ) : (
              <Link href={bannerHref} className="block w-full py-3 px-4 hover:bg-brand-dark/50 transition-colors font-medium">
                {siteBanner.title} · {bannerDDay}
              </Link>
            )}
          </div>
        );
      })()}

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-gray-900 via-brand-blue/90 to-brand-blue text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="w-full h-full" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 relative z-10 flex flex-col md:flex-row items-center">
          <div className="w-full md:w-1/2 pr-0 md:pr-8 text-center md:text-left">
            {siteBanner?.enabled && siteBanner.dDayDate && (
              <Badge variant="accent">AISH 스마트워크톤 {dDay}</Badge>
            )}
            <h1 className="mt-6 text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight whitespace-pre-line">
              {currentHero?.title || "실무형 인재로 성장하는\n가장 빠른 길"}
            </h1>
            <p className="mt-4 text-lg md:text-xl text-blue-100 font-light max-w-2xl mx-auto md:mx-0 whitespace-pre-line">
              {currentHero?.subtitle || "현업 최고 수준의 전문가들의 인사이트와 살아있는 실무 프로젝트를 AISH 커뮤니티에서 경험하세요."}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center md:justify-start space-y-3 sm:space-y-0 sm:space-x-4">
              <a
                href={primaryCtaHref}
                target={isExternalHref(primaryCtaHref) ? "_blank" : undefined}
                rel={isExternalHref(primaryCtaHref) ? "noopener noreferrer" : undefined}
                className="bg-white text-brand-blue px-6 py-3 rounded-sm font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg flex items-center justify-center"
              >
                {primaryCtaLabel}
              </a>
              <Link href="/workathon"
                className="border border-white/30 bg-white/10 text-white px-6 py-3 rounded-sm font-bold text-lg hover:bg-white/20 transition-colors backdrop-blur-sm flex items-center justify-center">
                스마트워크톤 알아보기 <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </div>
            {heroSlides.length > 1 && (
              <div className="mt-8 flex gap-2 justify-center md:justify-start">
                {heroSlides.map((_, i) => (
                  <button key={i} type="button" aria-label={`슬라이드 ${i + 1}`} onClick={() => setHeroIndex(i)} className="p-2">
                    <span className={cn("block h-2 rounded-full transition-all", i === heroIndex ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60")} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-full md:w-1/2 mt-12 md:mt-0 relative hidden md:block">
            {currentHero?.imageUrl && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-sm p-4 shadow-2xl">
                <img src={currentHero.imageUrl} alt="" className="w-full h-64 md:h-80 rounded-sm object-cover" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 교육 프로그램 */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">맞춤형 실무 교육</h2>
              <p className="mt-2 text-gray-600">당신의 커리어를 한 단계 성장시켜줄 핵심 강의</p>
            </div>
            <Link href="/programs" className="hidden sm:flex items-center text-brand-blue font-medium hover:text-brand-blue/80 transition-colors">
              전체 보기 <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {runmoaPrograms.length > 0
              ? runmoaPrograms.slice(0, 4).map((c) => (
                <a key={c.content_id} href={`https://aish.runmoa.com/classes/${c.content_id}`} target="_blank" rel="noopener noreferrer" ref={addRevealRef}
                  className="group flex flex-col bg-white rounded-sm border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer">
                  <div className="relative h-40 w-full bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden">
                    {c.featured_image ? (
                      <img src={c.featured_image} alt={c.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><BookOpen size={36} className="text-gray-300" /></div>
                    )}
                    <div className="absolute top-2 left-2 flex space-x-1">
                      <span className="bg-white/90 backdrop-blur text-gray-800 text-xs font-bold px-2 py-1 rounded-sm shadow-sm">
                        {RUNMOA_CONTENT_TYPE_LABELS[c.content_type] ?? c.content_type}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-grow">
                    <h3 className="text-lg font-bold text-gray-900 leading-snug group-hover:text-brand-blue transition-colors line-clamp-2">{c.title}</h3>
                    <p className="text-sm text-gray-500 mt-2">{c.categories.map((cat) => cat.name).join(", ") || "교육과정"}</p>
                    <div className="mt-auto pt-4">
                      {c.is_free ? <span className="text-sm font-semibold text-green-600">무료</span>
                        : c.is_on_sale && c.sale_price > 0 ? <span className="text-sm font-semibold text-gray-900">₩{c.sale_price.toLocaleString("ko-KR")}</span>
                        : c.base_price > 0 ? <span className="text-sm font-semibold text-gray-900">₩{c.base_price.toLocaleString("ko-KR")}</span> : null}
                    </div>
                  </div>
                </a>
              ))
              : programs.filter((p) => p.status !== "CLOSED").slice(0, 4).map((program) => (
                <Link key={program.id} href={`/programs#${program.id}`} ref={addRevealRef}
                  className="group flex flex-col bg-white rounded-sm border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer">
                  <div className="relative h-40 w-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                    <BookOpen size={36} className="text-gray-300" />
                    <div className="absolute top-2 left-2"><StatusBadge status={program.status} /></div>
                  </div>
                  <div className="p-5 flex flex-col flex-grow">
                    <h3 className="text-lg font-bold text-gray-900 leading-snug group-hover:text-brand-blue transition-colors line-clamp-2">{program.title}</h3>
                    <p className="text-sm text-gray-500 mt-2">{PROGRAM_CATEGORY_LABELS[program.category] ?? program.category}</p>
                    <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{program.summary}</p>
                  </div>
                </Link>
              ))}
          </div>
          <Link href="/programs" className="w-full sm:hidden mt-6 bg-gray-50 border border-gray-200 text-gray-700 py-3 rounded-sm font-medium flex items-center justify-center">
            전체 강의 보기 <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </section>

      {/* 워크톤 + 커뮤니티 뉴스 2분할 */}
      <section className="py-16 bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* 워크톤 하이라이트 */}
            <div className="bg-brand-blue rounded-sm p-8 text-white flex flex-col justify-between shadow-lg relative overflow-hidden group cursor-pointer">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                <Users size={240} />
              </div>
              <div className="relative z-10">
                <Badge variant="secondary"><span className="text-brand-blue">{dDay} 마감임박</span></Badge>
                <h2 className="mt-4 text-3xl font-bold leading-tight">{workathon.title}</h2>
                <p className="mt-4 text-blue-100">{workathon.description}</p>
                <ul className="mt-6 space-y-2 text-sm text-blue-50">
                  <li className="flex items-center"><Calendar className="w-4 h-4 mr-2" /> 일시: {workathon.eventDate}</li>
                  <li className="flex items-center"><Award className="w-4 h-4 mr-2" /> 장소: {workathon.venue}</li>
                </ul>
              </div>
              <div className="mt-8 relative z-10">
                <Link href="/workathon" className="bg-white text-brand-blue px-5 py-2.5 rounded-sm font-bold flex items-center w-fit group-hover:bg-gray-100 transition-colors shadow-md">
                  상세 정보 및 참가 신청 <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </div>

            {/* 커뮤니티 라이브 피드 */}
            <div className="bg-white rounded-sm p-8 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <MessageCircle className="w-6 h-6 mr-2 text-brand-blue" /> NewsRoom
                </h2>
                <Link href="/community?tab=notice" className="text-sm font-medium text-gray-500 hover:text-brand-blue">더보기</Link>
              </div>
              <div className="space-y-4">
                {notices.map((notice, idx) => (
                  <Link key={idx} href="/community?tab=notice"
                    className="group flex items-start justify-between p-3 rounded-sm hover:bg-gray-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-sm bg-brand-blue/10 text-brand-blue">{notice.tag}</span>
                        <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-brand-blue">{notice.title}</h3>
                      </div>
                      <div className="text-xs text-gray-500">{notice.date}</div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100">
                <Link href="/community" className="w-full bg-brand-blue/5 text-brand-blue py-3 rounded-sm font-semibold hover:bg-brand-blue/10 transition-colors block text-center">
                  커뮤니티 바로가기
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* AI실전마스터 */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">현업 최고 수준의 AI실전마스터</h2>
            <p className="mt-2 text-gray-600">이론이 아닌 진짜 실무를 경험한 전문가들과 함께하세요.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {instructors.slice(0, 4).map((ins) => (
              <Link key={ins.id} href="/instructors" ref={addRevealRef}
                className="flex flex-col items-center text-center p-6 bg-gray-50 rounded-sm hover:bg-white hover:shadow-lg transition-all duration-300 border border-transparent hover:border-gray-100 cursor-pointer">
                <div className="w-24 h-24 rounded-full shadow-md mb-4 overflow-hidden bg-gradient-to-br from-brand-gray to-gray-200">
                  {(ins.imageUrl || ins.profileImageUrl) ? (
                    <DriveOrExternalImage src={(ins.imageUrl || ins.profileImageUrl)!} alt={ins.name} className="w-full h-full object-cover" quiet />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-brand-blue">{ins.name.charAt(0)}</span>
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-bold text-gray-900">{ins.name}</h3>
                {ins.title && <p className="text-sm text-brand-blue font-medium mt-1 line-clamp-2">{ins.title}</p>}
                {ins.bio && <p className="text-sm text-gray-500 mt-3 line-clamp-3">{ins.bio}</p>}
              </Link>
            ))}
          </div>
          {instructors.length > 4 && (
            <div className="text-center mt-10">
              <Link href="/instructors" className={cn("inline-flex items-center gap-2 px-6 py-3 rounded-full", "text-sm font-semibold text-brand-blue border border-brand-blue/20", "hover:bg-brand-blue/5 transition-colors")}>
                전체 전문가 보기 <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 인사이트 (다크 섹션) — 콘텐츠/비디오 + 수강 후기 */}
      {(latestContents.length > 0 || featuredVideos.length > 0 || reviews.length > 0) && (
        <section className="py-16 bg-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* 콘텐츠 우선, 없으면 비디오 */}
            {latestContents.length > 0 ? (
              <>
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-3xl font-bold">실무에 바로 쓰는 인사이트</h2>
                    <p className="mt-2 text-gray-400">AISH가 큐레이션한 AI 콘텐츠를 만나보세요.</p>
                  </div>
                  <Link href="/media" className="hidden sm:flex items-center text-gray-300 hover:text-white transition-colors">
                    전체보기 <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                  {latestContents.map((content) => (
                    <Link key={content.id} href="/media" ref={addRevealRef}
                      className="bg-gray-800 rounded-sm p-5 hover:bg-gray-700 transition-colors cursor-pointer border border-gray-700">
                      {content.mediaType === "youtube" && content.thumbnailUrl && (
                        <div className="aspect-video rounded-sm overflow-hidden mb-3 relative">
                          <img src={content.thumbnailUrl} alt={content.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                              <Play className="w-4 h-4 text-gray-900 ml-0.5" />
                            </div>
                          </div>
                        </div>
                      )}
                      <h3 className="text-base font-bold leading-snug line-clamp-2">{content.title}</h3>
                      {content.body && <p className="text-sm text-gray-400 mt-2 line-clamp-2">{content.body}</p>}
                      {content.tags && content.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {content.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">{tag}</span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </>
            ) : featuredVideos.length > 0 ? (
              <>
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-3xl font-bold">실무에 바로 쓰는 인사이트</h2>
                    <p className="mt-2 text-gray-400">AISH가 큐레이션한 교육 영상을 만나보세요.</p>
                  </div>
                  <Link href="/videos" className="hidden sm:flex items-center text-gray-300 hover:text-white transition-colors">
                    전체보기 <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                  {featuredVideos[0] && (
                    <a href={featuredVideos[0].youtubeUrl} target="_blank" rel="noopener noreferrer"
                      className="md:col-span-2 relative rounded-sm overflow-hidden group cursor-pointer h-64 md:h-80">
                      <div className="absolute inset-0">
                        <YouTubeThumbnailImage videoUrl={featuredVideos[0].youtubeUrl} alt={featuredVideos[0].title} preferredThumbnailUrl={featuredVideos[0].thumbnailUrl} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-0 p-6 w-full">
                        <h3 className="text-2xl font-bold mt-3 group-hover:text-blue-300 transition-colors">{featuredVideos[0].title}</h3>
                        <div className="mt-4 flex items-center text-sm font-medium text-white">
                          <Play className="w-5 h-5 mr-2" /> 영상 보기
                        </div>
                      </div>
                    </a>
                  )}
                  <div className="flex flex-col space-y-6">
                    {featuredVideos.slice(1, 3).map((video) => (
                      <a key={video.id} href={video.youtubeUrl} target="_blank" rel="noopener noreferrer"
                        className="flex-1 bg-gray-800 rounded-sm p-5 hover:bg-gray-700 transition-colors cursor-pointer border border-gray-700">
                        <h3 className="text-lg font-bold leading-snug line-clamp-2">{video.title}</h3>
                        <div className="mt-3 flex items-center text-sm text-gray-400">
                          <Play className="w-4 h-4 mr-1" /> 영상 보기
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {/* 수강 후기 */}
            {reviews.length > 0 && (
              <div className={featuredVideos.length > 0 ? "pt-8 border-t border-gray-700" : ""}>
                <h3 className="text-2xl font-bold mb-6">수강생 후기</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {reviews.slice(0, 4).map((review, index) => (
                    <div key={index} ref={addRevealRef} className="bg-gray-800 rounded-sm p-5 border border-gray-700">
                      <div className="flex gap-0.5 mb-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={14} className={i < review.rating ? "text-amber-400 fill-amber-400" : "text-gray-600"} />
                        ))}
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed line-clamp-4">{review.content}</p>
                      <div className="mt-4 pt-3 border-t border-gray-700 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center">
                          <span className="text-brand-lightBlue font-semibold text-xs">{review.authorName.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-200">{review.authorName}</p>
                          <p className="text-[11px] text-gray-500">{review.authorCohort}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 숫자 실적 */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} ref={addRevealRef} className="text-center p-6 rounded-sm border border-gray-100">
                <div className="text-3xl md:text-4xl font-bold text-gray-900">
                  {stat.value.toLocaleString()}
                  <span className="text-base text-gray-400 font-medium ml-0.5">{stat.unit}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-16 bg-gray-50 border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
            AI 시대, 지금 시작하세요
          </h2>
          <p className="mt-4 text-gray-600 text-lg max-w-xl mx-auto">
            AISH와 함께라면 누구나 AI 전문가로 성장할 수 있습니다.
            무료 정규 과정부터 실무 프로젝트까지, 단계별로 설계된 커리큘럼이 준비되어 있습니다.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <a
              href={ctaCfg.buttonUrl}
              target={isExternalHref(ctaCfg.buttonUrl) ? "_blank" : undefined}
              rel={isExternalHref(ctaCfg.buttonUrl) ? "noopener noreferrer" : undefined}
              className="bg-brand-blue text-white px-8 py-3.5 rounded-sm font-bold text-lg hover:bg-brand-blue/90 transition-colors shadow-lg"
            >
              {ctaCfg.buttonText}
            </a>
            <Link href="/about" className="border border-gray-300 text-gray-700 px-8 py-3.5 rounded-sm font-bold text-lg hover:bg-gray-100 transition-colors">
              AISH 소개 보기
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
