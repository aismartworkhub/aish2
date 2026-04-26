"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Bell, FolderOpen, Award, HelpCircle, Handshake, Images, FileText,
  ChevronDown, ChevronUp, ExternalLink, Mail, Phone, Building,
  Star, Download, Eye, Pin, Search, X,
  MessageCircle, Send, Trash2, User, Heart, BookmarkPlus, Plus, Play, LayoutGrid,
} from "lucide-react";
import { cn, toDateString, isValidEmail, isValidPhone } from "@/lib/utils";
import { DEMO_FAQ } from "@/lib/demo-data";
import { getCollection, getFilteredCollection, createDoc, removeDoc, invalidateCache, COLLECTIONS } from "@/lib/firestore";
import { getContents, getBoardsByGroup } from "@/lib/content-engine";
import { loadPageContent, DEFAULT_COMMUNITY } from "@/lib/page-content-public";
import type { PageContentBase } from "@/types/page-content";
import DOMPurify from "dompurify";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import { useAuth } from "@/contexts/AuthContext";
import RatingSummary from "@/components/community/RatingSummary";
import CommunityFreeTimeline from "@/components/community/CommunityFreeTimeline";
import { useUiMode } from "@/hooks/useUiMode";
import { createNotification } from "@/lib/notification-service";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import LoginModal from "@/components/public/LoginModal";
import { useToast } from "@/components/ui/Toast";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Resource, PostComment, Like, Bookmark } from "@/types/firestore";
import DriveOrExternalImage from "@/components/ui/DriveOrExternalImage";

const LEGACY_POST_PREFIX = "legacy-post-";

/** posts 컬렉션 id와 contents 마이그레이션 id(legacy-post-*)를 동일 건으로 병합 */
function canonicalCommunityPostId(id: string | number): string {
  const s = String(id);
  return s.startsWith(LEGACY_POST_PREFIX) ? s.slice(LEGACY_POST_PREFIX.length) : s;
}

type NoticeRow = {
  id: string | number;
  title: string;
  date: string;
  views: number;
  pinned: boolean;
  content?: string;
  authorUid?: string;
};

function mergeNoticeRowsByCanonicalId(fromPosts: NoticeRow[], fromContents: NoticeRow[]): NoticeRow[] {
  const map = new Map<string, NoticeRow>();
  for (const p of fromPosts) {
    map.set(canonicalCommunityPostId(p.id), { ...p });
  }
  for (const m of fromContents) {
    const key = canonicalCommunityPostId(m.id);
    const prev = map.get(key);
    map.set(key, {
      ...(prev ?? { id: m.id, title: m.title, date: m.date, views: m.views, pinned: m.pinned }),
      ...m,
      authorUid: m.authorUid || prev?.authorUid,
      content: m.content ?? prev?.content,
    });
  }
  return Array.from(map.values());
}

type FreeRow = { id: string; title: string; content: string; authorName: string; date: string; views: number; isApproved: boolean; authorUid: string };

function mergeFreeRowsByCanonicalId(fromPosts: FreeRow[], fromContents: FreeRow[]): FreeRow[] {
  const map = new Map<string, FreeRow>();
  for (const p of fromPosts) {
    map.set(canonicalCommunityPostId(p.id), { ...p });
  }
  for (const m of fromContents) {
    map.set(canonicalCommunityPostId(m.id), { ...m });
  }
  return Array.from(map.values());
}

type TabKey = "all" | "notice" | "resource" | "certificate" | "faq" | "inquiry" | "gallery" | string;

const ALL_TAB_KEY: TabKey = "all";

const FIXED_TABS: { key: TabKey; label: string; icon: React.ElementType; color: string }[] = [
  { key: "notice", label: "공지사항", icon: Bell, color: "text-blue-600 bg-blue-50" },
  { key: "free", label: "묻고 답하기", icon: MessageCircle, color: "text-indigo-600 bg-indigo-50" },
  { key: "review", label: "수강후기", icon: Star, color: "text-orange-600 bg-orange-50" },
  { key: "resource", label: "교육자료", icon: FolderOpen, color: "text-green-600 bg-green-50" },
  { key: "faq", label: "FAQ", icon: HelpCircle, color: "text-yellow-600 bg-yellow-50" },
  { key: "gallery", label: "갤러리", icon: Images, color: "text-pink-600 bg-pink-50" },
];

