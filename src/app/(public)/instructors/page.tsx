"use client";

import { useState, useEffect, Fragment, useCallback } from "react";
import Link from "next/link";
import { DEMO_INSTRUCTORS } from "@/lib/demo-data";
import {
  getCollection,
  getFilteredCollection,
  createDoc,
  removeDoc,
  COLLECTIONS,
  invalidateCache,
} from "@/lib/firestore";
import { getRunmoaContents } from "@/lib/runmoa-api";
import { useAuth } from "@/contexts/AuthContext";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import LoginModal from "@/components/public/LoginModal";
import {
  Linkedin,
  Youtube,
  Instagram,
  Github,
  Globe,
  X,
  Mail,
  Award,
  Briefcase,
  GraduationCap,
  ExternalLink,
  Pencil,
  Send,
  Trash2,
  BookOpen,
  MessageCircle,
  User,
} from "lucide-react";
import { toDirectImageUrl, cn } from "@/lib/utils";
import DriveOrExternalImage from "@/components/ui/DriveOrExternalImage";
import type { InstructorComment } from "@/types/firestore";
import type { RunmoaContent } from "@/types/runmoa";

type InstructorItem = Omit<(typeof DEMO_INSTRUCTORS)[0], "programs" | "experience" | "education" | "certifications"> & {
  id: string | number;
  imageUrl?: string;
  education?: { degree: string; institution: string; year: string }[];
  certifications?: string[];
  programs?: (string | { title: string; url?: string })[];
  contactEmail?: string;
  isActive?: boolean;
  displayOrder?: number;
};

const SOCIAL_ICONS = {
  linkedin: Linkedin,
  youtube: Youtube,
  instagram: Instagram,
  github: Github,
  personalSite: Globe,
} as const;

const RUNMOA_BASE = "https://aish.runmoa.com";

