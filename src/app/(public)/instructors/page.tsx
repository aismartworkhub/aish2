"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search, X, Share2, Heart, PlayCircle, MessageSquare,
  UserPlus, Star, Mail, Award, GraduationCap, Briefcase,
  ExternalLink, Pencil, Send, Trash2, BookOpen, MessageCircle,
  User, ArrowLeft, Plus,
  Linkedin, Youtube, Instagram, Github, Globe,
} from "lucide-react";
import { DEMO_INSTRUCTORS } from "@/lib/demo-data";
import {
  getCollection, getFilteredCollection, createDoc, removeDoc,
  COLLECTIONS, invalidateCache,
} from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import LoginModal from "@/components/public/LoginModal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import DriveOrExternalImage from "@/components/ui/DriveOrExternalImage";
import type { InstructorComment } from "@/types/firestore";
import { getRunmoaContents, getRunmoaContentById } from "@/lib/runmoa-api";
import type { RunmoaContent } from "@/types/runmoa";
import { loadPageContent, DEFAULT_INSTRUCTORS } from "@/lib/page-content-public";
import type { PageContentBase } from "@/types/page-content";
import { InstructorApplicationForm } from "@/components/instructor/InstructorApplicationForm";

const RUNMOA_BASE = "https://aish.runmoa.com";

/* ── Types ── */
type InstructorItem = Omit<
  (typeof DEMO_INSTRUCTORS)[0],
  "programs" | "experience" | "education" | "certifications"
> & {
  id: string | number;
  imageUrl?: string;
  education?: { degree: string; institution: string; year: string }[];
  certifications?: string[];
  programs?: (string | { title: string; url?: string })[];
  contactEmail?: string;
  isActive?: boolean;
  displayOrder?: number;
  status?: "approved" | "pending" | "rejected";
  applicantUid?: string;
};

type ViewMode = "list" | "detail" | "apply";

const SOCIAL_ICONS = {
  linkedin: Linkedin,
  youtube: Youtube,
  instagram: Instagram,
  github: Github,
  personalSite: Globe,
} as const;

/* ── Template Sub-components ── */
function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 md:mb-3">
      <div className="w-1.5 h-1.5 bg-gray-400/50 rounded-sm" />
      <h3 className="text-[14px] md:text-[15px] font-bold text-gray-900 tracking-tight">
        {title}
      </h3>
    </div>
  );
}

function InfoListItem({ text }: { text: string }) {
  return (
    <li className="flex items-start text-[13px] md:text-sm text-gray-600 font-light leading-relaxed">
      <span className="mr-2 mt-[0.4rem] w-1 h-[1px] bg-gray-400 flex-shrink-0" />
      <span className="tracking-tight">{text}</span>
    </li>
  );
}

function ReviewCard({
  title,
  content,
  authorName,
  date,
}: {
  title: string;
  content: string;
  authorName: string;
  date: string;
}) {
  return (
    <div className="bg-[#f8f9fa] rounded-2xl p-4 md:p-5 border border-gray-100/50 transition-colors hover:bg-gray-50">
      <h4 className="text-[14px] md:text-[15px] font-bold text-gray-900 tracking-tight mb-1.5 md:mb-2">
        {title || authorName}
      </h4>
      <div className="flex items-center gap-2 text-[11px] md:text-[12px] font-light text-gray-500 mb-2 md:mb-3 tracking-tight flex-wrap">
        <span>{authorName}</span>
        {date && (
          <>
            <div className="w-[1px] h-2.5 bg-gray-300" />
            <span>{date}</span>
          </>
        )}
      </div>
      <p className="text-[12px] md:text-[13px] text-gray-600 font-light leading-relaxed tracking-tight">
        {content}
      </p>
    </div>
  );
}