const NOTICES: { id: string | number; title: string; date: string; views: number; pinned: boolean }[] = [
  { id: "test-push", title: "[테스트] 깃허브 푸시 기능 테스트 게시글입니다", date: "2026.04.24", views: 0, pinned: true },
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

const GALLERY_IMAGES: { id: string | number; title: string; category: string; imageUrl: string; isVideo?: boolean; youtubeUrl?: string; date?: string }[] = [
  { id: 1, title: "AI 기초 정규과정 10기 수료식", category: "교육", imageUrl: "/images/defaults/spec-community.jpg" },
  { id: 2, title: "제3회 스마트워크톤 현장", category: "워크톤", imageUrl: "/images/defaults/workathon-bg.jpg" },
  { id: 3, title: "데이터 분석 실습 현장", category: "교육", imageUrl: "/images/defaults/edu-data.jpg" },
  { id: 4, title: "강사진 워크숍", category: "행사", imageUrl: "/images/defaults/spec-practice.jpg" },
  { id: 5, title: "AI 기초 강의 현장", category: "교육", imageUrl: "/images/defaults/edu-ai.jpg" },
  { id: 6, title: "네트워킹 행사", category: "행사", imageUrl: "/images/defaults/spec-system.jpg" },
];

function PostCommentSection({
  postId,
  postType,
  postAuthorUid,
  postTitle,
}: {
  postId: string;
  postType: "NOTICE" | "RESOURCE" | "FREE";
  postAuthorUid?: string;
  postTitle?: string;
}) {
  const { user, profile, isAdmin } = useAuth();
  const [comments, setComments] = useState<(PostComment & { id: string })[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

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

  const topLevel = useMemo(() => comments.filter((c) => !c.parentId), [comments]);
  const repliesMap = useMemo(() => {
    const map = new Map<string, (PostComment & { id: string })[]>();
    comments.filter((c) => c.parentId).forEach((c) => {
      const list = map.get(c.parentId!) || [];
      list.push(c);
      map.set(c.parentId!, list);
    });
    return map;
  }, [comments]);

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
      const sender = profile?.name || user.displayName || "회원";
      const tabSlug = postType === "NOTICE" ? "notice" : postType === "RESOURCE" ? "resource" : "free";
      if (postAuthorUid && postAuthorUid !== user.uid) {
        void createNotification({
          recipientUid: postAuthorUid,
          type: "comment",
          title: "새 댓글",
          message: `${sender}님이 "${postTitle || "게시글"}"에 댓글을 남겼습니다.`,
          linkUrl: `/community?tab=${tabSlug}&postId=${encodeURIComponent(postId)}`,
          senderUid: user.uid,
          senderName: sender,
        });
      }
      setNewComment("");
      invalidateCache(COLLECTIONS.POST_COMMENTS);
      await load();
    } finally { setSubmitting(false); }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !user || !replyingTo) return;
    setSubmitting(true);
    try {
      await createDoc(COLLECTIONS.POST_COMMENTS, {
        postId, postType, parentId: replyingTo,
        authorUid: user.uid,
        authorName: profile?.name || user.displayName || "익명",
        authorEmail: user.email || "",
        authorPhotoURL: user.photoURL || null,
        content: replyContent.trim(),
      });
      const sender = profile?.name || user.displayName || "회원";
      const tabSlug = postType === "NOTICE" ? "notice" : postType === "RESOURCE" ? "resource" : "free";
      if (postAuthorUid && postAuthorUid !== user.uid) {
        void createNotification({
          recipientUid: postAuthorUid,
          type: "reply",
          title: "새 답글",
          message: `${sender}님이 "${postTitle || "게시글"}"에 답글을 남겼습니다.`,
          linkUrl: `/community?tab=${tabSlug}&postId=${encodeURIComponent(postId)}`,
          senderUid: user.uid,
          senderName: sender,
        });
      }
      setReplyContent(""); setReplyingTo(null);
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

  const renderComment = (c: PostComment & { id: string }, isReply: boolean) => (
    <div key={c.id} className={cn("flex gap-2", isReply && "ml-9 border-l-2 border-brand-border pl-3")}>
      <div className="w-7 h-7 rounded-full bg-brand-gray shrink-0 overflow-hidden flex items-center justify-center">
        {c.authorPhotoURL ? <img src={c.authorPhotoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={14} className="text-gray-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-800">{c.authorName}</span>
          <span className="text-[10px] text-gray-400">{formatTime(c.createdAt)}</span>
          {!isReply && user && (
            <button onClick={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyContent(""); }}
              className="text-[10px] text-gray-400 hover:text-brand-blue">답글</button>
          )}
          {(user?.uid === c.authorUid || isAdmin) && (
            <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-400 ml-auto"><Trash2 size={12} /></button>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{c.content}</p>
      </div>
    </div>
  );

  return (
    <div className="mt-4 pt-4 border-t border-brand-border">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
        <MessageCircle size={14} /> 댓글 {loaded ? `(${comments.length})` : ""}
      </h4>
      {user ? (
        <div className="flex gap-2 mb-4">
          <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)}
            placeholder="댓글을 입력하세요..." rows={2}
            className="flex-1 px-3 py-2 border border-brand-border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none" />
          <button onClick={handleSubmit} disabled={!newComment.trim() || submitting}
            className="btn-primary btn-sm self-end disabled:opacity-40">
            <Send size={14} />{submitting ? "..." : "작성"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-3">댓글을 작성하려면 로그인이 필요합니다.</p>
      )}
      <div className="space-y-3">
        {topLevel.map((c) => (
          <div key={c.id}>
            {renderComment(c, false)}
            {replyingTo === c.id && user && (
              <div className="ml-9 border-l-2 border-brand-border pl-3 mt-2 flex gap-2">
                <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="답글을 입력하세요..." rows={2}
                  className="flex-1 px-3 py-2 border border-brand-border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none" />
                <div className="flex flex-col gap-1 self-end">
                  <button onClick={handleReply} disabled={!replyContent.trim() || submitting}
                    className="btn-primary btn-sm disabled:opacity-40">
                    <Send size={14} />{submitting ? "..." : "답글"}
                  </button>
                  <button onClick={() => { setReplyingTo(null); setReplyContent(""); }}
                    className="btn-secondary btn-sm text-xs">취소</button>
                </div>
              </div>
            )}
            {(repliesMap.get(c.id) || []).map((r) => renderComment(r, true))}
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
  const postIdFromUrl = searchParams.get("postId");
  const ff = useFeatureFlags();
  const showPopularPosts = ff.phase4.enabled && ff.phase4.popularPosts === true;
  const [pc, setPc] = useState<PageContentBase>(DEFAULT_COMMUNITY);
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam || ALL_TAB_KEY);
  const { mode: uiMode, setMode: setUiMode, hydrated: uiHydrated } = useUiMode();
  // hydration 전엔 새 디자인 가정. 자유 탭만 X 스타일로 전환 (공지·FAQ·후기·자료 등은 그대로).
  const isLegacyCommunity = uiHydrated && uiMode === "legacy";
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
  const [noticeSort, setNoticeSort] = useState<"latest" | "views" | "title">("latest");
  const [resourceList, setResourceList] = useState(RESOURCES);
  const [galleryList, setGalleryList] = useState(GALLERY_IMAGES);
  const [customBoards, setCustomBoards] = useState<{ boardType: string; posts: { id: string; title: string; date: string; views: number; pinned: boolean; content?: string }[] }[]>([]);
  const [dynamicBoards, setDynamicBoards] = useState<{ key: string; label: string; contents: { id: string; title: string; body?: string; date: string; views: number; pinned: boolean; authorName: string }[] }[]>([]);
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | number | null>(null);
  const [expandedResourceId, setExpandedResourceId] = useState<string | number | null>(null);
  const [expandedCustomPostId, setExpandedCustomPostId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ imageUrl: string; title: string } | null>(null);

  const { user, showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const { profile, isProfileComplete } = useAuth();
  const [driveResources, setDriveResources] = useState<(Resource & { id: string })[]>([]);

  // 좋아요 / 북마크
  const [likes, setLikes] = useState<Map<string, boolean>>(new Map());
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(new Map());
  const [bookmarks, setBookmarks] = useState<Map<string, boolean>>(new Map());

  // 묻고답하기
  const [freePosts, setFreePosts] = useState<{ id: string; title: string; content: string; authorName: string; date: string; views: number; isApproved: boolean; authorUid: string }[]>([]);
  const [showFreePostForm, setShowFreePostForm] = useState(false);
  const [freePostTitle, setFreePostTitle] = useState("");
  const [freePostContent, setFreePostContent] = useState("");

  // 수강 후기
  const [reviews, setReviews] = useState<{ id: string; authorName: string; authorCohort: string; content: string; rating: number; programTitle: string; isApproved: boolean; authorUid?: string; createdAt?: string }[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ programTitle: "", rating: 5, content: "" });

  // 통합 검색
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  const sortedNotices = useMemo(() => {
    return [...noticeList].sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      if (noticeSort === "latest") {
        return new Date(b.date.replace(/\./g, "-")).getTime() - new Date(a.date.replace(/\./g, "-")).getTime();
      }
      if (noticeSort === "views") {
        return b.views - a.views;
      }
      if (noticeSort === "title") {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }, [noticeList, noticeSort]);

  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;
    const notices = noticeList.filter((n) => n.title.toLowerCase().includes(q));
    const resources = [...driveResources.filter((r) => r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q))),
      ...resourceList.filter((r) => r.title.toLowerCase().includes(q))];
    const faq = faqList.filter((f) => (f.question || "").toLowerCase().includes(q) || (f.answer || "").toLowerCase().includes(q));
    return { notices, resources, faq, total: notices.length + resources.length + faq.length };
  }, [searchQuery, noticeList, driveResources, resourceList, faqList]);

  const handleSearchResultClick = (tab: TabKey, itemId?: string | number, faqIndex?: number) => {
    setActiveTab(tab);
    setShowSearchResults(false);
    setSearchQuery("");
    if (tab === "notice" && itemId) setExpandedNoticeId(itemId);
    if (tab === "resource" && itemId) setExpandedResourceId(itemId);
    if (tab === "faq" && faqIndex !== undefined) setOpenFaqIndex(faqIndex);
    setTimeout(() => {
      const el = document.getElementById(`community-item-${itemId ?? faqIndex}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  };

  useEffect(() => {
    loadPageContent("community").then(setPc).catch(() => {});
  }, []);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (!postIdFromUrl || !tabParam) return;
    if (tabParam === "notice") {
      setExpandedNoticeId(postIdFromUrl);
    } else if (tabParam === "resource") {
      setExpandedResourceId(postIdFromUrl);
    } else if (tabParam === "free") {
      window.setTimeout(() => {
        document.getElementById(`community-item-${postIdFromUrl}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [postIdFromUrl, tabParam]);

  // 좋아요 / 북마크 로드
  useEffect(() => {
    if (!user) return;
    getCollection<Like & { id: string }>(COLLECTIONS.LIKES).then((all) => {
      const counts = new Map<string, number>();
      const mine = new Map<string, boolean>();
      all.forEach((l) => {
        counts.set(l.targetId, (counts.get(l.targetId) || 0) + 1);
        if (l.userId === user.uid) mine.set(l.targetId, true);
      });
      setLikeCounts(counts);
      setLikes(mine);
    });
    getCollection<Bookmark & { id: string }>(COLLECTIONS.BOOKMARKS).then((all) => {
      const mine = new Map<string, boolean>();
      all.filter((b) => b.userId === user.uid).forEach((b) => mine.set(b.targetId, true));
      setBookmarks(mine);
    });
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [faq, posts, gallery, videos, newNotices, newFree] = await Promise.all([
          getCollection<typeof DEMO_FAQ[0]>(COLLECTIONS.FAQ),
          getCollection<{ id: string; type?: string; boardType?: string; title: string; category?: string; createdAt?: string; date?: string; views?: number; pinned?: boolean; isPinned?: boolean; author?: string; downloads?: number; fileType?: string }>(COLLECTIONS.POSTS),
          getCollection<{ id: number | string; title: string; category: string; imageUrl: string; date?: string }>(COLLECTIONS.GALLERY),
          getCollection<{ id: string; title: string; category: string; youtubeUrl: string; thumbnailUrl?: string; date?: string; publishedAt?: string }>(COLLECTIONS.VIDEOS),
          getContents("community-notice").catch(() => []),
          getContents("community-free").catch(() => []),
        ]);
        if (cancelled) return;

        if (faq.length > 0) {
          const sortedFaq = [...faq].sort(
            (a, b) =>
              ((a as { displayOrder?: number }).displayOrder ?? 999) -
              ((b as { displayOrder?: number }).displayOrder ?? 999),
          );
          setFaqList(sortedFaq);
        }

        const getType = (p: { type?: string; boardType?: string }) => p.type || p.boardType || "";

        const noticesFromPosts: NoticeRow[] =
          posts.length > 0
            ? posts
                .filter((p) => getType(p) === "NOTICE")
                .map((p) => ({
                  id: p.id,
                  title: p.title,
                  date: toDateString(p.createdAt || p.date),
                  views: p.views || 0,
                  pinned: p.pinned || p.isPinned || false,
                  authorUid: (p as { authorUid?: string }).authorUid,
                }))
            : [];

        const mappedNotices: NoticeRow[] = newNotices.map((c) => ({
          id: c.id,
          title: c.title,
          date: toDateString(c.createdAt),
          views: c.views || 0,
          pinned: c.isPinned || false,
          content: c.body,
          authorUid: c.authorUid,
        }));

        const mergedNotices = mergeNoticeRowsByCanonicalId(noticesFromPosts, mappedNotices);
        if (mergedNotices.length > 0) {
          setNoticeList(mergedNotices);
        }

        const mappedFree: FreeRow[] = newFree.map((c) => ({
          id: c.id,
          title: c.title,
          content: c.body || "",
          authorName: c.authorName,
          date: toDateString(c.createdAt),
          views: c.views || 0,
          isApproved: c.isApproved ?? true,
          authorUid: c.authorUid,
        }));

        if (posts.length > 0) {
          const r = posts
            .filter((p) => getType(p) === "RESOURCE")
            .map((p) => ({
              id: p.id,
              title: p.title,
              author: p.author || "",
              date: toDateString(p.createdAt || p.date),
              downloads: p.downloads || 0,
              type: p.fileType || "PDF",
            }));
          if (r.length > 0) setResourceList(r);

          const freeFromPosts: FreeRow[] = posts
            .filter((p) => getType(p) === "FREE")
            .map((p) => ({
              id: p.id,
              title: p.title,
              content: (p as { content?: string }).content || "",
              authorName: (p as { authorName?: string }).authorName || p.author || "",
              date: toDateString(p.createdAt || p.date),
              views: p.views || 0,
              isApproved: (p as { isApproved?: boolean }).isApproved !== false,
              authorUid: (p as { authorUid?: string }).authorUid || "",
            }));

          const mergedFree = mergeFreeRowsByCanonicalId(freeFromPosts, mappedFree);
          if (mergedFree.length > 0) {
            setFreePosts(mergedFree);
          }

          getCollection<Resource & { id: string }>(COLLECTIONS.RESOURCES)
            .then((res) => {
              if (!cancelled && res.length > 0) setDriveResources(res);
            })
            .catch(() => {});

          const knownTypes = ["NOTICE", "RESOURCE", "FREE"];
          const customTypes = [...new Set(posts.map((p) => getType(p)).filter((t) => t && !knownTypes.includes(t)))];
          if (customTypes.length > 0) {
            setCustomBoards(
              customTypes.map((bt) => ({
                boardType: bt,
                posts: posts
                  .filter((p) => getType(p) === bt)
                  .map((p) => ({
                    id: p.id,
                    title: p.title,
                    date: toDateString(p.createdAt || p.date),
                    views: p.views || 0,
                    pinned: p.pinned || p.isPinned || false,
                  })),
              })),
            );
          }
        } else if (mappedFree.length > 0) {
          setFreePosts(mergeFreeRowsByCanonicalId([], mappedFree));
        }

        let unifiedMedia: typeof GALLERY_IMAGES = [];
        if (gallery.length > 0) {
          unifiedMedia = [...unifiedMedia, ...gallery.map((g) => ({ ...g, isVideo: false }))];
        }
        if (videos.length > 0) {
          unifiedMedia = [
            ...unifiedMedia,
            ...videos.map((v) => ({
              id: v.id,
              title: v.title,
              category: v.category,
              imageUrl: v.thumbnailUrl || "",
              youtubeUrl: v.youtubeUrl,
              date: v.date || v.publishedAt || "",
              isVideo: true,
            })),
          ];
        }
        if (unifiedMedia.length > 0) {
          const sortedMedia = unifiedMedia.sort((a, b) => {
            const da = String(a.date || "");
            const db = String(b.date || "");
            return db.localeCompare(da);
          });
          setGalleryList(sortedMedia);
        }

        const reviewData = await getCollection<{
          id: string;
          authorName: string;
          authorCohort: string;
          content: string;
          rating: number;
          programTitle: string;
          isApproved?: boolean;
          authorUid?: string;
        }>(COLLECTIONS.REVIEWS);
        if (!cancelled && reviewData.length > 0) {
          setReviews(reviewData.map((d) => ({ ...d, isApproved: d.isApproved ?? false })));
        }

        // Firestore boards 컬렉션에서 커뮤니티 게시판 동적 로드
        const FIXED_KEYS = new Set(["community-notice", "community-free", "community-qna", "community-review", "community-faq"]);
        try {
          const communityBoardConfigs = await getBoardsByGroup("community");
          const extraBoards = communityBoardConfigs.filter(
            (b) => b.isActive && !FIXED_KEYS.has(b.key),
          );
          if (!cancelled && extraBoards.length > 0) {
            const dynamicResults = await Promise.all(
              extraBoards.map(async (b) => {
                const items = await getContents(b.key).catch(() => []);
                return {
                  key: b.key,
                  label: b.label,
                  contents: items.map((c) => ({
                    id: c.id,
                    title: c.title,
                    body: c.body,
                    date: toDateString(c.createdAt),
                    views: c.views || 0,
                    pinned: c.isPinned || false,
                    authorName: c.authorName,
                  })),
                };
              }),
            );
            if (!cancelled) setDynamicBoards(dynamicResults);
          }
        } catch { /* 동적 보드 로드 실패 무시 */ }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  const toggleLike = async (targetId: string, targetType: "NOTICE" | "RESOURCE" | "FREE") => {
    if (!user) return;
    const docId = `${user.uid}_${targetId}`;
    const ref = doc(db, COLLECTIONS.LIKES, docId);
    const isLiked = likes.get(targetId);
    if (isLiked) {
      await deleteDoc(ref);
      setLikes((prev) => { const m = new Map(prev); m.delete(targetId); return m; });
      setLikeCounts((prev) => { const m = new Map(prev); m.set(targetId, (m.get(targetId) || 1) - 1); return m; });
    } else {
      await setDoc(ref, { targetId, targetType, userId: user.uid, createdAt: new Date().toISOString() });
      setLikes((prev) => new Map(prev).set(targetId, true));
      setLikeCounts((prev) => { const m = new Map(prev); m.set(targetId, (m.get(targetId) || 0) + 1); return m; });
    }
  };

  const toggleBookmark = async (targetId: string, targetType: "NOTICE" | "RESOURCE" | "FREE") => {
    if (!user) return;
    const docId = `${user.uid}_${targetId}`;
    const ref = doc(db, COLLECTIONS.BOOKMARKS, docId);
    if (bookmarks.get(targetId)) {
      await deleteDoc(ref);
      setBookmarks((prev) => { const m = new Map(prev); m.delete(targetId); return m; });
    } else {
      await setDoc(ref, { targetId, targetType, userId: user.uid, createdAt: new Date().toISOString() });
      setBookmarks((prev) => new Map(prev).set(targetId, true));
    }
  };

  const handleFreePostSubmit = async () => {
    if (!freePostTitle.trim() || !freePostContent.trim() || !user) return;
    await createDoc(COLLECTIONS.POSTS, {
      title: freePostTitle.trim(), content: freePostContent.trim(), boardType: "FREE",
      isPinned: false, views: 0, isApproved: false,
      authorUid: user.uid, authorName: profile?.name || user.displayName || "익명",
      author: profile?.name || user.displayName || "익명",
      date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    });
    setFreePostTitle(""); setFreePostContent(""); setShowFreePostForm(false);
    toast("게시물이 등록되었습니다. 관리자 승인 후 공개됩니다.", "success");
  };

  const handleReviewSubmit = async () => {
    if (!reviewForm.content.trim() || !reviewForm.programTitle.trim() || !user) return;
    await createDoc(COLLECTIONS.REVIEWS, {
      authorName: profile?.name || user.displayName || "익명",
      authorCohort: profile?.cohort || "",
      content: reviewForm.content.trim(),
      rating: reviewForm.rating,
      programTitle: reviewForm.programTitle.trim(),
      isApproved: false,
      isFeatured: false,
      authorUid: user.uid,
    });
    setReviewForm({ programTitle: "", rating: 5, content: "" });
    setShowReviewForm(false);
    toast("후기가 등록되었습니다. 관리자 승인 후 공개됩니다.", "success");
  };

  return (
    <div className="py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold text-brand-dark uppercase tracking-tight mb-3">{pc.hero.title}</h1>
            <p className="text-lg text-gray-500">{pc.hero.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              requireLogin(() => {
                setActiveTab("free");
                setShowFreePostForm(true);
              }, "글을 작성하려면 로그인이 필요합니다.")
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold",
              "bg-brand-blue text-white hover:bg-brand-lightBlue transition-colors shrink-0",
            )}
          >
            <Plus size={16} />
            작성하기
          </button>
        </div>

        {/* 통합 검색 */}
        <div className="max-w-md mx-auto mb-8 relative">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
              onFocus={() => { if (searchQuery.trim()) setShowSearchResults(true); }}
              placeholder="공지, 자료, FAQ 통합 검색..."
              className="w-full pl-9 pr-9 py-2.5 border border-brand-border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setShowSearchResults(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          {showSearchResults && searchResults && searchResults.total > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-sm border border-brand-border shadow-lg z-20 max-h-80 overflow-y-auto">
              {searchResults.notices.length > 0 && (
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-400 mb-2">공지사항 ({searchResults.notices.length}건)</p>
                  {searchResults.notices.slice(0, 3).map((n) => (
                    <button key={n.id} onClick={() => handleSearchResultClick("notice", n.id)}
                      className="w-full text-left px-3 py-2 rounded-sm text-sm text-gray-700 hover:bg-gray-50 truncate">{n.title}</button>
                  ))}
                </div>
              )}
              {searchResults.resources.length > 0 && (
                <div className="p-3 border-t border-brand-border">
                  <p className="text-xs font-semibold text-gray-400 mb-2">교육자료 ({searchResults.resources.length}건)</p>
                  {searchResults.resources.slice(0, 3).map((r) => (
                    <button key={r.id} onClick={() => handleSearchResultClick("resource", r.id)}
                      className="w-full text-left px-3 py-2 rounded-sm text-sm text-gray-700 hover:bg-gray-50 truncate">
                      {(r as { title: string }).title}
                    </button>
                  ))}
                </div>
              )}
              {searchResults.faq.length > 0 && (
                <div className="p-3 border-t border-brand-border">
                  <p className="text-xs font-semibold text-gray-400 mb-2">FAQ ({searchResults.faq.length}건)</p>
                  {searchResults.faq.slice(0, 3).map((f, i) => (
                    <button key={i} onClick={() => handleSearchResultClick("faq", undefined, faqList.indexOf(f))}
                      className="w-full text-left px-3 py-2 rounded-sm text-sm text-gray-700 hover:bg-gray-50 truncate">{f.question}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {showSearchResults && searchResults && searchResults.total === 0 && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-sm border border-brand-border shadow-lg z-20 p-6 text-center text-sm text-gray-400">
              검색 결과가 없습니다.
            </div>
          )}
        </div>

        {/* 탭 네비게이션 */}
        <div className="relative mb-10 border-b border-brand-border" role="tablist">
          <div className="flex overflow-x-auto scrollbar-hide -mb-px">
            <button
              role="tab"
              aria-selected={activeTab === ALL_TAB_KEY}
              onClick={() => setActiveTab(ALL_TAB_KEY)}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap px-5 py-3 text-sm font-medium transition-all",
                activeTab === ALL_TAB_KEY
                  ? "border-b-2 border-brand-blue text-brand-blue font-semibold bg-transparent"
                  : "border-b-2 border-transparent text-gray-500 hover:text-gray-700 bg-transparent"
              )}
            >
              <LayoutGrid size={16} />
              전체보기
            </button>
            {[...FIXED_TABS, ...dynamicBoards.map((db) => ({
              key: db.key,
              label: db.label,
              icon: FileText,
              color: "text-gray-600 bg-gray-50",
            })), ...customBoards.map((cb) => ({
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
                    ? "border-b-2 border-brand-blue text-brand-blue font-semibold bg-transparent"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-700 bg-transparent"
                )}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 전체보기 */}
        {activeTab === ALL_TAB_KEY && (
          <div className="space-y-8">
            {/* 인기글 */}
            {(() => {
              if (!showPopularPosts) return null;
              const popular = freePosts
                .filter((p) => p.isApproved)
                .filter((p) => p.views > 0 || (likeCounts.get(p.id) ?? 0) > 0)
                .sort((a, b) => {
                  const sa = (a.views ?? 0) + (likeCounts.get(a.id) ?? 0) * 3;
                  const sb = (b.views ?? 0) + (likeCounts.get(b.id) ?? 0) * 3;
                  return sb - sa;
                })
                .slice(0, 5);
              if (popular.length === 0) return null;
              return (
                <section className="card-base overflow-hidden">
                  <div className="p-5 border-b border-brand-border">
                    <h3 className="text-lg font-bold text-brand-dark flex items-center gap-2">🔥 인기글</h3>
                  </div>
                  <div className="divide-y divide-brand-border/50">
                    {popular.map((p, i) => (
                      <button
                        key={p.id || i}
                        type="button"
                        onClick={() => { setActiveTab("free"); setTimeout(() => document.getElementById(`community-item-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100); }}
                        className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-xs font-bold text-brand-blue w-5">{i + 1}</span>
                        <span className="text-sm text-gray-800 truncate flex-1">{p.title}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          ♥ {likeCounts.get(p.id) ?? 0} · 👁 {p.views}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })()}

            {/* 공지사항 미리보기 */}
            <section className="card-base overflow-hidden">
              <div className="p-5 border-b border-brand-border flex items-center justify-between">
                <h3 className="text-lg font-bold text-brand-dark flex items-center gap-2"><Bell size={18} className="text-blue-500" />공지사항</h3>
                <button type="button" onClick={() => setActiveTab("notice")} className="text-sm text-brand-blue hover:underline">더보기</button>
              </div>
              <div className="divide-y divide-brand-border/50">
                {sortedNotices.slice(0, 3).map((n) => (
                  <div key={n.id} className="px-5 py-3 flex items-center gap-3">
                    {n.pinned && <Pin size={14} className="text-blue-500 shrink-0" />}
                    <span className="text-sm text-gray-800 truncate flex-1">{n.title}</span>
                    <span className="text-xs text-gray-400 shrink-0">{n.date}</span>
                  </div>
                ))}
                {noticeList.length === 0 && <p className="p-5 text-sm text-gray-400 text-center">등록된 공지가 없습니다.</p>}
              </div>
            </section>

            {/* 묻고 답하기 미리보기 */}
            <section className="card-base overflow-hidden">
              <div className="p-5 border-b border-brand-border flex items-center justify-between">
                <h3 className="text-lg font-bold text-brand-dark flex items-center gap-2"><MessageCircle size={18} className="text-indigo-500" />묻고 답하기</h3>
                <button type="button" onClick={() => setActiveTab("free")} className="text-sm text-brand-blue hover:underline">더보기</button>
              </div>
              <div className="divide-y divide-brand-border/50">
                {freePosts.slice(0, 3).map((p) => (
                  <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-sm text-gray-800 truncate flex-1">{p.title}</span>
                    <span className="text-xs text-gray-500 shrink-0">{p.authorName}</span>
                    <span className="text-xs text-gray-400 shrink-0">{p.date}</span>
                  </div>
                ))}
                {freePosts.length === 0 && <p className="p-5 text-sm text-gray-400 text-center">등록된 글이 없습니다.</p>}
              </div>
            </section>

            {/* 수강후기 미리보기 */}
            <section className="card-base overflow-hidden">
              <div className="p-5 border-b border-brand-border flex items-center justify-between">
                <h3 className="text-lg font-bold text-brand-dark flex items-center gap-2"><Star size={18} className="text-orange-500" />수강후기</h3>
                <button type="button" onClick={() => setActiveTab("review")} className="text-sm text-brand-blue hover:underline">더보기</button>
              </div>
              <div className="divide-y divide-brand-border/50">
                {reviews.slice(0, 3).map((r) => (
                  <div key={r.id} className="px-5 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800">{r.authorName}</span>
                      <span className="text-xs text-gray-400">{toDateString(r.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-1">{r.content}</p>
                  </div>
                ))}
                {reviews.length === 0 && <p className="p-5 text-sm text-gray-400 text-center">등록된 후기가 없습니다.</p>}
              </div>
            </section>

            {/* 교육자료 미리보기 */}
            <section className="card-base overflow-hidden">
              <div className="p-5 border-b border-brand-border flex items-center justify-between">
                <h3 className="text-lg font-bold text-brand-dark flex items-center gap-2"><FolderOpen size={18} className="text-green-500" />교육자료</h3>
                <button type="button" onClick={() => setActiveTab("resource")} className="text-sm text-brand-blue hover:underline">더보기</button>
              </div>
              <div className="divide-y divide-brand-border/50">
                {resourceList.slice(0, 3).map((r) => (
                  <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-sm text-gray-800 truncate flex-1">{r.title}</span>
                    <span className="text-xs text-gray-500 shrink-0">{r.author}</span>
                    <span className="text-xs text-gray-400 shrink-0">{r.date}</span>
                  </div>
                ))}
                {resourceList.length === 0 && <p className="p-5 text-sm text-gray-400 text-center">등록된 자료가 없습니다.</p>}
              </div>
            </section>

            {/* FAQ 미리보기 */}
            <section className="card-base overflow-hidden">
              <div className="p-5 border-b border-brand-border flex items-center justify-between">
                <h3 className="text-lg font-bold text-brand-dark flex items-center gap-2"><HelpCircle size={18} className="text-yellow-500" />FAQ</h3>
                <button type="button" onClick={() => setActiveTab("faq")} className="text-sm text-brand-blue hover:underline">더보기</button>
              </div>
              <div className="divide-y divide-brand-border/50">
                {faqList.slice(0, 3).map((f, i) => (
                  <div key={i} className="px-5 py-3">
                    <span className="text-sm text-gray-800">{f.question}</span>
                  </div>
                ))}
                {faqList.length === 0 && <p className="p-5 text-sm text-gray-400 text-center">등록된 FAQ가 없습니다.</p>}
              </div>
            </section>
          </div>
        )}

        {/* 공지사항 */}
        {activeTab === "notice" && (
          <div className="card-base overflow-hidden">
            <div className="p-6 border-b border-brand-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-brand-dark uppercase tracking-tight">공지사항</h2>
              <select 
                value={noticeSort} 
                onChange={(e) => setNoticeSort(e.target.value as "latest" | "views" | "title")}
                className="px-3 py-1.5 text-sm border border-brand-border rounded-sm focus:outline-none focus:border-brand-blue"
              >
                <option value="latest">최신순</option>
                <option value="views">조회순</option>
                <option value="title">제목순</option>
              </select>
            </div>
            <div className="divide-y divide-brand-border/50">
              {sortedNotices.map((notice) => (
                <div key={notice.id} id={`community-item-${notice.id}`}>
                  <button
                    onClick={() => setExpandedNoticeId(expandedNoticeId === notice.id ? null : notice.id)}
                    className="w-full flex items-center px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    {notice.pinned && <Pin size={14} className="text-brand-blue mr-2 shrink-0" />}
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
                    <div className="px-6 pb-6 bg-gray-50 border-t border-brand-border space-y-4">
                      <div
                        className="pt-4 text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(
                            (notice as { content?: string }).content || "상세 내용은 추후 업데이트 예정입니다."
                          ),
                        }}
                      />
                      {user && (
                        <div className="flex items-center gap-3 py-2">
                          <button onClick={() => toggleLike(String(notice.id), "NOTICE")} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500">
                            <Heart size={14} className={likes.get(String(notice.id)) ? "fill-red-500 text-red-500" : ""} />
                            {likeCounts.get(String(notice.id)) || 0}
                          </button>
                          <button onClick={() => toggleBookmark(String(notice.id), "NOTICE")} className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-blue">
                            <BookmarkPlus size={14} className={bookmarks.get(String(notice.id)) ? "fill-brand-blue text-brand-blue" : ""} />
                            {bookmarks.get(String(notice.id)) ? "저장됨" : "북마크"}
                          </button>
                        </div>
                      )}
                      <PostCommentSection
                        postId={String(notice.id)}
                        postType="NOTICE"
                        postAuthorUid={notice.authorUid}
                        postTitle={notice.title}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 교육자료 */}
        {activeTab === "resource" && (
          <div className="bg-white rounded-sm border border-brand-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-brand-border">
              <h2 className="text-xl font-bold text-brand-dark uppercase tracking-tight">교육자료</h2>
              <p className="text-sm text-gray-500 mt-1">교육 자료와 참고 문서를 다운로드하세요.</p>
            </div>

            {/* 프로필 미완성 안내 */}
            {user && !isProfileComplete && (
              <div className="mx-6 mt-4 rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">프로필 완성이 필요합니다</p>
                <p className="text-xs mt-1 text-amber-700">자료를 다운로드하려면 <a href="/profile" className="underline font-medium">프로필 설정</a>에서 이름, 기수, 연락처를 입력해 주세요.</p>
              </div>
            )}

            {/* Drive 자료 (Google Drive 연동) */}
            {driveResources.length > 0 && (
              <div className="divide-y divide-gray-50">
                {driveResources.map((res) => (
                  <div key={res.id} id={`community-item-${res.id}`}>
                    <button
                      onClick={() => setExpandedResourceId(expandedResourceId === res.id ? null : res.id)}
                      className="w-full flex items-center px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{res.title}</p>
                        <p className="text-xs text-gray-400 mt-1">{res.uploaderName} · {res.fileSize}</p>
                        {res.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">{res.tags.slice(0, 3).map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-gray text-gray-500">{t}</span>)}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-4">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-brand-gray text-gray-600">{res.fileType.toUpperCase()}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1"><Download size={12} />{res.downloads}</span>
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); requireLogin(() => {
                            if (!isProfileComplete) { toast("프로필을 먼저 완성해 주세요.", "info"); return; }
                            window.open(res.driveDownloadUrl, "_blank");
                          }, "자료 다운로드는 로그인이 필요합니다."); }}
                          className="p-2 rounded-sm hover:bg-brand-gray text-brand-blue transition-colors"
                        >
                          <Download size={16} />
                        </span>
                        {expandedResourceId === res.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </button>
                    {expandedResourceId === res.id && (
                      <div className="px-6 pb-6 bg-gray-50 border-t border-brand-border space-y-3">
                        {res.description && <p className="text-sm text-gray-700">{res.description}</p>}
                        {res.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">{res.tags.map((t) => <span key={t} className="badge-base bg-brand-gray text-gray-600">{t}</span>)}</div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{res.fileType.toUpperCase()} · {res.fileSize}</span>
                          <span>다운로드 {res.downloads}회</span>
                          {res.driveViewUrl && <a href={res.driveViewUrl} target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">미리보기</a>}
                        </div>
                        {user && (
                          <div className="flex items-center gap-3 py-2">
                            <button onClick={() => toggleLike(String(res.id), "RESOURCE")} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500">
                              <Heart size={14} className={likes.get(String(res.id)) ? "fill-red-500 text-red-500" : ""} />
                              {likeCounts.get(String(res.id)) || 0}
                            </button>
                            <button onClick={() => toggleBookmark(String(res.id), "RESOURCE")} className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-blue">
                              <BookmarkPlus size={14} className={bookmarks.get(String(res.id)) ? "fill-brand-blue text-brand-blue" : ""} />
                              {bookmarks.get(String(res.id)) ? "저장됨" : "북마크"}
                            </button>
                          </div>
                        )}
                        <PostCommentSection
                          postId={String(res.id)}
                          postType="RESOURCE"
                          postAuthorUid={res.uploaderId}
                          postTitle={res.title}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 기존 게시판 자료 (Firestore posts) */}
            <div className="divide-y divide-gray-50">
              {resourceList.map((res) => (
                <div key={res.id} id={`community-item-${res.id}`} className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{res.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{res.author} · {res.date}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-brand-gray text-gray-600">{res.type}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Download size={12} />{res.downloads}</span>
                    <button onClick={() => handleDownload(res.title, (res as { url?: string }).url)} className="p-2 rounded-sm hover:bg-brand-gray text-brand-blue transition-colors">
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
            <div className="bg-white rounded-sm border border-brand-border shadow-sm p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-sm bg-purple-50 flex items-center justify-center mx-auto mb-4">
                  <Award size={32} className="text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-brand-dark uppercase tracking-tight">수료증 발급</h2>
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
                    className="w-full px-4 py-3 rounded-sm border border-brand-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">이름 (선택)</label>
                  <input
                    type="text"
                    value={certName}
                    onChange={(e) => { setCertName(e.target.value); setCertSearched(false); setCertResult(null); }}
                    placeholder="이메일로 찾을 수 없을 때 이름으로 검색합니다"
                    className="w-full px-4 py-3 rounded-sm border border-brand-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />
                </div>
                <button
                  onClick={() => handleCertSearch()}
                  disabled={(!certEmail.trim() && !certName.trim()) || certLoading}
                  className="w-full py-3 rounded-sm bg-brand-blue text-white text-sm font-semibold hover:bg-brand-lightBlue transition-colors disabled:opacity-50"
                >
                  {certLoading ? "조회 중..." : "수료증 조회"}
                </button>
                {certSearched && !certResult && (
                  <div className="bg-yellow-50 text-yellow-700 text-sm p-4 rounded-sm">
                    <p className="font-medium mb-1">수료 정보를 찾을 수 없습니다.</p>
                    <ul className="text-yellow-600 text-xs space-y-1 mt-2 list-disc list-inside">
                      <li>수강 신청 시 등록한 이메일과 동일한지 확인해 주세요.</li>
                      <li>이메일로 찾을 수 없는 경우 이름으로도 검색해 보세요.</li>
                      <li>수료 또는 졸업 상태인 수강생만 조회 가능합니다.</li>
                      <li>관리자가 아직 수료 정보를 등록하지 않았을 수 있습니다.</li>
                      <li>문의사항은 <Link href="/community?tab=inquiry" className="underline font-medium">협력 문의</Link>를 이용해 주세요.</li>
                    </ul>
                  </div>
                )}
                {certResult && (
                  <div className="bg-green-50 text-green-700 text-sm p-4 rounded-sm">
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
              <h2 className="text-xl font-bold text-brand-dark uppercase tracking-tight">자주 묻는 질문</h2>
            </div>
            {faqList.map((faq, index) => (
              <div
                key={index}
                id={`community-item-${index}`}
                className="bg-white rounded-sm border border-brand-border shadow-sm overflow-hidden"
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
                  <div className="px-5 pb-5 border-t border-brand-border">
                    <div className="text-sm text-gray-600 leading-relaxed pt-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(faq.answer || "") }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 협력 문의 */}
        {activeTab === "inquiry" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-sm border border-brand-border shadow-sm p-8">
              <h2 className="text-xl font-bold text-brand-dark uppercase tracking-tight mb-2">협력 문의</h2>
              <p className="text-sm text-gray-500 mb-6">교육 협력 및 제휴를 문의해 주세요. 담당자가 빠르게 연락드리겠습니다.</p>

              {inquirySubmitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-brand-dark mb-2">문의가 접수되었습니다</h3>
                  <p className="text-sm text-gray-500">담당자 확인 후 입력하신 이메일로 답변드리겠습니다.</p>
                  <button
                    onClick={() => { setInquirySubmitted(false); setInquiryForm({ name: "", email: "", phone: "", company: "", subject: "", message: "" }); }}
                    className="mt-6 px-6 py-2.5 rounded-sm border border-brand-border text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    새 문의 작성
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">이름 *</label>
                      <input type="text" required value={inquiryForm.name} onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-sm border border-brand-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">이메일 *</label>
                      <input type="email" required value={inquiryForm.email} onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-sm border border-brand-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">연락처</label>
                      <input type="tel" value={inquiryForm.phone} onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                        placeholder="010-0000-0000"
                        className="w-full px-4 py-2.5 rounded-sm border border-brand-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">소속/회사</label>
                      <input type="text" value={inquiryForm.company} onChange={(e) => setInquiryForm({ ...inquiryForm, company: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-sm border border-brand-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">제목 *</label>
                    <input type="text" required value={inquiryForm.subject} onChange={(e) => setInquiryForm({ ...inquiryForm, subject: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-sm border border-brand-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">문의 내용 *</label>
                    <textarea rows={5} required value={inquiryForm.message} onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                      placeholder="문의 내용을 입력해 주세요..."
                      className="w-full px-4 py-2.5 rounded-sm border border-brand-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none" />
                  </div>
                  {inquiryError && (
                    <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-sm">{inquiryError}</p>
                  )}
                  <button type="submit"
                    className="w-full py-3 rounded-sm bg-brand-blue text-white text-sm font-semibold hover:bg-brand-lightBlue transition-colors">
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
              <h2 className="text-xl font-bold text-brand-dark uppercase tracking-tight">갤러리 & 영상</h2>
              <p className="text-sm text-gray-500 mt-1">교육 현장 사진과 다양한 영상을 둘러보세요.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {galleryList.map((media) => (
                <div
                  key={media.id}
                  className="group relative rounded-sm overflow-hidden aspect-[4/3] cursor-pointer bg-brand-gray"
                  onClick={() => {
                    if (media.isVideo && media.youtubeUrl) {
                      window.open(media.youtubeUrl, "_blank");
                    } else {
                      setLightboxImage({ imageUrl: media.imageUrl, title: media.title });
                    }
                  }}
                >
                  <DriveOrExternalImage
                    src={media.imageUrl}
                    alt={media.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    quiet
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {media.isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center group-hover:bg-brand-blue transition-colors">
                        <Play className="w-5 h-5 text-white ml-1" />
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 w-full p-4 text-white opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs px-2 py-0.5 rounded bg-white/20 backdrop-blur">{media.category}</span>
                    <p className="text-sm font-medium mt-1 line-clamp-1">{media.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 묻고답하기 */}
        {activeTab === "free" && !isLegacyCommunity && (
          <CommunityFreeTimeline />
        )}
        {activeTab === "free" && isLegacyCommunity && (
          <div className="card-base overflow-hidden">
            <div className="p-6 border-b border-brand-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-brand-dark uppercase tracking-tight">묻고 답하기</h2>
                <p className="text-sm text-gray-500 mt-1">궁금한 점을 질문하고 서로 답변을 나눠보세요.</p>
              </div>
              {user && (
                <button onClick={() => setShowFreePostForm(!showFreePostForm)} className="btn-primary btn-sm">
                  <Plus size={14} />글쓰기
                </button>
              )}
            </div>
            {showFreePostForm && user && (
              <div className="p-6 bg-gray-50 border-b border-brand-border space-y-3">
                <input type="text" value={freePostTitle} onChange={(e) => setFreePostTitle(e.target.value)}
                  placeholder="제목" className="w-full px-3 py-2 rounded-sm border border-brand-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                <textarea value={freePostContent} onChange={(e) => setFreePostContent(e.target.value)}
                  placeholder="내용을 입력하세요..." rows={4}
                  className="w-full px-3 py-2 rounded-sm border border-brand-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowFreePostForm(false)} className="btn-secondary btn-sm">취소</button>
                  <button onClick={handleFreePostSubmit} disabled={!freePostTitle.trim() || !freePostContent.trim()} className="btn-primary btn-sm disabled:opacity-40">등록</button>
                </div>
              </div>
            )}
            <div className="divide-y divide-gray-50">
              {freePosts.filter((p) => p.isApproved || p.authorUid === user?.uid).length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400 text-sm">게시물이 없습니다.{user ? " 첫 글을 작성해 보세요!" : ""}</div>
              ) : freePosts.filter((p) => p.isApproved || p.authorUid === user?.uid).map((post) => (
                <div key={post.id} id={`community-item-${post.id}`} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{post.title}</span>
                    {!post.isApproved && <span className="badge-base bg-yellow-100 text-yellow-700">승인 대기</span>}
                  </div>
                  <p className="text-xs text-gray-400">{post.authorName} · {post.date} · 조회 {post.views}</p>
                  {post.content && (
                    <div className="text-sm text-gray-600 mt-2 line-clamp-2 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }} />
                  )}
                  {user && (
                    <div className="flex items-center gap-3 py-2">
                      <button onClick={() => toggleLike(post.id, "FREE")} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500">
                        <Heart size={14} className={likes.get(post.id) ? "fill-red-500 text-red-500" : ""} />
                        {likeCounts.get(post.id) || 0}
                      </button>
                      <button onClick={() => toggleBookmark(post.id, "FREE")} className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-blue">
                        <BookmarkPlus size={14} className={bookmarks.get(post.id) ? "fill-brand-blue text-brand-blue" : ""} />
                        {bookmarks.get(post.id) ? "저장됨" : "북마크"}
                      </button>
                    </div>
                  )}
                  <PostCommentSection
                    postId={post.id}
                    postType="FREE"
                    postAuthorUid={post.authorUid}
                    postTitle={post.title}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 수강 후기 */}
        {activeTab === "review" && (() => {
          const visibleReviews = reviews.filter((r) => r.isApproved !== false || r.authorUid === user?.uid);
          return (
          <div className="card-base overflow-hidden">
            <div className="p-6 border-b border-brand-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-brand-dark uppercase tracking-tight">수강 후기</h2>
                <p className="text-sm text-gray-500 mt-1">수강 경험을 나눠주세요.</p>
              </div>
              {user && <button onClick={() => setShowReviewForm(!showReviewForm)} className="btn-primary btn-sm"><Plus size={14} />후기 작성</button>}
            </div>

            {/* 평점 평균 + 분포 요약 (공통 컴포넌트) */}
            {visibleReviews.length > 0 && (
              <div className="border-b border-brand-border px-6 py-5">
                <RatingSummary items={visibleReviews} />
              </div>
            )}
            {showReviewForm && user && (
              <div className="p-6 bg-gray-50 border-b border-brand-border space-y-3">
                <input type="text" value={reviewForm.programTitle} onChange={(e) => setReviewForm({...reviewForm, programTitle: e.target.value})}
                  placeholder="프로그램명" className="w-full px-3 py-2 rounded-sm border border-brand-border text-sm focus:outline-none" />
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-600 mr-2">평점:</span>
                  {[1,2,3,4,5].map((s) => (
                    <button key={s} onClick={() => setReviewForm({...reviewForm, rating: s})}
                      className={cn("text-lg", s <= reviewForm.rating ? "text-amber-400" : "text-gray-300")}>★</button>
                  ))}
                </div>
                <textarea value={reviewForm.content} onChange={(e) => setReviewForm({...reviewForm, content: e.target.value})}
                  placeholder="수강 경험을 공유해 주세요..." rows={4}
                  className="w-full px-3 py-2 rounded-sm border border-brand-border text-sm focus:outline-none resize-none" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowReviewForm(false)} className="btn-secondary btn-sm">취소</button>
                  <button onClick={handleReviewSubmit} disabled={!reviewForm.content.trim() || !reviewForm.programTitle.trim()} className="btn-primary btn-sm disabled:opacity-40">등록</button>
                </div>
              </div>
            )}
            <div className="divide-y divide-gray-50">
              {reviews.filter((r) => r.isApproved !== false || r.authorUid === user?.uid).length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400 text-sm">등록된 후기가 없습니다.</div>
              ) : reviews.filter((r) => r.isApproved !== false || r.authorUid === user?.uid).map((r) => (
                <div key={r.id} className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex gap-0.5">{[1,2,3,4,5].map((s) => <span key={s} className={cn("text-sm", s <= r.rating ? "text-amber-400" : "text-gray-200")}>★</span>)}</div>
                    <span className="text-xs text-gray-400">{r.programTitle}</span>
                    {r.isApproved === false && <span className="badge-base bg-yellow-100 text-yellow-700">승인 대기</span>}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{r.content}</p>
                  <p className="text-xs text-gray-400 mt-2">{r.authorName} · {r.authorCohort}</p>
                </div>
              ))}
            </div>
          </div>
          );
        })()}

        {/* 동적 게시판 (Firestore boards 컬렉션) */}
        {dynamicBoards.map((db) => (
          activeTab === db.key && (
            <div key={db.key} className="card-base overflow-hidden">
              <div className="p-6 border-b border-brand-border">
                <h2 className="text-xl font-bold text-brand-dark uppercase tracking-tight">{db.label}</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {db.contents.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-400 text-sm">게시물이 없습니다.</div>
                ) : db.contents.map((post) => (
                  <div key={post.id}>
                    <button
                      onClick={() => setExpandedCustomPostId(expandedCustomPostId === post.id ? null : post.id)}
                      className="w-full flex items-center px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      {post.pinned && <Pin size={14} className="text-brand-blue mr-2 shrink-0" />}
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
                      <div className="px-6 pb-4 text-sm text-gray-600 bg-gray-50 border-t border-brand-border">
                        <div
                          className="pt-3 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(post.body || "상세 내용은 추후 업데이트 예정입니다."),
                          }}
                        />
                        <p className="text-xs text-gray-400 mt-3">{post.authorName}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ))}

        {/* 커스텀 게시판 */}
        {customBoards.map((cb) => (
          activeTab === cb.boardType.toLowerCase() && (
            <div key={cb.boardType} className="bg-white rounded-sm border border-brand-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-brand-border">
                <h2 className="text-xl font-bold text-brand-dark uppercase tracking-tight">{cb.boardType}</h2>
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
                      {post.pinned && <Pin size={14} className="text-brand-blue mr-2 shrink-0" />}
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
                      <div className="px-6 pb-4 text-sm text-gray-600 bg-gray-50 border-t border-brand-border">
                        <div
                          className="pt-3 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(post.content || "상세 내용은 추후 업데이트 예정입니다."),
                          }}
                        />
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
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors p-2"
            aria-label="닫기"
          >
            <X size={32} />
          </button>
          <div className="max-w-5xl w-full max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <DriveOrExternalImage
              src={lightboxImage.imageUrl}
              alt={lightboxImage.title}
              className="w-full max-h-[85vh] object-contain rounded-sm"
            />
            <p className="text-white text-center mt-3 text-sm font-medium">{lightboxImage.title}</p>
          </div>
        </div>
      )}
      {/* 자유 탭 X 스타일 ↔ 이전 모드 토글 (자유 탭 활성 시에만 노출) */}
      {uiHydrated && activeTab === "free" && (
        <div className="mt-8 mb-4 flex justify-center">
          <button
            type="button"
            onClick={() => setUiMode(isLegacyCommunity ? "new" : "legacy")}
            className="text-xs text-gray-400 underline hover:text-gray-600"
          >
            {isLegacyCommunity ? "새 디자인 보기" : "이전 디자인 보기"}
          </button>
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