/* ── Comment Section ── */
function CommentSection({ instructorId }: { instructorId: string }) {
  const { user, profile, isAdmin } = useAuth();
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const [comments, setComments] = useState<InstructorComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);

  const loadComments = useCallback(async () => {
    try {
      const data = await getFilteredCollection<InstructorComment>(
        COLLECTIONS.INSTRUCTOR_COMMENTS,
        "instructorId",
        instructorId
      );
      // sort by createdAt desc (Firestore Timestamp → string fallback)
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
      setLoadingComments(false);
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
    } catch (err) {
      console.error("댓글 작성 실패:", err);
      alert("댓글 작성에 실패했습니다. 다시 시도해 주세요.");
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

  const formatTime = (ts: unknown) => {
    if (!ts) return "";
    const ms =
      typeof ts === "object" && ts !== null && "seconds" in ts
        ? (ts as { seconds: number }).seconds * 1000
        : new Date(ts as string).getTime();
    return new Date(ms).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={cn("mt-16 lg:mt-24 animate-fade-in-up")}
      style={{ animationDelay: "600ms" }}
    >
      <h3
        className={cn(
          "text-2xl font-bold text-white border-b-2 border-white/40 pb-3 mb-8 flex items-center gap-3"
        )}
      >
        <MessageCircle size={24} />
        댓글 ({comments.length})
      </h3>

      {/* Comment Input */}
      <div className={cn("mb-8")}>
        {user ? (
          <div className={cn("flex gap-3")}>
            <div
              className={cn(
                "w-10 h-10 rounded-full bg-white/20 flex-shrink-0 overflow-hidden flex items-center justify-center"
              )}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className={cn("w-full h-full object-cover")}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User size={18} className={cn("text-white/60")} />
              )}
            </div>
            <div className={cn("flex-1")}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="댓글을 입력하세요..."
                rows={3}
                className={cn(
                  "w-full bg-white/10 border border-white/20 rounded-sm px-4 py-3 text-white placeholder-white/40 text-sm",
                  "focus:outline-none focus:border-white/50 resize-none"
                )}
              />
              <div className={cn("flex justify-end mt-2")}>
                <button
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || submitting}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm rounded-sm",
                    "disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  )}
                >
                  <Send size={14} />
                  {submitting ? "등록 중..." : "댓글 작성"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() =>
              requireLogin(() => {}, "댓글을 작성하려면 로그인이 필요합니다.")
            }
            className={cn(
              "w-full py-4 border border-dashed border-white/30 rounded-sm text-white/60 hover:text-white hover:border-white/50 transition-colors text-sm"
            )}
          >
            로그인하고 댓글 작성하기
          </button>
        )}
      </div>

      {/* Comment List */}
      {loadingComments ? (
        <div className={cn("flex justify-center py-8")}>
          <div
            className={cn(
              "w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"
            )}
          />
        </div>
      ) : comments.length === 0 ? (
        <p className={cn("text-center text-white/40 py-8 text-sm")}>
          아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
        </p>
      ) : (
        <div className={cn("space-y-4")}>
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={cn(
                "flex gap-3 bg-white/5 rounded-sm p-4 border border-white/10"
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-full bg-white/20 flex-shrink-0 overflow-hidden flex items-center justify-center"
                )}
              >
                {comment.authorPhotoURL ? (
                  <img
                    src={comment.authorPhotoURL}
                    alt=""
                    className={cn("w-full h-full object-cover")}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User size={16} className={cn("text-white/60")} />
                )}
              </div>
              <div className={cn("flex-1 min-w-0")}>
                <div
                  className={cn("flex items-center justify-between gap-2 mb-1")}
                >
                  <span className={cn("text-sm font-medium text-white")}>
                    {comment.authorName}
                  </span>
                  <div className={cn("flex items-center gap-2")}>
                    <span className={cn("text-xs text-white/40")}>
                      {formatTime(comment.createdAt)}
                    </span>
                    {(user?.uid === comment.authorUid || isAdmin) && (
                      <button
                        onClick={() => handleDelete(comment.id!)}
                        className={cn(
                          "text-white/30 hover:text-red-400 transition-colors"
                        )}
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <p
                  className={cn(
                    "text-sm text-white/80 leading-relaxed whitespace-pre-wrap"
                  )}
                >
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <LoginModal
        isOpen={showLogin}
        onClose={closeLogin}
        message={loginMessage}
      />
    </div>
  );
}

/* ── Class History Section ── */
function ClassHistorySection({ instructorName }: { instructorName: string }) {
  const [classes, setClasses] = useState<RunmoaContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = instructorName.trim();
    // Use Runmoa search param first, then fallback to case-insensitive local match
    getRunmoaContents({ limit: 100, search: q })
      .then((res) => {
        const lower = q.toLowerCase();
        const matched = res.data.filter((c) => {
          const title = (c.title || "").toLowerCase();
          const desc = (c.description_html || "").toLowerCase();
          return title.includes(lower) || desc.includes(lower);
        });
        setClasses(matched);
      })
      .catch((err) => {
        console.error("Runmoa contents fetch failed:", err);
        setClasses([]);
      })
      .finally(() => setLoading(false));
  }, [instructorName]);

  if (loading) {
    return (
      <div
        className={cn("mt-16 lg:mt-24 animate-fade-in-up")}
        style={{ animationDelay: "550ms" }}
      >
        <h3
          className={cn(
            "text-2xl font-bold text-white border-b-2 border-white/40 pb-3 mb-8 flex items-center gap-3"
          )}
        >
          <BookOpen size={24} />
          수업 내역
        </h3>
        <div className={cn("flex justify-center py-8")}>
          <div
            className={cn(
              "w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"
            )}
          />
        </div>
      </div>
    );
  }

  if (classes.length === 0) return null;

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim();

  return (
    <div
      className={cn("mt-16 lg:mt-24 animate-fade-in-up")}
      style={{ animationDelay: "550ms" }}
    >
      <h3
        className={cn(
          "text-2xl font-bold text-white border-b-2 border-white/40 pb-3 mb-8 flex items-center gap-3"
        )}
      >
        <BookOpen size={24} />
        수업 내역 ({classes.length})
      </h3>
      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4")}>
        {classes.map((cls) => (
          <a
            key={cls.content_id}
            href={`${RUNMOA_BASE}/classes/${cls.content_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex gap-4 bg-white/5 border border-white/10 rounded-sm p-4",
              "hover:bg-white/10 hover:border-white/20 transition-all group"
            )}
          >
            {cls.featured_image && (
              <img
                src={cls.featured_image}
                alt={cls.title}
                className={cn(
                  "w-20 h-20 rounded-lg object-cover flex-shrink-0"
                )}
                referrerPolicy="no-referrer"
              />
            )}
            <div className={cn("flex-1 min-w-0")}>
              <div className={cn("flex items-start justify-between gap-2")}>
                <h4
                  className={cn(
                    "text-sm font-semibold text-white line-clamp-2"
                  )}
                >
                  {cls.title}
                </h4>
                <ExternalLink
                  size={14}
                  className={cn(
                    "text-white/30 group-hover:text-white/60 flex-shrink-0 mt-0.5 transition-colors"
                  )}
                />
              </div>
              <p
                className={cn(
                  "text-xs text-white/50 mt-1 line-clamp-2"
                )}
              >
                {stripHtml(cls.description_html).slice(0, 100)}
              </p>
              <div className={cn("flex items-center gap-2 mt-2")}>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    cls.content_type === "offline"
                      ? "bg-green-500/20 text-green-300"
                      : cls.content_type === "live"
                        ? "bg-blue-500/20 text-blue-300"
                        : cls.content_type === "vod"
                          ? "bg-purple-500/20 text-purple-300"
                          : "bg-gray-500/20 text-gray-300"
                  )}
                >
                  {cls.content_type === "offline"
                    ? "오프라인"
                    : cls.content_type === "live"
                      ? "라이브"
                      : cls.content_type === "vod"
                        ? "VOD"
                        : "디지털콘텐츠"}
                </span>
                {cls.is_free ? (
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300"
                    )}
                  >
                    무료
                  </span>
                ) : (
                  <span className={cn("text-xs text-white/40")}>
                    ₩
                    {(cls.is_on_sale ? cls.sale_price : cls.base_price).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<InstructorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstructor, setSelectedInstructor] =
    useState<InstructorItem | null>(null);
  const { isAdmin } = useAuth();

  useEffect(() => {
    getCollection<InstructorItem>(COLLECTIONS.INSTRUCTORS)
      .then((data) => {
        if (data.length === 0) {
          setInstructors(DEMO_INSTRUCTORS as InstructorItem[]);
          return;
        }
        const active = data
          .filter((i) => i.isActive !== false)
          .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
        setInstructors(
          active.length > 0 ? active : (DEMO_INSTRUCTORS as InstructorItem[])
        );
      })
      .catch(() => {
        setInstructors(DEMO_INSTRUCTORS as InstructorItem[]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedInstructor) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedInstructor]);

  useEffect(() => {
    if (!selectedInstructor) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedInstructor(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedInstructor]);

  const imageSrc = (inst: InstructorItem) =>
    inst.imageUrl || inst.profileImageUrl;

  return (
    <div className={cn("py-16")}>
      <div className={cn("max-w-5xl mx-auto px-4")}>
        {/* Header */}
        <div className={cn("text-center mb-12")}>
          <h1 className={cn("text-3xl font-bold text-brand-dark uppercase tracking-tight mb-3")}>
            전문 강사진
          </h1>
          <p className={cn("text-lg text-gray-500")}>
            각 분야 최고의 전문가들이 여러분의 성장을 이끕니다.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className={cn("flex justify-center py-12")}>
            <div
              className={cn(
                "w-8 h-8 border-4 border-brand-border border-t-brand-blue rounded-full animate-spin"
              )}
            />
          </div>
        )}

        {/* Card Grid */}
        <div
          className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6")}
        >
          {!loading &&
            instructors.map((inst) => (
              <div
                key={inst.id}
                onClick={() => setSelectedInstructor(inst)}
                className={cn(
                  "bg-white rounded-sm border border-brand-border shadow-sm overflow-hidden hover-lift group",
                  "cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                )}
              >
                {/* Image */}
                <div className={cn("relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-brand-gray to-gray-200")}>
                  {imageSrc(inst) ? (
                    <DriveOrExternalImage
                      src={imageSrc(inst)!}
                      alt={inst.name}
                      className={cn("w-full h-full object-cover object-top")}
                      quiet
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-gray to-gray-200">
                      <span className="text-5xl font-bold text-brand-blue">{inst.name.charAt(0)}</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent"
                    )}
                  />
                </div>

                {/* Info */}
                <div className={cn("p-5")}>
                  <h3 className={cn("text-lg font-bold text-gray-900")}>
                    {inst.name}
                  </h3>
                  <p className={cn("text-sm text-gray-500")}>
                    {inst.title} · {inst.organization}
                  </p>
                  <div className={cn("flex flex-wrap gap-1.5 mt-3")}>
                    {(inst.specialties || []).slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className={cn(
                          "text-xs bg-brand-gray text-brand-blue px-2 py-0.5 rounded-full"
                        )}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  {inst.bio && (
                    <p
                      className={cn(
                        "text-xs text-gray-400 mt-2 line-clamp-2"
                      )}
                    >
                      {inst.bio}
                    </p>
                  )}
                </div>
                <div className="px-5 pb-4">
                  <span className="text-xs text-brand-blue font-medium group-hover:underline">프로필 보기 →</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedInstructor && (
        <div className={cn("fixed inset-0 z-50 bg-brand-blue overflow-y-auto")} role="dialog" aria-modal="true">
          {/* Top buttons */}
          <div className={cn("absolute top-4 right-4 z-10 flex items-center gap-2")}>
            {isAdmin && (
              <a
                href={`/admin/instructors`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-sm transition-colors text-sm"
                )}
                title="강사 정보 수정"
              >
                <Pencil size={16} />
                수정
              </a>
            )}
            <button
              onClick={() => setSelectedInstructor(null)}
              className={cn(
                "text-white/80 hover:text-white transition-colors p-1"
              )}
              aria-label="닫기"
            >
              <X size={28} />
            </button>
          </div>

          <div className={cn("max-w-7xl mx-auto px-5 py-16 sm:px-12 lg:px-20")}>
            {/* Hero */}
            <div
              className={cn(
                "grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-center"
              )}
              style={{ animationDelay: "0ms" }}
            >
              {/* Left: Text */}
              <div
                className={cn("lg:col-span-7 order-2 lg:order-1 animate-fade-in-up")}
                style={{ animationDelay: "100ms" }}
              >
                <p
                  className={cn(
                    "text-sm uppercase tracking-widest text-blue-200 mb-4"
                  )}
                >
                  Meet The Instructor
                </p>
                <h2
                  className={cn(
                    "text-4xl sm:text-5xl lg:text-6xl font-serif text-white tracking-tight mb-4"
                  )}
                >
                  {selectedInstructor.name}
                </h2>
                <p className={cn("text-lg text-blue-100 mb-6")}>
                  {selectedInstructor.title} · {selectedInstructor.organization}
                </p>
                <p
                  className={cn(
                    "text-base text-blue-100/80 leading-relaxed mb-8"
                  )}
                >
                  {selectedInstructor.bio}
                </p>

                {/* Specialty badges */}
                <div className={cn("flex flex-wrap gap-2 mb-8")}>
                  {(selectedInstructor.specialties || []).map((s) => (
                    <span
                      key={s}
                      className={cn(
                        "px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs"
                      )}
                    >
                      {s}
                    </span>
                  ))}
                </div>

                {/* Social links */}
                {selectedInstructor.socialLinks && (
                  <div className={cn("flex items-center gap-4 mb-4")}>
                    {(
                      Object.entries(selectedInstructor.socialLinks) as [
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
                          className={cn(
                            "text-white hover:text-blue-300 transition-colors"
                          )}
                        >
                          <Icon size={20} />
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Contact email */}
                {selectedInstructor.contactEmail?.trim() && (
                  <div className={cn("flex items-center gap-2 text-blue-200")}>
                    <Mail size={16} />
                    <span className={cn("text-sm")}>
                      {selectedInstructor.contactEmail}
                    </span>
                  </div>
                )}
              </div>

              {/* Right: Image */}
              <div
                className={cn(
                  "lg:col-span-5 order-1 lg:order-2 animate-fade-in-up"
                )}
                style={{ animationDelay: "200ms" }}
              >
                <div className={cn("relative rounded-sm overflow-hidden shadow-2xl")}>
                  {imageSrc(selectedInstructor) ? (
                    <DriveOrExternalImage
                      src={imageSrc(selectedInstructor)!}
                      alt={selectedInstructor.name}
                      className={cn("object-cover object-top w-full aspect-[4/5]")}
                      quiet
                    />
                  ) : (
                    <div
                      className={cn(
                        "w-full aspect-[4/5] bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center"
                      )}
                    >
                      <GraduationCap className={cn("w-24 h-24 text-white/40")} />
                    </div>
                  )}
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
                    )}
                  />
                </div>
                {/* Floating name card */}
                <div
                  className={cn(
                    "relative -mt-8 mx-auto w-[90%] bg-white text-center rounded-sm p-6 shadow-2xl"
                  )}
                >
                  <p
                    className={cn(
                      "text-xl font-serif font-bold text-brand-blue"
                    )}
                  >
                    {selectedInstructor.name}
                  </p>
                  <p
                    className={cn(
                      "uppercase tracking-widest text-xs text-gray-500 mt-1"
                    )}
                  >
                    {selectedInstructor.title}
                  </p>
                </div>
              </div>
            </div>

            {/* Education */}
            {selectedInstructor.education &&
              selectedInstructor.education.length > 0 && (
                <div
                  className={cn("mt-16 lg:mt-24 animate-fade-in-up")}
                  style={{ animationDelay: "400ms" }}
                >
                  <h3
                    className={cn(
                      "text-2xl font-bold text-white border-b-2 border-white/40 pb-3 mb-8 flex items-center gap-3"
                    )}
                  >
                    <GraduationCap size={24} />
                    Education
                  </h3>
                  <div className={cn("space-y-4")}>
                    {selectedInstructor.education.map((edu, i) => (
                      <div key={i}>
                        <p className={cn("font-bold text-white")}>
                          {edu.degree}
                        </p>
                        <p className={cn("text-blue-100")}>
                          {edu.institution}
                        </p>
                        <p className={cn("text-blue-200 text-sm")}>
                          {edu.year}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Certifications */}
            {selectedInstructor.certifications &&
              selectedInstructor.certifications.length > 0 && (
                <div
                  className={cn("mt-16 lg:mt-24 animate-fade-in-up")}
                  style={{ animationDelay: "500ms" }}
                >
                  <h3
                    className={cn(
                      "text-2xl font-bold text-white border-b-2 border-white/40 pb-3 mb-8 flex items-center gap-3"
                    )}
                  >
                    <Award size={24} />
                    Certifications
                  </h3>
                  <div className={cn("flex flex-wrap gap-2")}>
                    {selectedInstructor.certifications.map((cert) => (
                      <span
                        key={cert}
                        className={cn(
                          "px-3 py-1.5 rounded-sm bg-white/10 text-white text-sm"
                        )}
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* Programs (담당 프로그램) */}
            {(selectedInstructor.programs || []).length > 0 && (
              <div
                className={cn("mt-16 lg:mt-24 animate-fade-in-up")}
                style={{ animationDelay: "500ms" }}
              >
                <h3
                  className={cn(
                    "text-2xl font-bold text-white border-b-2 border-white/40 pb-3 mb-8 flex items-center gap-3"
                  )}
                >
                  <BookOpen size={24} />
                  담당 프로그램
                </h3>
                <div className={cn("flex flex-wrap gap-3")}>
                  {(selectedInstructor.programs || []).map((p, i) => {
                    const isObj = typeof p !== 'string';
                    const title = isObj ? p.title : p;
                    const url = isObj ? p.url : null;
                    const content = (
                      <span
                        className={cn(
                          "px-4 py-2 rounded-sm bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors inline-block",
                          url && "cursor-pointer ring-1 ring-white/50"
                        )}
                      >
                        {title}
                      </span>
                    );

                    return (
                      <Fragment key={i}>
                        {url ? (
                          <Link href={url} target="_blank" rel="noopener noreferrer">
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Class History */}
            <ClassHistorySection
              instructorName={selectedInstructor.name}
            />

            {/* Comments */}
            {typeof selectedInstructor.id === "string" && (
              <CommentSection
                instructorId={selectedInstructor.id}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