/* ── Review Section (white-themed comments) ── */
function ReviewSection({ instructorId }: { instructorId: string }) {
  const { user, profile, isAdmin } = useAuth();
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const [comments, setComments] = useState<InstructorComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const data = await getFilteredCollection<InstructorComment>(
        COLLECTIONS.INSTRUCTOR_COMMENTS,
        "instructorId",
        instructorId,
      );
      data.sort((a, b) => {
        const ta =
          typeof a.createdAt === "object" && a.createdAt
            ? (a.createdAt as unknown as { seconds: number }).seconds * 1000
            : new Date(a.createdAt).getTime();
        const tb =
          typeof b.createdAt === "object" && b.createdAt
            ? (b.createdAt as unknown as { seconds: number }).seconds * 1000
            : new Date(b.createdAt).getTime();
        return tb - ta;
      });
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setLoaded(true);
    }
  }, [instructorId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    try {
      await createDoc(COLLECTIONS.INSTRUCTOR_COMMENTS, {
        instructorId,
        authorUid: user.uid,
        authorName: profile?.name || user.displayName || "익명",
        authorEmail: user.email || "",
        authorPhotoURL: user.photoURL || null,
        content: newComment.trim(),
      });
      setNewComment("");
      invalidateCache(COLLECTIONS.INSTRUCTOR_COMMENTS);
      await loadComments();
    } catch {
      alert("댓글 작성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    await removeDoc(COLLECTIONS.INSTRUCTOR_COMMENTS, commentId);
    invalidateCache(COLLECTIONS.INSTRUCTOR_COMMENTS);
    await loadComments();
  };

  const formatDate = (ts: unknown) => {
    if (!ts) return "";
    const ms =
      typeof ts === "object" && ts !== null && "seconds" in ts
        ? (ts as { seconds: number }).seconds * 1000
        : new Date(ts as string).getTime();
    return new Date(ms).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="lg:border-l lg:border-gray-100 lg:pl-10 pb-10 pt-6 lg:pt-0">
      <div className="sticky top-8">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-gray-900 rounded-sm" />
            <h3 className="text-[14px] md:text-[15px] font-bold text-gray-900 tracking-tight">
              강의평가
            </h3>
          </div>
          {loaded && (
            <span className="text-[13px] text-gray-400 font-light tracking-tight">
              {comments.length}개 리뷰
            </span>
          )}
        </div>

        {/* Comment Input */}
        {user ? (
          <div className="mb-4 flex gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="리뷰를 남겨주세요..."
              rows={2}
              className={cn(
                "flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm",
                "focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none placeholder:text-gray-400",
              )}
            />
            <button
              onClick={handleSubmit}
              disabled={!newComment.trim() || submitting}
              className={cn(
                "self-end px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg",
                "hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
              )}
            >
              <Send size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() =>
              requireLogin(() => {}, "리뷰를 작성하려면 로그인이 필요합니다.")
            }
            className="w-full mb-4 py-3 border border-dashed border-gray-300 rounded-xl text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors text-sm"
          >
            로그인하고 리뷰 작성하기
          </button>
        )}

        {/* Review List */}
        {!loaded ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">
            아직 리뷰가 없습니다.
          </p>
        ) : (
          <div className="space-y-3 md:space-y-4 max-h-[400px] md:max-h-[600px] lg:max-h-[800px] overflow-y-auto pr-1">
            {comments.map((c) => (
              <div key={c.id} className="relative">
                <ReviewCard
                  title=""
                  content={c.content}
                  authorName={c.authorName}
                  date={formatDate(c.createdAt)}
                />
                {(user?.uid === c.authorUid || isAdmin) && (
                  <button
                    onClick={() => handleDelete(c.id!)}
                    className="absolute top-3 right-3 text-gray-300 hover:text-red-400 transition-colors"
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </div>
  );
}

/* ── Instructor Detail View (Template-based) ── */
function InstructorDetailView({
  instructor,
  onBack,
}: {
  instructor: InstructorItem;
  onBack: () => void;
}) {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { requireLogin, showLogin, loginMessage, closeLogin } = useLoginGuard();

  const imageSrc = instructor.imageUrl || instructor.profileImageUrl;

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${instructor.name} - AISH 강사`, url });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast("링크가 복사되었습니다.", "success");
    }
  };

  const handleContact = () => {
    requireLogin(() => {
      if (instructor.contactEmail?.trim()) {
        window.location.href = `mailto:${instructor.contactEmail}`;
      } else {
        window.location.href = "/community?tab=inquiry";
      }
    }, "강사에게 메시지를 보내려면 로그인이 필요합니다.");
  };

  const handleHire = () => {
    requireLogin(() => {
      window.location.href = "/community?tab=inquiry";
    }, "강사 섭외 문의를 하려면 로그인이 필요합니다.");
  };

  const handleFavorite = () => {
    requireLogin(() => {
      toast("관심강사로 등록되었습니다.", "success");
    }, "관심강사 등록은 로그인이 필요합니다.");
  };

  const handleVideo = () => {
    const ytUrl = instructor.socialLinks?.youtube;
    if (ytUrl?.trim()) {
      window.open(ytUrl, "_blank");
    } else {
      toast("등록된 영상이 없습니다.", "info");
    }
  };

  const educationList = (instructor.education || []).map(
    (e) => [e.degree, e.institution, e.year].filter(Boolean).join(" · "),
  );

  const programs = (instructor.programs || []).map((p) =>
    typeof p === "string" ? { title: p, url: undefined } : p,
  );

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Header */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-900 pb-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            전체 강사소개
          </button>
          {isAdmin && (
            <a
              href="/admin/instructors"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm"
            >
              <Pencil size={14} />
              관리자 수정
            </a>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-20">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          {/* Left Column: Profile Card */}
          <aside className="w-full max-w-[360px] mx-auto lg:max-w-none lg:w-[280px] flex-shrink-0">
            <div className="border border-gray-200 overflow-hidden bg-white rounded-xl lg:rounded-none shadow-sm lg:shadow-none">
              <div className="aspect-[3/4] w-full bg-gray-100 relative">
                {imageSrc ? (
                  <DriveOrExternalImage
                    src={imageSrc}
                    alt={instructor.name}
                    className="w-full h-full object-cover"
                    quiet
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                    <span className="text-5xl font-bold text-gray-400">
                      {instructor.name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 border-t border-gray-200 bg-white">
                <ActionButton icon={UserPlus} label="강사 섭외하기" onClick={handleHire} />
                <ActionButton icon={Heart} label="관심강사 등록" onClick={handleFavorite} />
                <ActionButton icon={PlayCircle} label="관련영상 보기" onClick={handleVideo} />
                <ActionButton icon={MessageSquare} label="메시지 보내기" onClick={handleContact} />
              </div>
            </div>

            {/* Social Links */}
            {instructor.socialLinks && (
              <div className="mt-6 flex items-center gap-3 px-1">
                {(
                  Object.entries(instructor.socialLinks) as [
                    keyof typeof SOCIAL_ICONS,
                    string | null,
                  ][]
                ).map(([key, url]) => {
                  if (!url?.trim()) return null;
                  const Icon = SOCIAL_ICONS[key];
                  if (!Icon) return null;
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <Icon size={18} />
                    </a>
                  );
                })}
                {instructor.contactEmail?.trim() && (
                  <a
                    href={`mailto:${instructor.contactEmail}`}
                    className="text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <Mail size={18} />
                  </a>
                )}
              </div>
            )}

            {/* 관련 강의 */}
            <SidebarClasses instructorName={instructor.name} programs={programs} />
          </aside>

          {/* Right Column: Detail Information */}
          <div className="flex-1 flex flex-col mt-4 lg:mt-0">
            {/* Header: Name & Title */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 md:mb-6 pb-4 md:pb-6 border-b border-gray-200 gap-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                  {instructor.name}
                </h2>
                <span className="text-sm font-light text-gray-500 tracking-tight">
                  {[instructor.title, instructor.organization].filter(Boolean).join(" · ")}
                </span>
              </div>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1a365d] text-white rounded-full text-sm font-medium hover:bg-[#122847] transition-colors w-full sm:w-auto justify-center"
              >
                <Share2 className="w-3.5 h-3.5 mr-1" />
                공유하기
              </button>
            </div>

            {/* Content Layout (Info left, Reviews right) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-10">
              {/* Main Info Sections */}
              <div className="flex flex-col divide-y divide-gray-100">
                {/* 소개 */}
                {instructor.bio && (
                  <section className="py-5 md:py-6 first:pt-0">
                    <SectionTitle title="소개" />
                    <p className="text-sm text-gray-600 leading-relaxed tracking-tight mt-3">
                      {instructor.bio}
                    </p>
                  </section>
                )}

                {/* 주요경력 (Specialties) */}
                {(instructor.specialties || []).length > 0 && (
                  <section className="py-5 md:py-6">
                    <SectionTitle title="주요경력" />
                    <ul className="mt-3 space-y-2">
                      {(instructor.specialties || []).map((s, i) => (
                        <InfoListItem key={i} text={s} />
                      ))}
                    </ul>
                  </section>
                )}

                {/* 주요학력 (Education) */}
                {educationList.length > 0 && (
                  <section className="py-5 md:py-6">
                    <SectionTitle title="주요학력" />
                    <ul className="mt-3 space-y-1">
                      {educationList.map((text, i) => (
                        <InfoListItem key={i} text={text} />
                      ))}
                    </ul>
                  </section>
                )}

                {/* 자격/수상 (Certifications) */}
                {(instructor.certifications || []).length > 0 && (
                  <section className="py-5 md:py-6">
                    <SectionTitle title="자격 및 수상" />
                    <ul className="mt-3 space-y-2">
                      {(instructor.certifications || []).map((cert, i) => (
                        <InfoListItem key={i} text={cert} />
                      ))}
                    </ul>
                  </section>
                )}

                {/* 담당 프로그램 */}
                {programs.length > 0 && (
                  <section className="py-5 md:py-6">
                    <SectionTitle title="담당 프로그램" />
                    <ul className="mt-3 space-y-2">
                      {programs.map((p, i) =>
                        p.url ? (
                          <li key={i}>
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[13px] md:text-sm text-brand-blue hover:underline font-light tracking-tight"
                            >
                              {p.title}
                              <ExternalLink size={12} />
                            </a>
                          </li>
                        ) : (
                          <InfoListItem key={i} text={p.title} />
                        ),
                      )}
                    </ul>
                  </section>
                )}
              </div>

              {/* Reviews Column */}
              {typeof instructor.id === "string" && (
                <ReviewSection instructorId={instructor.id} />
              )}
            </div>
          </div>
        </div>
      </main>

      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </div>
  );
}

/* ── Sidebar: 관련 강의 위젯 ── */
type ClassCard = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  href: string;
  contentType?: string;
  price?: string;
  isFree?: boolean;
};

function extractRunmoaId(url: string): number | null {
  const m = url.match(/\/classes\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function SidebarClasses({
  instructorName,
  programs,
}: {
  instructorName: string;
  programs: { title: string; url?: string }[];
}) {
  const [cards, setCards] = useState<ClassCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result: ClassCard[] = [];
      const seenIds = new Set<string>();

      // 1) programs 필드에서 Runmoa URL 추출 → API로 상세 정보 가져오기
      const runmoaIds = programs
        .map((p) => ({ title: p.title, url: p.url, id: p.url ? extractRunmoaId(p.url) : null }))
        .filter((p) => p.id !== null);

      if (runmoaIds.length > 0) {
        const fetches = runmoaIds.map(async (p) => {
          try {
            const cls = await getRunmoaContentById(p.id!);
            const key = String(cls.content_id);
            if (!seenIds.has(key)) {
              seenIds.add(key);
              const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim();
              result.push({
                id: key,
                title: cls.title,
                description: stripHtml(cls.description_html).slice(0, 80),
                imageUrl: cls.featured_image,
                href: `${RUNMOA_BASE}/classes/${cls.content_id}`,
                contentType: cls.content_type,
                price: cls.is_free
                  ? "무료"
                  : `₩${(cls.is_on_sale ? cls.sale_price : cls.base_price).toLocaleString()}`,
                isFree: cls.is_free,
              });
            }
          } catch { /* 개별 실패 무시 */ }
        });
        await Promise.allSettled(fetches);
      }

      // 2) programs 필드에서 URL만 있는 항목 (Runmoa 아닌 URL 포함)
      for (const p of programs) {
        if (!p.url) continue;
        const rmId = extractRunmoaId(p.url);
        if (rmId && seenIds.has(String(rmId))) continue;
        const key = p.url;
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        result.push({
          id: key,
          title: p.title,
          href: p.url,
        });
      }

      // 3) API 이름 검색 (보조: 위에서 못 찾은 경우)
      if (result.length === 0) {
        try {
          const q = instructorName.trim();
          const res = await getRunmoaContents({ limit: 20, search: q });
          const lower = q.toLowerCase();
          const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim();
          for (const cls of res.data) {
            const title = (cls.title || "").toLowerCase();
            const desc = (cls.description_html || "").toLowerCase();
            if (title.includes(lower) || desc.includes(lower)) {
              const key = String(cls.content_id);
              if (!seenIds.has(key)) {
                seenIds.add(key);
                result.push({
                  id: key,
                  title: cls.title,
                  description: stripHtml(cls.description_html).slice(0, 80),
                  imageUrl: cls.featured_image,
                  href: `${RUNMOA_BASE}/classes/${cls.content_id}`,
                  contentType: cls.content_type,
                  price: cls.is_free
                    ? "무료"
                    : `₩${(cls.is_on_sale ? cls.sale_price : cls.base_price).toLocaleString()}`,
                  isFree: cls.is_free,
                });
              }
            }
          }
        } catch { /* API 실패 무시 */ }
      }

      // 4) programs 필드의 URL 없는 항목도 표시
      for (const p of programs) {
        if (p.url) continue;
        const key = `prog-${p.title}`;
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        result.push({
          id: key,
          title: p.title,
          href: `${RUNMOA_BASE}/classes`,
        });
      }

      if (!cancelled) {
        setCards(result.slice(0, 5));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [instructorName, programs]);

  if (loading) {
    return (
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-1.5 h-1.5 bg-gray-900 rounded-sm" />
          <h3 className="text-[14px] md:text-[15px] font-bold text-gray-900 tracking-tight">
            진행중인 강의
          </h3>
        </div>
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (cards.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-1.5 h-1.5 bg-gray-900 rounded-sm" />
        <h3 className="text-[14px] md:text-[15px] font-bold text-gray-900 tracking-tight">
          진행중인 강의
        </h3>
      </div>
      <div className="space-y-3">
        {cards.map((card) => (
          <a
            key={card.id}
            href={card.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <div className="flex gap-3 md:gap-4 bg-white border border-gray-200 rounded-xl p-3 md:p-4 hover:bg-gray-50 hover:border-gray-300 transition-all group shadow-sm">
              {card.imageUrl && (
                <div className="w-16 md:w-20 flex-shrink-0 self-start">
                  <img
                    alt={card.title}
                    className="w-full h-auto rounded-lg border border-gray-100"
                    referrerPolicy="no-referrer"
                    src={card.imageUrl}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-[12px] md:text-[13px] font-bold text-gray-900 line-clamp-2 leading-tight">
                    {card.title}
                  </h4>
                  <ExternalLink
                    size={14}
                    className="text-gray-400 group-hover:text-gray-600 flex-shrink-0 mt-0.5 transition-colors"
                  />
                </div>
                {card.description && (
                  <p className="text-[11px] md:text-[11.5px] text-gray-500 mt-1.5 line-clamp-2 leading-snug">
                    {card.description}
                  </p>
                )}
                {(card.contentType || card.price) && (
                  <div className="flex items-center gap-1.5 md:gap-2 mt-2 md:mt-3 flex-wrap">
                    {card.contentType && (
                      <span
                        className={cn(
                          "text-[9px] md:text-[10px] font-medium px-2 py-0.5 rounded-full border",
                          card.contentType === "offline"
                            ? "bg-green-50 text-green-700 border-green-200/60"
                            : card.contentType === "live"
                              ? "bg-blue-50 text-blue-700 border-blue-200/60"
                              : card.contentType === "vod"
                                ? "bg-purple-50 text-purple-700 border-purple-200/60"
                                : "bg-gray-50 text-gray-600 border-gray-200/60",
                        )}
                      >
                        {card.contentType === "offline"
                          ? "오프라인"
                          : card.contentType === "live"
                            ? "라이브"
                            : card.contentType === "vod"
                              ? "VOD"
                              : "디지털콘텐츠"}
                      </span>
                    )}
                    {card.price && (
                      card.isFree ? (
                        <span className="text-[9px] md:text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200/60">
                          무료
                        </span>
                      ) : (
                        <span className="text-[11px] md:text-[12px] font-bold text-gray-800">
                          {card.price}
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center py-4 md:py-5 px-2 gap-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors group"
    >
      <Icon strokeWidth={1.5} className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
      <span className="text-[12px] md:text-[13px] font-medium tracking-tight">{label}</span>
    </button>
  );
}

/* ── Main Page ── */
export default function InstructorsPage() {
  const [pc, setPc] = useState<PageContentBase>(DEFAULT_INSTRUCTORS);
  const [instructors, setInstructors] = useState<InstructorItem[]>(
    DEMO_INSTRUCTORS as InstructorItem[],
  );
  const [view, setView] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<InstructorItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();

  useEffect(() => {
    loadPageContent("instructors").then(setPc).catch(() => {});
  }, []);

  useEffect(() => {
    getCollection<InstructorItem>(COLLECTIONS.INSTRUCTORS)
      .then((data) => {
        if (data.length === 0) return;
        const active = data
          .filter((i) => i.isActive !== false)
          .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
        if (active.length > 0) setInstructors(active);
      })
      .catch(() => {});
  }, []);

  const imageSrc = (inst: InstructorItem) =>
    inst.imageUrl || inst.profileImageUrl;

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return instructors;
    const q = searchQuery.toLowerCase();
    return instructors.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.title || "").toLowerCase().includes(q) ||
        (i.organization || "").toLowerCase().includes(q) ||
        (i.specialties || []).some((s) => s.toLowerCase().includes(q)),
    );
  }, [instructors, searchQuery]);

  const handleSelectInstructor = (inst: InstructorItem) => {
    setSelected(inst);
    setView("detail");
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    setView("list");
    setSelected(null);
  };

  const handleApply = () => {
    requireLogin(() => {
      setView("apply");
      window.scrollTo(0, 0);
    }, "강사 신청을 하려면 로그인이 필요합니다.");
  };

  /* Detail View */
  if (view === "detail" && selected) {
    return <InstructorDetailView instructor={selected} onBack={handleBack} />;
  }

  /* Application Form */
  if (view === "apply" && user) {
    return (
      <InstructorApplicationForm
        onBack={handleBack}
        onSubmitted={handleBack}
        variant="standalone"
      />
    );
  }

  /* List View */
  return (
    <div className="min-h-screen bg-white">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-900 pb-4">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            {pc.hero.title || "전체 강사소개"}
          </h1>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="강사 이름, 분야로 검색"
                className={cn(
                  "w-full pl-4 pr-10 py-2 md:py-2.5 text-sm font-light border border-gray-200 rounded-full",
                  "focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-all placeholder:text-gray-400",
                )}
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="검색어 지우기"
                >
                  <X size={14} />
                </button>
              ) : (
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              )}
            </div>
            <button
              onClick={handleApply}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold shrink-0",
                "bg-gray-900 text-white hover:bg-gray-800 transition-colors",
              )}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">강사 신청</span>
            </button>
          </div>
        </div>
        {pc.hero.subtitle && (
          <p className="mt-4 text-sm text-gray-500">{pc.hero.subtitle}</p>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">
            {searchQuery ? "검색 결과가 없습니다." : "등록된 강사가 없습니다."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((inst) => (
              <div
                key={inst.id}
                onClick={() => handleSelectInstructor(inst)}
                className={cn(
                  "bg-white rounded-xl border border-gray-200 overflow-hidden",
                  "cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group",
                )}
              >
                {/* Image */}
                <div className="relative aspect-[4/5] overflow-hidden bg-gray-100">
                  {imageSrc(inst) ? (
                    <DriveOrExternalImage
                      src={imageSrc(inst)!}
                      alt={inst.name}
                      className="w-full h-full object-cover object-top"
                      quiet
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <span className="text-5xl font-bold text-gray-300">
                        {inst.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent" />
                </div>

                {/* Info */}
                <div className="px-5 py-4">
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                    {inst.name}
                  </h3>
                  {inst.title && (
                    <p className="mt-0.5 text-[13px] font-medium text-gray-500 tracking-tight line-clamp-1">
                      {inst.title}
                    </p>
                  )}
                  {(inst.specialties || []).length > 0 && (
                    <div className="mt-3 space-y-0.5">
                      {(inst.specialties || []).slice(0, 2).map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="shrink-0 w-1 h-1 rounded-full bg-gray-400" />
                          <span className="text-[12px] text-gray-500 truncate tracking-tight">
                            {s}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {inst.bio && (
                    <p className="mt-3 text-[12px] text-gray-400 italic line-clamp-2 tracking-tight">
                      &ldquo;{inst.bio}&rdquo;
                    </p>
                  )}
                </div>
                <div className="px-5 pb-4">
                  <span className="text-xs text-gray-400 font-medium group-hover:text-gray-700 transition-colors">
                    프로필 보기 →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </div>
  );
}
