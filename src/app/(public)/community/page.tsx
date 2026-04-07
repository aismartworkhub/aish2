"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Bell, FolderOpen, Award, HelpCircle, Handshake, Images, FileText,
  ChevronDown, ChevronUp, ExternalLink, Mail, Phone, Building,
  Star, Download, Eye, Pin, Search, X,
  MessageCircle, Send, Trash2, User,
} from "lucide-react";
import { cn, toDateString, isValidEmail, isValidPhone } from "@/lib/utils";
import { DEMO_FAQ } from "@/lib/demo-data";
import { getCollection, getFilteredCollection, createDoc, removeDoc, invalidateCache, COLLECTIONS } from "@/lib/firestore";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/public/LoginModal";
import { useToast } from "@/components/ui/Toast";
import type { Resource, PostComment } from "@/types/firestore";
import DriveOrExternalImage from "@/components/ui/DriveOrExternalImage";

type TabKey = "notice" | "resource" | "certificate" | "faq" | "inquiry" | "gallery" | string;

const FIXED_TABS: { key: TabKey; label: string; icon: React.ElementType; color: string }[] = [
  { key: "notice", label: "공지사항", icon: Bell, color: "text-blue-600 bg-blue-50" },
  { key: "resource", label: "자료실", icon: FolderOpen, color: "text-green-600 bg-green-50" },
  { key: "certificate", label: "수료증 발급", icon: Award, color: "text-purple-600 bg-purple-50" },
  { key: "faq", label: "FAQ", icon: HelpCircle, color: "text-yellow-600 bg-yellow-50" },
  { key: "inquiry", label: "협력 문의", icon: Handshake, color: "text-red-600 bg-red-50" },
  { key: "gallery", label: "갤러리", icon: Images, color: "text-pink-600 bg-pink-50" },
];

const NOTICES: { id: string | number; title: string; date: string; views: number; pinned: boolean }[] = [
  { id: 1, title: "[모집] AI 기초 정규과정 11기 수강생 모집 안내", date: "2026.03.15", views: 234, pinned: true },
  { id: 2, title: "[안내] 2026년 상반기 교육 일정 안내", date: "2026.03.10", views: 189, pinned: true },
  { id: 3, title: "[소식] 제3회 스마트워크톤 결과 발표", date: "2026.02.28", views: 145, pinned: false },
  { id: 4, title: "[안내] 신규 강사진 소개", date: "2026.02.20", views: 98, pinned: false },
  { id: 5, title: "[소식] 누적 수강생 1,500명 돌파", date: "2026.02.15", views: 76, pinned: false },
];

const RESOURCES: { id: string | number; title: string; author: string; date: string; downloads: number; type: string; url?: string }[] = [
  { id: 1, title: "AI 기초 11기 - 1주차 강의자료", author: "김상용", date: "2026.03.15", downloads: 156, type: "PDF" },
  { id: 2, title: "프롬프트 엔지니어링 실습 가이드", author: "김상용", date: "2026.03.14", downloads: 98, type: "PDF" },
  { id: 3, title: "데이터 분석 실습 데이터셋", author: "김학태", date: "2026.03.10", downloads: 76, type: "ZIP" },
  { id: 4, title: "바이브 코딩 입문 자료", author: "제갈정", date: "2026.03.05", downloads: 54, type: "PDF" },
];

const GALLERY_IMAGES: { id: string | number; title: string; category: string; imageUrl: string }[] = [
  { id: 1, title: "AI 기초 정규과정 10기 수료식", category: "교육", imageUrl: "/images/defaults/spec-community.jpg" },
  { id: 2, title: "제3회 스마트워크톤 현장", category: "워크톤", imageUrl: "/images/defaults/workathon-bg.jpg" },
  { id: 3, title: "데이터 분석 실습 현장", category: "교육", imageUrl: "/images/defaults/edu-data.jpg" },
  { id: 4, title: "강사진 워크숍", category: "행사", imageUrl: "/images/defaults/spec-practice.jpg" },
  { id: 5, title: "AI 기초 강의 현장", category: "교육", imageUrl: "/images/defaults/edu-ai.jpg" },
  { id: 6, title: "네트워킹 행사", category: "행사", imageUrl: "/images/defaults/spec-system.jpg" },
];

