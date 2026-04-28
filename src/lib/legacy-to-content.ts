/**
 * 레거시 컬렉션(Review/Post/Resource) → ContentCard에 그릴 수 있는 Content 모양으로
 * in-memory 변환하는 어댑터. /community 탭들에 동일 ViewModeToggle 적용을 위해.
 *
 * 주의: 클라이언트 화면용 변환만. DB에 저장하지 않음.
 */

import type { Content } from "@/types/content";
import type { Review, Post, Resource } from "@/types/firestore";

/** Review (수강후기) → Content-like */
export function reviewToContent(r: Review): Content {
  return {
    id: r.id ?? `review-${r.authorName}-${r.createdAt}`,
    boardKey: "community-review",
    group: "community",
    title: r.programTitle ? `[${r.programTitle}] ${"⭐".repeat(Math.max(1, Math.min(5, r.rating || 0)))}` : `${"⭐".repeat(Math.max(1, Math.min(5, r.rating || 0)))} 수강 후기`,
    body: r.content,
    authorUid: "",
    authorName: r.authorName,
    tags: r.authorCohort ? [r.authorCohort] : [],
    isPinned: r.isFeatured ?? false,
    isApproved: r.isApproved !== false,
    views: 0,
    likeCount: 0,
    commentCount: 0,
    createdAt: r.createdAt,
    rating: r.rating,
    programTitle: r.programTitle,
  };
}

/** Post (공지·자료 등 레거시) → Content-like */
export function postToContent(p: Post): Content {
  const type = p.type || "NOTICE";
  const boardKey =
    type === "NOTICE" ? "community-notice" :
    type === "RESOURCE" ? "media-resource" :
    "community-notice";
  return {
    id: p.id ?? `post-${p.title}`,
    boardKey,
    group: type === "RESOURCE" ? "media" : "community",
    title: p.title || "(제목 없음)",
    body: p.content || "",
    authorUid: "",
    authorName: p.author ?? "운영진",
    isPinned: p.isPinned ?? false,
    isApproved: true,
    views: 0,
    likeCount: 0,
    commentCount: 0,
    createdAt: p.createdAt ?? new Date().toISOString(),
  };
}

/** Resource (학습자료) → Content-like */
export function resourceToContent(r: Resource): Content {
  return {
    id: r.id ?? `resource-${r.title}`,
    boardKey: "media-resource",
    group: "media",
    title: r.title || "(제목 없음)",
    body: r.description || "",
    mediaType: r.fileType === "pdf" ? "pdf" : "link",
    mediaUrl: r.driveDownloadUrl || r.driveViewUrl,
    authorUid: "",
    authorName: r.uploaderName ?? "AISH",
    tags: r.tags ?? [],
    isPinned: false,
    isApproved: true,
    views: 0,
    likeCount: 0,
    commentCount: 0,
    downloadCount: r.downloads ?? 0,
    createdAt: new Date().toISOString(), // Resource doesn't have createdAt
  };
}
