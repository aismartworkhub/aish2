"use client";

import { useState, useEffect, useCallback } from "react";
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
  MessageCircle, ChevronRight,
  User,
} from "lucide-react";
import DOMPurify from "dompurify";
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
  detailedHtml?: string;
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
      className={cn("mt-8 animate-fade-in-up")}
      style={{ animationDelay: "600ms" }}
    >
      <h3
        className={cn(
          "text-2xl font-bold text-gray-900 border-b-2 border-gray-300 pb-3 mb-8 flex items-center gap-3"
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
                "w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center"
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
                <User size={18} className={cn("text-gray-500")} />
              )}
            </div>
            <div className={cn("flex-1")}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="댓글을 입력하세요..."
                rows={3}
                className={cn(
                  "w-full bg-gray-100 border border-gray-200 rounded-sm px-4 py-3 text-gray-900 placeholder-white/40 text-sm",
                  "focus:outline-none focus:border-gray-400 resize-none"
                )}
              />
              <div className={cn("flex justify-end mt-2")}>
                <button
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || submitting}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm rounded-sm",
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
              "w-full py-4 border border-dashed border-gray-300 rounded-sm text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors text-sm"
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
              "w-6 h-6 border-2 border-gray-200 border-t-white rounded-full animate-spin"
            )}
          />
        </div>
      ) : comments.length === 0 ? (
        <p className={cn("text-center text-gray-400 py-8 text-sm")}>
          아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
        </p>
      ) : (
        <div className={cn("space-y-4")}>
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={cn(
                "flex gap-3 bg-gray-50 rounded-sm p-4 border border-gray-100"
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center"
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
                  <User size={16} className={cn("text-gray-500")} />
                )}
              </div>
              <div className={cn("flex-1 min-w-0")}>
                <div
                  className={cn("flex items-center justify-between gap-2 mb-1")}
                >
                  <span className={cn("text-sm font-medium text-gray-900")}>
                    {comment.authorName}
                  </span>
                  <div className={cn("flex items-center gap-2")}>
                    <span className={cn("text-xs text-gray-400")}>
                      {formatTime(comment.createdAt)}
                    </span>
                    {(user?.uid === comment.authorUid || isAdmin) && (
                      <button
                        onClick={() => handleDelete(comment.id!)}
                        className={cn(
                          "text-gray-400 hover:text-red-400 transition-colors"
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
                    "text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
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
        className={cn("mt-8 animate-fade-in-up")}
        style={{ animationDelay: "550ms" }}
      >
        <h3
          className={cn(
            "text-2xl font-bold text-gray-900 border-b-2 border-gray-300 pb-3 mb-8 flex items-center gap-3"
          )}
        >
          <BookOpen size={24} />
          수업 내역
        </h3>
        <div className={cn("flex justify-center py-8")}>
          <div
            className={cn(
              "w-6 h-6 border-2 border-gray-200 border-t-white rounded-full animate-spin"
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
      className={cn("mt-8 animate-fade-in-up")}
      style={{ animationDelay: "550ms" }}
    >
      <h3
        className={cn(
          "text-2xl font-bold text-gray-900 border-b-2 border-gray-300 pb-3 mb-8 flex items-center gap-3"
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
              "flex gap-4 bg-gray-50 border border-gray-100 rounded-sm p-4",
              "hover:bg-gray-100 hover:border-gray-200 transition-all group"
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
                    "text-sm font-semibold text-gray-900 line-clamp-2"
                  )}
                >
                  {cls.title}
                </h4>
                <ExternalLink
                  size={14}
                  className={cn(
                    "text-gray-400 group-hover:text-gray-500 flex-shrink-0 mt-0.5 transition-colors"
                  )}
                />
              </div>
              <p
                className={cn(
                  "text-xs text-gray-500 mt-1 line-clamp-2"
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
                        ? "bg-blue-500/20 text-brand-blue"
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
                  <span className={cn("text-xs text-gray-400")}>
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
/* ── Instructor Programs Section ── */
function InstructorProgramsSection({
  programs,
}: {
  programs: (string | { title: string; url?: string })[];
}) {
  const [programContents, setProgramContents] = useState<
    Map<string, RunmoaContent | null>
  >(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parsedItems = (programs || []).map((p) =>
      typeof p === "string" ? { title: p, url: null } : { title: p.title, url: p.url ?? null }
    );
    if (parsedItems.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.allSettled(
      parsedItems.map(({ title }) =>
        getRunmoaContents({ search: title, limit: 10 })
          .then((res) => {
            const lower = title.toLowerCase();
            const match = res.data.find((c) => {
              const ct = c.title.toLowerCase();
              return ct.includes(lower) || lower.includes(ct);
            });
            return { title, content: match ?? null };
          })
          .catch(() => ({ title, content: null as RunmoaContent | null }))
      )
    )
      .then((results) => {
        const map = new Map<string, RunmoaContent | null>();
        results.forEach((r) => {
          if (r.status === "fulfilled") {
            map.set(r.value.title, r.value.content);
          }
        });
        setProgramContents(map);
      })
      .finally(() => setLoading(false));
  }, [programs]);

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim();

  const parsed = (programs || []).map((p) =>
    typeof p === "string" ? { title: p, url: null } : { title: p.title, url: p.url ?? null }
  );

  return (
    <div
      className={cn("mt-8 animate-fade-in-up")}
      style={{ animationDelay: "500ms" }}
    >
      <h3
        className={cn(
          "text-2xl font-bold text-gray-900 border-b-2 border-gray-300 pb-3 mb-8 flex items-center gap-3"
        )}
      >
        <Briefcase size={24} />
        담당 프로그램 ({parsed.length})
      </h3>
      {loading ? (
        <div className={cn("flex justify-center py-8")}>
          <div
            className={cn(
              "w-6 h-6 border-2 border-gray-200 border-t-white rounded-full animate-spin"
            )}
          />
        </div>
      ) : (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4")}>
          {parsed.map(({ title, url }, i) => {
            const content = programContents.get(title);
            const href = content
              ? `${RUNMOA_BASE}/classes/${content.content_id}`
              : url ?? null;

            const card = (
              <div
                className={cn(
                  "flex gap-4 bg-gray-50 border border-gray-100 rounded-sm p-4",
                  "hover:bg-gray-100 hover:border-gray-200 transition-all group"
                )}
              >
                {/* 미니 썸네일 (원본 비율) */}
                {content?.featured_image ? (
                  <div className={cn("w-20 flex-shrink-0 self-start")}>
                    <img
                      src={content.featured_image}
                      alt={title}
                      className={cn("w-full h-auto rounded")}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "w-20 h-16 flex-shrink-0 bg-gray-100 rounded flex items-center justify-center"
                    )}
                  >
                    <BookOpen size={20} className={cn("text-gray-400")} />
                  </div>
                )}
                {/* 정보 */}
                <div className={cn("flex-1 min-w-0")}>
                  <div className={cn("flex items-start justify-between gap-2")}>
                    <h4
                      className={cn(
                        "text-sm font-semibold text-gray-900 line-clamp-2"
                      )}
                    >
                      {title}
                    </h4>
                    {href && (
                      <ExternalLink
                        size={14}
                        className={cn(
                          "text-gray-400 group-hover:text-gray-500 flex-shrink-0 mt-0.5 transition-colors"
                        )}
                      />
                    )}
                  </div>
                  {content ? (
                    <>
                      <p className={cn("text-xs text-gray-500 mt-1 line-clamp-2")}>
                        {stripHtml(content.description_html).slice(0, 100)}
                      </p>
                      <div className={cn("flex items-center gap-2 mt-2 flex-wrap")}>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            content.content_type === "offline"
                              ? "bg-green-500/20 text-green-300"
                              : content.content_type === "live"
                                ? "bg-blue-500/20 text-brand-blue"
                                : content.content_type === "vod"
                                  ? "bg-purple-500/20 text-purple-300"
                                  : "bg-gray-500/20 text-gray-300"
                          )}
                        >
                          {content.content_type === "offline"
                            ? "오프라인"
                            : content.content_type === "live"
                              ? "라이브"
                              : content.content_type === "vod"
                                ? "VOD"
                                : "디지털콘텐츠"}
                        </span>
                        {content.is_free ? (
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300"
                            )}
                          >
                            무료
                          </span>
                        ) : (
                          <span className={cn("text-xs text-gray-400")}>
                            ₩
                            {(
                              content.is_on_sale
                                ? content.sale_price
                                : content.base_price
                            ).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className={cn("text-xs text-gray-400 mt-1")}>
                      프로그램 상세 정보가 없습니다
                    </p>
                  )}
                </div>
              </div>
            );

            return href ? (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {card}
              </a>
            ) : (
              <div key={i}>{card}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
/* ── /* ── Main Page ── */
export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<InstructorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstructor, setSelectedInstructor] = useState<InstructorItem | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "programs" | "comments">("profile");
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
        setInstructors(active.length > 0 ? active : (DEMO_INSTRUCTORS as InstructorItem[]));
      })
      .catch(() => setInstructors(DEMO_INSTRUCTORS as InstructorItem[]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedInstructor) {
      document.body.style.overflow = "hidden";
      setActiveTab("profile"); // reset active tab on open
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [selectedInstructor]);

  useEffect(() => {
    if (!selectedInstructor) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedInstructor(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedInstructor]);

  const imageSrc = (inst: InstructorItem) => inst.imageUrl || inst.profileImageUrl;

  return (
    <div className={cn("min-h-screen bg-gray-50")}>
      {/* ── HERO SECTION ── */}
      <div className={cn("bg-brand-blue pb-20 pt-28 px-4")}>
        <div className={cn("max-w-5xl mx-auto text-center animate-fade-in-up")}>
          <h1 className={cn("text-4xl md:text-5xl font-bold text-white tracking-tight mb-4")}>
            <span className="font-serif">AI</span> 산업 기술의 전문가들 지정
          </h1>
          <p className={cn("text-lg text-blue-100 max-w-2xl mx-auto mb-8")}>
            현업 최고의 전문 강사진이 여러분의 성공적인 AI 도입과 성장을 이끌어 드립니다.
          </p>
        </div>
      </div>

      {/* ── CARD GRID ── */}
      <div className={cn("max-w-6xl mx-auto px-4 -mt-16 pb-24")}>
        {loading && (
          <div className={cn("flex justify-center py-24")}>
            <div className={cn("w-10 h-10 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin")} />
          </div>
        )}

        <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6")}>
          {!loading && instructors.map((inst, i) => (
            <div
              key={inst.id}
              onClick={() => setSelectedInstructor(inst)}
              className={cn(
                "bg-white rounded-xl shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] border border-gray-100 p-6 flex flex-col items-center text-center cursor-pointer group hover:-translate-y-1.5 transition-all duration-300 animate-fade-in-up"
              )}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {/* 아바타 프로필 */}
              <div className={cn("relative w-28 h-28 rounded-full overflow-hidden mb-5 border-4 border-white shadow-md group-hover:shadow-xl transition-all duration-300 ring-2 ring-gray-50")}>
                {imageSrc(inst) ? (
                  <DriveOrExternalImage
                    src={imageSrc(inst)!}
                    alt={inst.name}
                    className={cn("w-full h-full object-cover")}
                    quiet
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand-gray to-gray-200 flex items-center justify-center">
                    <span className="text-3xl font-bold text-brand-blue">{inst.name.charAt(0)}</span>
                  </div>
                )}
              </div>

              {/* 기본 정보 */}
              <h3 className={cn("text-xl font-bold text-gray-900 mb-1 group-hover:text-brand-blue transition-colors")}>
                {inst.name}
              </h3>
              <p className={cn("text-sm text-gray-500 font-medium mb-4")}>
                {inst.title} · {inst.organization}
              </p>

              {/* 스킬 뱃지 */}
              <div className={cn("flex flex-wrap justify-center gap-1.5 mb-5")}>
                {(inst.specialties || []).slice(0, 3).map((s) => (
                  <span key={s} className={cn("px-2.5 py-1 bg-brand-lightBlue/10 text-brand-blue text-[11px] font-semibold rounded-md border border-brand-lightBlue/20")}>
                    {s}
                  </span>
                ))}
              </div>
              
              <div className="mt-auto pt-4 border-t border-gray-100 w-full">
                <span className="text-sm font-medium text-gray-400 group-hover:text-brand-blue transition-colors inline-flex items-center gap-1">
                  프로필 상세 보기 <ChevronRight size={14}/>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DRAWER (우측 슬라이드 탭 상세 모달) ── */}
      {selectedInstructor && (
        <>
          {/* Backdrop */}
          <div
            className={cn("fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity")}
            onClick={() => setSelectedInstructor(null)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div
            className={cn(
              "fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] md:w-[600px] lg:w-[700px] bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden"
            )}
            role="dialog"
            aria-modal="true"
          >
            {/* Header (Drawer 상단 툴바) */}
            <div className={cn("flex items-center justify-between px-6 py-4 border-b border-gray-100")}>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900">상세 프로필</h2>
                {isAdmin && (
                  <a
                    href={`/admin/instructors`}
                    className={cn("flex items-center gap-1.5 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors text-xs font-semibold")}
                    title="강사 정보 수정"
                  >
                    <Pencil size={14} /> 편집
                  </a>
                )}
              </div>
              <button
                onClick={() => setSelectedInstructor(null)}
                className={cn("p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors")}
                aria-label="닫기"
              >
                <X size={20} />
              </button>
            </div>

            {/* 커스텀 탭 네비게이션 */}
            <div className={cn("flex border-b border-gray-100 px-2")}>
              {[
                { id: "profile", label: "소개 & 이력" },
                { id: "programs", label: "담당 프로그램" },
                { id: "comments", label: "수강평" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex-1 py-4 px-4 text-sm font-semibold text-center border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-brand-blue text-brand-blue"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 탭 내용 (스크롤 영역) */}
            <div className={cn("flex-1 overflow-y-auto bg-gray-50 p-6")}>
              
              {/* Tab 1: Profile & Bio */}
              {activeTab === "profile" && (
                <div className="animate-fade-in-up space-y-10">
                  
                  {/* 상단 요약 (아바타 & 기본스펙) */}
                  <div className="flex flex-col md:flex-row gap-6 items-start bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 relative rounded-full overflow-hidden border-2 border-gray-100 shadow-sm">
                      {imageSrc(selectedInstructor) ? (
                        <DriveOrExternalImage
                          src={imageSrc(selectedInstructor)!}
                          alt={selectedInstructor.name}
                          className="w-full h-full object-cover"
                          quiet
                        />
                      ) : (
                        <div className="w-full h-full bg-brand-gray flex items-center justify-center">
                          <span className="text-4xl text-brand-blue font-bold">{selectedInstructor.name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedInstructor.name}</h2>
                      <p className="text-brand-blue font-medium mb-3">{selectedInstructor.title} · {selectedInstructor.organization}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {(selectedInstructor.specialties || []).map((s) => (
                          <span key={s} className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-md">
                            {s}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        {selectedInstructor.contactEmail?.trim() && (
                          <a href={`mailto:${selectedInstructor.contactEmail}`} className="text-gray-500 hover:text-brand-blue transition-colors" title="이메일">
                            <Mail size={18} />
                          </a>
                        )}
                        {(Object.entries(selectedInstructor.socialLinks || {}) as [keyof typeof SOCIAL_ICONS, string | null][]).map(([key, url]) => {
                          if (!url?.trim()) return null;
                          const Icon = SOCIAL_ICONS[key];
                          if (!Icon) return null;
                          return (
                            <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-brand-blue transition-colors">
                              <Icon size={18} />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* DOMPurify 상세 HTML 영역 (있는경우) + 기본 Bio (없을경우) */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3 flex items-center gap-2">
                       <User size={20} className="text-brand-blue" />
                       소개
                    </h3>
                    
                    {selectedInstructor.detailedHtml ? (
                      <div 
                        className="prose prose-sm sm:prose max-w-none prose-a:text-brand-blue hover:prose-a:text-brand-dark prose-headings:font-bold prose-img:rounded-xl"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedInstructor.detailedHtml) }}
                      />
                    ) : (
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {selectedInstructor.bio}
                      </p>
                    )}
                  </div>

                  {/* 이력 세부 (Education & Certifications) */}
                  {( (selectedInstructor.education && selectedInstructor.education.length > 0) || 
                     (selectedInstructor.certifications && selectedInstructor.certifications.length > 0) ) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {selectedInstructor.education && selectedInstructor.education.length > 0 && (
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <GraduationCap size={20} className="text-brand-blue" />
                            학력
                          </h3>
                          <div className="space-y-4">
                            {selectedInstructor.education.map((edu, i) => (
                              <div key={i} className="pl-3 border-l-2 border-brand-blue/30">
                                <p className="font-bold text-gray-900 text-sm">{edu.degree}</p>
                                <p className="text-gray-600 text-sm mt-0.5">{edu.institution}</p>
                                <p className="text-gray-400 text-xs mt-1">{edu.year}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedInstructor.certifications && selectedInstructor.certifications.length > 0 && (
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Award size={20} className="text-brand-blue" />
                            자격 및 활동
                          </h3>
                          <ul className="space-y-2">
                            {selectedInstructor.certifications.map((cert) => (
                              <li key={cert} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="text-brand-blue mt-0.5">•</span>
                                <span>{cert}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

              {/* Tab 2: Programs */}
              {activeTab === "programs" && (
                <div className="animate-fade-in-up space-y-10">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    {(selectedInstructor.programs || []).length > 0 ? (
                      <InstructorProgramsSection programs={selectedInstructor.programs || []} />
                    ) : (
                      <div className="text-center py-10">
                        <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">등록된 프로그램이 없습니다.</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <ClassHistorySection instructorName={selectedInstructor.name} />
                  </div>
                </div>
              )}

              {/* Tab 3: Comments */}
              {activeTab === "comments" && (
                <div className="animate-fade-in-up space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    {typeof selectedInstructor.id === "string" ? (
                      <CommentSection instructorId={selectedInstructor.id} />
                    ) : (
                      <p className="text-gray-500 text-center py-10">댓글을 불러올 수 없습니다.</p>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

          <style dangerouslySetInnerHTML={{
            __html: `
              @keyframes slideInRight {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
              .animate-slide-in-right {
                animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
              }
            `
          }} />
        </>
      )}
    </div>
  );
}