function PostCommentSection({ postId, postType }: { postId: string; postType: "NOTICE" | "RESOURCE" }) {
  const { user, profile, isAdmin } = useAuth();
  const [comments, setComments] = useState<(PostComment & { id: string })[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getFilteredCollection<PostComment & { id: string }>(COLLECTIONS.POST_COMMENTS, "postId", postId);
      data.sort((a, b) => {
        const ta = typeof a.createdAt === "object" && a.createdAt ? (a.createdAt as unknown as { seconds: number }).seconds * 1000 : new Date(a.createdAt).getTime();
        const tb = typeof b.createdAt === "object" && b.createdAt ? (b.createdAt as unknown as { seconds: number }).seconds * 1000 : new Date(b.createdAt).getTime();
        return tb - ta;
      });
      setComments(data);
    } catch { setComments([]); }
    finally { setLoaded(true); }
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    try {
      await createDoc(COLLECTIONS.POST_COMMENTS, {
        postId, postType,
        authorUid: user.uid,
        authorName: profile?.name || user.displayName || "익명",
        authorEmail: user.email || "",
        authorPhotoURL: user.photoURL || null,
        content: newComment.trim(),
      });
      setNewComment("");
      invalidateCache(COLLECTIONS.POST_COMMENTS);
      await load();
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    await removeDoc(COLLECTIONS.POST_COMMENTS, id);
    invalidateCache(COLLECTIONS.POST_COMMENTS);
    await load();
  };

  const formatTime = (ts: unknown) => {
    if (!ts) return "";
    const ms = typeof ts === "object" && ts !== null && "seconds" in ts
      ? (ts as { seconds: number }).seconds * 1000
      : new Date(ts as string).getTime();
    return new Date(ms).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
        <MessageCircle size={14} /> 댓글 {loaded ? `(${comments.length})` : ""}
      </h4>
      {user ? (
        <div className="flex gap-2 mb-4">
          <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)}
            placeholder="댓글을 입력하세요..." rows={2}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
          <button onClick={handleSubmit} disabled={!newComment.trim() || submitting}
            className="btn-primary btn-sm self-end disabled:opacity-40">
            <Send size={14} />{submitting ? "..." : "작성"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-3">댓글을 작성하려면 로그인이 필요합니다.</p>
      )}
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
              {c.authorPhotoURL ? <img src={c.authorPhotoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={14} className="text-gray-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-800">{c.authorName}</span>
                <span className="text-[10px] text-gray-400">{formatTime(c.createdAt)}</span>
                {(user?.uid === c.authorUid || isAdmin) && (
                  <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-400 ml-auto"><Trash2 size={12} /></button>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommunityContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam || "notice");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [inquiryForm, setInquiryForm] = useState({ name: "", email: "", phone: "", company: "", subject: "", message: "" });
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [certEmail, setCertEmail] = useState("");
  const [certName, setCertName] = useState("");
  const [certSearched, setCertSearched] = useState(false);
  const [certResult, setCertResult] = useState<{ courseName: string; completionDate: string; cohort: string; status: string } | null>(null);
  const [certLoading, setCertLoading] = useState(false);

  const [faqList, setFaqList] = useState(DEMO_FAQ);
  const [noticeList, setNoticeList] = useState(NOTICES);
  const [resourceList, setResourceList] = useState(RESOURCES);
  const [galleryList, setGalleryList] = useState(GALLERY_IMAGES);
  const [customBoards, setCustomBoards] = useState<{ boardType: string; posts: { id: string; title: string; date: string; views: number; pinned: boolean; content?: string }[] }[]>([]);
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | number | null>(null);
  const [expandedResourceId, setExpandedResourceId] = useState<string | number | null>(null);
  const [expandedCustomPostId, setExpandedCustomPostId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ imageUrl: string; title: string } | null>(null);

  const { user, showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const { isProfileComplete } = useAuth();
  const [driveResources, setDriveResources] = useState<(Resource & { id: string })[]>([]);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    Promise.all([
      getCollection<typeof DEMO_FAQ[0]>(COLLECTIONS.FAQ),
      getCollection<{ id: string; type?: string; boardType?: string; title: string; category?: string; createdAt?: string; date?: string; views?: number; pinned?: boolean; isPinned?: boolean; author?: string; downloads?: number; fileType?: string }>(COLLECTIONS.POSTS),
      getCollection<{ id: number | string; title: string; category: string; imageUrl: string }>(COLLECTIONS.GALLERY),
    ]).then(([faq, posts, gallery]) => {
      if (faq.length > 0) {
        const sortedFaq = [...faq].sort(
          (a, b) =>
            ((a as { displayOrder?: number }).displayOrder ?? 999) -
            ((b as { displayOrder?: number }).displayOrder ?? 999)
        );
        setFaqList(sortedFaq);
      }
      if (posts.length > 0) {
        const getType = (p: { type?: string; boardType?: string }) => p.type || p.boardType || "";
        const n = posts.filter((p) => getType(p) === "NOTICE").map((p) => ({
          id: p.id, title: p.title, date: toDateString(p.createdAt || p.date), views: p.views || 0, pinned: p.pinned || p.isPinned || false,
        }));
        const r = posts.filter((p) => getType(p) === "RESOURCE").map((p) => ({
          id: p.id, title: p.title, author: p.author || "", date: toDateString(p.createdAt || p.date), downloads: p.downloads || 0, type: p.fileType || "PDF",
        }));
        if (n.length > 0) setNoticeList(n);
        if (r.length > 0) setResourceList(r);
        // Drive 자료실 로드
        getCollection<Resource & { id: string }>(COLLECTIONS.RESOURCES)
          .then((res) => { if (res.length > 0) setDriveResources(res); })
          .catch(() => {});
        // 커스텀 게시판 수집
        const knownTypes = ["NOTICE", "RESOURCE"];
        const customTypes = [...new Set(posts.map((p) => getType(p)).filter((t) => t && !knownTypes.includes(t)))];
        if (customTypes.length > 0) {
          setCustomBoards(customTypes.map((bt) => ({
            boardType: bt,
            posts: posts.filter((p) => getType(p) === bt).map((p) => ({
              id: p.id, title: p.title, date: toDateString(p.createdAt || p.date), views: p.views || 0, pinned: p.pinned || p.isPinned || false,
            })),
          })));
        }
      }
      if (gallery.length > 0) {
        const sortedGallery = [...gallery].sort((a, b) => {
          const da = String((a as { date?: string }).date || "");
          const db = String((b as { date?: string }).date || "");
          return db.localeCompare(da);
        });
        setGalleryList(sortedGallery);
      }
    }).catch(console.error);
  }, []);

  const [inquiryError, setInquiryError] = useState("");

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryError("");

    const { name, email, phone, subject, message } = inquiryForm;
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setInquiryError("필수 항목을 모두 입력해주세요.");
      return;
    }
    if (!isValidEmail(email)) {
      setInquiryError("올바른 이메일 형식을 입력해주세요.");
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setInquiryError("올바른 전화번호 형식을 입력해주세요. (예: 010-0000-0000)");
      return;
    }

    requireLogin(async () => {
      try {
        await createDoc(COLLECTIONS.INQUIRIES, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          company: inquiryForm.company.trim(),
          subject: subject.trim(),
          message: message.trim(),
          status: "NEW",
          type: "PARTNERSHIP",
          userId: user?.uid,
          userEmail: user?.email,
          date: new Date().toISOString().slice(0, 10),
          adminNote: "",
          replyContent: "",
          emailSent: false,
          category: "PARTNERSHIP",
          content: message.trim(),
        });
        setInquirySubmitted(true);
      } catch {
        setInquiryError("문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    }, "협력 문의를 보내려면 로그인이 필요합니다.");
  };

  const handleDownload = (resTitle: string, resUrl?: string) => {
    requireLogin(() => {
      if (resUrl?.trim()) {
        window.open(resUrl, "_blank");
        toast(`"${resTitle}" 다운로드를 시작합니다.`, "info");
      } else {
        toast("다운로드 링크가 등록되지 않았습니다", "error");
      }
    }, "자료를 다운로드하려면 로그인이 필요합니다.");
  };

  const handleCertSearch = () => {
    requireLogin(async () => {
      setCertLoading(true);
      setCertResult(null);
      try {
        const [graduates, cohorts] = await Promise.all([
          getCollection<{ id: string; email: string; name: string; cohortId: string; status: string; courseName?: string; completionDate?: string; cohort?: string }>(COLLECTIONS.CERTIFICATES_GRADUATES),
          getCollection<{ id: string; name: string; programTitle: string; endDate: string }>(COLLECTIONS.CERTIFICATES_COHORTS),
        ]);
        const emailLower = certEmail.trim().toLowerCase();
        const nameTrimmed = certName.trim();
        const match = graduates.find((g) => {
          const emailMatch = emailLower && g.email.toLowerCase() === emailLower;
          const nameMatch = nameTrimmed && g.name === nameTrimmed;
          const isEligible = g.status === "수료" || g.status === "졸업";
          return (emailMatch || nameMatch) && isEligible;
        });
        if (match) {
          const cohort = cohorts.find((c) => c.id === match.cohortId);
          setCertResult({
            courseName: match.courseName || cohort?.programTitle || "과정명 미등록",
            completionDate: match.completionDate || cohort?.endDate || "",
            cohort: match.cohort || cohort?.name || "",
            status: match.status,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCertSearched(true);
        setCertLoading(false);
      }
    }, "수료증을 조회하려면 로그인이 필요합니다.");
  };

  return (
    <div className="py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">커뮤니티</h1>
          <p className="text-lg text-gray-500">
            AISH 커뮤니티에서 다양한 정보와 서비스를 이용하세요.
          </p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="relative mb-10 border-b border-gray-200" role="tablist">
          <div className="flex overflow-x-auto scrollbar-hide -mb-px">
            {[...FIXED_TABS, ...customBoards.map((cb) => ({
              key: cb.boardType.toLowerCase(),
              label: cb.boardType,
              icon: FileText,
              color: "text-gray-600 bg-gray-50",
            }))].map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap px-5 py-3 text-sm font-medium transition-all",
                  activeTab === tab.key
                    ? "border-b-2 border-primary-600 text-primary-600 font-semibold bg-transparent"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-700 bg-transparent"
                )}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 공지사항 */}
        {activeTab === "notice" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">공지사항</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {noticeList.map((notice) => (
                <div key={notice.id}>
                  <button
                    onClick={() => setExpandedNoticeId(expandedNoticeId === notice.id ? null : notice.id)}
                    className="w-full flex items-center px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    {notice.pinned && <Pin size={14} className="text-primary-500 mr-2 shrink-0" />}
                    <span className={cn("text-sm flex-1", notice.pinned ? "font-semibold text-gray-900" : "text-gray-700")}>
                      {notice.title}
                    </span>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Eye size={12} />{notice.views}</span>
                      <span className="text-xs text-gray-400">{notice.date}</span>
                      {expandedNoticeId === notice.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>
                  {expandedNoticeId === notice.id && (
                    <div className="px-6 pb-6 bg-gray-50 border-t border-gray-100 space-y-4">
                      <div className="pt-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {(notice as { content?: string }).content || "상세 내용은 추후 업데이트 예정입니다."}
                      </div>
                      <PostCommentSection postId={String(notice.id)} postType="NOTICE" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 자료실 */}
        {activeTab === "resource" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">자료실</h2>
              <p className="text-sm text-gray-500 mt-1">교육 자료와 참고 문서를 다운로드하세요.</p>
            </div>

            {/* 프로필 미완성 안내 */}
            {user && !isProfileComplete && (
              <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">프로필 완성이 필요합니다</p>
                <p className="text-xs mt-1 text-amber-700">자료를 다운로드하려면 <a href="/profile" className="underline font-medium">프로필 설정</a>에서 이름, 기수, 연락처를 입력해 주세요.</p>
              </div>
            )}

            {/* Drive 자료 (Google Drive 연동) */}
            {driveResources.length > 0 && (
              <div className="divide-y divide-gray-50">
                {driveResources.map((res) => (
                  <div key={res.id}>
                    <button
                      onClick={() => setExpandedResourceId(expandedResourceId === res.id ? null : res.id)}
                      className="w-full flex items-center px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{res.title}</p>
                        <p className="text-xs text-gray-400 mt-1">{res.uploaderName} · {res.fileSize}</p>
                        {res.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">{res.tags.slice(0, 3).map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{t}</span>)}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-4">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{res.fileType.toUpperCase()}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1"><Download size={12} />{res.downloads}</span>
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); requireLogin(() => {
                            if (!isProfileComplete) { toast("프로필을 먼저 완성해 주세요.", "info"); return; }
                            window.open(res.driveDownloadUrl, "_blank");
                          }, "자료 다운로드는 로그인이 필요합니다."); }}
                          className="p-2 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors"
                        >
                          <Download size={16} />
                        </span>
                        {expandedResourceId === res.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </button>
                    {expandedResourceId === res.id && (
                      <div className="px-6 pb-6 bg-gray-50 border-t border-gray-100 space-y-3">
                        {res.description && <p className="text-sm text-gray-700">{res.description}</p>}
                        {res.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">{res.tags.map((t) => <span key={t} className="badge-base bg-gray-100 text-gray-600">{t}</span>)}</div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{res.fileType.toUpperCase()} · {res.fileSize}</span>
                          <span>다운로드 {res.downloads}회</span>
                          {res.driveViewUrl && <a href={res.driveViewUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">미리보기</a>}
                        </div>
                        <PostCommentSection postId={String(res.id)} postType="RESOURCE" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 기존 게시판 자료 (Firestore posts) */}
            <div className="divide-y divide-gray-50">
              {resourceList.map((res) => (
                <div key={res.id} className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{res.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{res.author} · {res.date}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{res.type}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Download size={12} />{res.downloads}</span>
                    <button onClick={() => handleDownload(res.title, (res as { url?: string }).url)} className="p-2 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors">
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {driveResources.length === 0 && resourceList.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">등록된 자료가 없습니다.</div>
            )}
          </div>
        )}

        {/* 수료증 발급 */}
        {activeTab === "certificate" && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
                  <Award size={32} className="text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">수료증 발급</h2>
                <p className="text-sm text-gray-500 mt-2">
                  수강 시 등록한 이메일로 수료증 발급 여부를 확인할 수 있습니다.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">등록 이메일</label>
                  <input
                    type="email"
                    value={certEmail}
                    onChange={(e) => { setCertEmail(e.target.value); setCertSearched(false); setCertResult(null); }}
                    placeholder="수강 신청 시 사용한 이메일을 입력하세요"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">이름 (선택)</label>
                  <input
                    type="text"
                    value={certName}
                    onChange={(e) => { setCertName(e.target.value); setCertSearched(false); setCertResult(null); }}
                    placeholder="이메일로 찾을 수 없을 때 이름으로 검색합니다"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <button
                  onClick={() => handleCertSearch()}
                  disabled={(!certEmail.trim() && !certName.trim()) || certLoading}
                  className="w-full py-3 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {certLoading ? "조회 중..." : "수료증 조회"}
                </button>
                {certSearched && !certResult && (
                  <div className="bg-yellow-50 text-yellow-700 text-sm p-4 rounded-lg">
                    <p className="font-medium mb-1">수료 정보를 찾을 수 없습니다.</p>
                    <ul className="text-yellow-600 text-xs space-y-1 mt-2 list-disc list-inside">
                      <li>수강 신청 시 등록한 이메일과 동일한지 확인해 주세요.</li>
                      <li>이메일로 찾을 수 없는 경우 이름으로도 검색해 보세요.</li>
                      <li>수료 또는 졸업 상태인 수강생만 조회 가능합니다.</li>
                      <li>관리자가 아직 수료 정보를 등록하지 않았을 수 있습니다.</li>
                      <li>문의사항은 <button type="button" onClick={() => setActiveTab("inquiry")} className="underline font-medium">협력 문의</button> 탭을 이용해 주세요.</li>
                    </ul>
                  </div>
                )}
                {certResult && (
                  <div className="bg-green-50 text-green-700 text-sm p-4 rounded-lg">
                    <p className="font-medium mb-2">수료 정보가 확인되었습니다!</p>
                    <div className="space-y-1 text-green-600 text-xs">
                      <p>과정명: <strong>{certResult.courseName}</strong></p>
                      <p>기수: <strong>{certResult.cohort}</strong></p>
                      <p>상태: <strong>{certResult.status}</strong></p>
                      <p>수료일: <strong>{certResult.completionDate}</strong></p>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-6 text-center">
                * 이메일로 수료 여부를 확인합니다.
              </p>
            </div>
          </div>
        )}

        {/* FAQ */}
        {activeTab === "faq" && (
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">자주 묻는 질문</h2>
            </div>
            {faqList.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-900 pr-4">{faq.question}</span>
                  {openFaqIndex === index ? (
                    <ChevronUp size={18} className="text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-gray-400 shrink-0" />
                  )}
                </button>
                {openFaqIndex === index && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    <p className="text-sm text-gray-600 leading-relaxed pt-4">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 협력 문의 */}
        {activeTab === "inquiry" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2">협력 문의</h2>
              <p className="text-sm text-gray-500 mb-6">교육 협력 및 제휴를 문의해 주세요. 담당자가 빠르게 연락드리겠습니다.</p>

              {inquirySubmitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">문의가 접수되었습니다</h3>
                  <p className="text-sm text-gray-500">담당자 확인 후 입력하신 이메일로 답변드리겠습니다.</p>
                  <button
                    onClick={() => { setInquirySubmitted(false); setInquiryForm({ name: "", email: "", phone: "", company: "", subject: "", message: "" }); }}
                    className="mt-6 px-6 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    새 문의 작성
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">이름 *</label>
                      <input type="text" required value={inquiryForm.name} onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">이메일 *</label>
                      <input type="email" required value={inquiryForm.email} onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">연락처</label>
                      <input type="tel" value={inquiryForm.phone} onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                        placeholder="010-0000-0000"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">소속/회사</label>
                      <input type="text" value={inquiryForm.company} onChange={(e) => setInquiryForm({ ...inquiryForm, company: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">제목 *</label>
                    <input type="text" required value={inquiryForm.subject} onChange={(e) => setInquiryForm({ ...inquiryForm, subject: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">문의 내용 *</label>
                    <textarea rows={5} required value={inquiryForm.message} onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                      placeholder="문의 내용을 입력해 주세요..."
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
                  </div>
                  {inquiryError && (
                    <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{inquiryError}</p>
                  )}
                  <button type="submit"
                    className="w-full py-3 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
                    문의 보내기
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 갤러리 */}
        {activeTab === "gallery" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">갤러리</h2>
              <p className="text-sm text-gray-500 mt-1">교육 현장과 행사 사진을 둘러보세요.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {galleryList.map((img) => (
                <div
                  key={img.id}
                  className="group relative rounded-xl overflow-hidden aspect-[4/3] cursor-pointer bg-gray-100"
                  onClick={() => setLightboxImage({ imageUrl: img.imageUrl, title: img.title })}
                >
                  <DriveOrExternalImage
                    src={img.imageUrl}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    quiet
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 w-full p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs px-2 py-0.5 rounded bg-white/20 backdrop-blur">{img.category}</span>
                    <p className="text-sm font-medium mt-1">{img.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 커스텀 게시판 */}
        {customBoards.map((cb) => (
          activeTab === cb.boardType.toLowerCase() && (
            <div key={cb.boardType} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">{cb.boardType}</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {cb.posts.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-400 text-sm">게시물이 없습니다.</div>
                ) : cb.posts.map((post) => (
                  <div key={post.id}>
                    <button
                      onClick={() => setExpandedCustomPostId(expandedCustomPostId === post.id ? null : post.id)}
                      className="w-full flex items-center px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      {post.pinned && <Pin size={14} className="text-primary-500 mr-2 shrink-0" />}
                      <span className={cn("text-sm flex-1", post.pinned ? "font-semibold text-gray-900" : "text-gray-700")}>
                        {post.title}
                      </span>
                      <div className="flex items-center gap-4 shrink-0 ml-4">
                        <span className="text-xs text-gray-400 flex items-center gap-1"><Eye size={12} />{post.views}</span>
                        <span className="text-xs text-gray-400">{post.date}</span>
                        {expandedCustomPostId === post.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </button>
                    {expandedCustomPostId === post.id && (
                      <div className="px-6 pb-4 text-sm text-gray-600 bg-gray-50 border-t border-gray-100">
                        <p className="pt-3">{post.content || "상세 내용은 추후 업데이트 예정입니다."}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
      {/* Gallery Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <X size={32} />
          </button>
          <div className="max-w-5xl w-full max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <DriveOrExternalImage
              src={lightboxImage.imageUrl}
              alt={lightboxImage.title}
              className="w-full max-h-[85vh] object-contain rounded-lg"
            />
            <p className="text-white text-center mt-3 text-sm font-medium">{lightboxImage.title}</p>
          </div>
        </div>
      )}
      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-gray-400">로딩 중...</div>}>
      <CommunityContent />
    </Suspense>
  );
}
