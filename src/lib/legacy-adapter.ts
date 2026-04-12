/**
 * 레거시 컬렉션 데이터를 통합 Content 형식으로 변환하는 어댑터
 * Phase 3: 기존 videos/gallery/resources/posts/reviews/faq → Content 호환
 */
import { getCollection, getOrderedCollection, COLLECTIONS } from "./firestore";
import type { Content } from "@/types/content";
import { detectMediaType } from "./content-engine";

interface LegacyVideo {
  id: string;
  title: string;
  description?: string;
  youtubeUrl: string;
  thumbnailUrl?: string;
  category: string;
  isFeatured?: boolean;
  publishedAt?: string;
  date?: string;
}

interface LegacyGallery {
  id: string;
  title: string;
  imageUrl: string;
  category?: string;
  description?: string;
  date?: string;
}

interface LegacyResource {
  id: string;
  title: string;
  description?: string;
  fileType: string;
  fileName?: string;
  fileSize?: string;
  driveFileId?: string;
  driveDownloadUrl?: string;
  driveViewUrl?: string;
  uploaderName?: string;
  tags?: string[];
  downloads?: number;
}

interface LegacyPost {
  id: string;
  title: string;
  content?: string;
  type?: string;
  boardType?: string;
  isPinned?: boolean;
  pinned?: boolean;
  author?: string;
  authorName?: string;
  authorUid?: string;
  views?: number;
  isApproved?: boolean;
  createdAt?: string;
  date?: string;
}

interface LegacyReview {
  id: string;
  authorName: string;
  authorCohort?: string;
  content: string;
  rating: number;
  programTitle: string;
  isApproved?: boolean;
  authorUid?: string;
  createdAt?: string;
}

interface LegacyFaq {
  id: string;
  question: string;
  answer: string;
  category?: string;
  displayOrder?: number;
}

const VIDEO_CATEGORY_MAP: Record<string, string> = {
  LECTURE: "media-lecture",
  WORKATHON: "media-workathon",
  INTERVIEW: "media-interview",
  PROMO: "media-promo",
};

function toContent(partial: Partial<Content> & { id: string; boardKey: string; title: string }): Content {
  return {
    views: 0,
    likeCount: 0,
    commentCount: 0,
    createdAt: "",
    authorUid: "",
    authorName: "",
    ...partial,
  };
}

export async function loadLegacyVideosAsContent(): Promise<Content[]> {
  try {
    const videos = await getCollection<LegacyVideo>(COLLECTIONS.VIDEOS);
    return videos
      .filter((v) => v.youtubeUrl?.trim())
      .map((v) => {
        const detected = detectMediaType(v.youtubeUrl);
        return toContent({
          id: `legacy-video-${v.id}`,
          boardKey: VIDEO_CATEGORY_MAP[v.category] || "media-lecture",
          title: v.title,
          body: v.description,
          mediaType: "youtube",
          mediaUrl: v.youtubeUrl,
          thumbnailUrl: v.thumbnailUrl || detected.thumbnailUrl || "",
          authorUid: "",
          authorName: "AISH",
          createdAt: v.publishedAt || v.date || "",
        });
      });
  } catch {
    return [];
  }
}

export async function loadLegacyGalleryAsContent(): Promise<Content[]> {
  try {
    const items = await getCollection<LegacyGallery>(COLLECTIONS.GALLERY);
    return items.map((g) => {
      const detected = detectMediaType(g.imageUrl || "");
      return toContent({
        id: `legacy-gallery-${g.id}`,
        boardKey: "media-gallery",
        title: g.title,
        body: g.description,
        mediaType: detected.mediaType === "none" ? "image" : detected.mediaType,
        mediaUrl: g.imageUrl,
        thumbnailUrl: g.imageUrl,
        authorUid: "",
        authorName: "AISH",
        createdAt: g.date || "",
      });
    });
  } catch {
    return [];
  }
}

export async function loadLegacyResourcesAsContent(): Promise<Content[]> {
  try {
    const items = await getCollection<LegacyResource>(COLLECTIONS.RESOURCES);
    return items.map((r) => {
      const url = r.driveViewUrl || r.driveDownloadUrl || "";
      return toContent({
        id: `legacy-resource-${r.id}`,
        boardKey: "media-resource",
        title: r.title,
        body: r.description,
        mediaType: "pdf",
        mediaUrl: url,
        thumbnailUrl: "",
        authorUid: "",
        authorName: r.uploaderName || "AISH",
        tags: r.tags,
        views: r.downloads || 0,
        createdAt: "",
      });
    });
  } catch {
    return [];
  }
}

export async function loadLegacyPostsAsContent(postType: string, boardKey: string): Promise<Content[]> {
  try {
    const posts = await getCollection<LegacyPost>(COLLECTIONS.POSTS);
    return posts
      .filter((p) => (p.type || p.boardType) === postType)
      .map((p) =>
        toContent({
          id: `legacy-post-${p.id}`,
          boardKey,
          title: p.title,
          body: p.content,
          isPinned: p.isPinned || p.pinned || false,
          isApproved: p.isApproved ?? true,
          authorUid: p.authorUid || "",
          authorName: p.authorName || p.author || "AISH",
          views: p.views || 0,
          createdAt: p.createdAt || p.date || "",
        }),
      );
  } catch {
    return [];
  }
}

export async function loadLegacyReviewsAsContent(): Promise<Content[]> {
  try {
    const items = await getCollection<LegacyReview>(COLLECTIONS.REVIEWS);
    return items.map((r) =>
      toContent({
        id: `legacy-review-${r.id}`,
        boardKey: "community-review",
        title: `${r.programTitle} 수강후기`,
        body: r.content,
        rating: r.rating,
        programTitle: r.programTitle,
        isApproved: r.isApproved ?? false,
        authorUid: r.authorUid || "",
        authorName: r.authorName,
        createdAt: r.createdAt || "",
      }),
    );
  } catch {
    return [];
  }
}

export async function loadLegacyFaqAsContent(): Promise<Content[]> {
  try {
    const items = await getOrderedCollection<LegacyFaq>(COLLECTIONS.FAQ, "displayOrder", "asc");
    return items.map((f, idx) =>
      toContent({
        id: `legacy-faq-${f.id}`,
        boardKey: "community-faq",
        title: f.question,
        question: f.question,
        answer: f.answer,
        body: f.answer,
        isPinned: false,
        authorUid: "",
        authorName: "AISH",
        tags: f.category ? [f.category] : [],
        createdAt: "",
      }),
    );
  } catch {
    return [];
  }
}

/** 콘텐츠 그룹 레거시 데이터 전체 로드 */
export async function loadAllLegacyMediaAsContent(): Promise<Content[]> {
  const [videos, gallery, resources] = await Promise.all([
    loadLegacyVideosAsContent(),
    loadLegacyGalleryAsContent(),
    loadLegacyResourcesAsContent(),
  ]);
  return [...videos, ...gallery, ...resources];
}

/** 커뮤니티 그룹 레거시 데이터 전체 로드 */
export async function loadAllLegacyCommunityAsContent(): Promise<Content[]> {
  const [notices, free, reviews, faq] = await Promise.all([
    loadLegacyPostsAsContent("NOTICE", "community-notice"),
    loadLegacyPostsAsContent("FREE", "community-free"),
    loadLegacyReviewsAsContent(),
    loadLegacyFaqAsContent(),
  ]);
  return [...notices, ...free, ...reviews, ...faq];
}
