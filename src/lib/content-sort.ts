import { toMillis } from "@/lib/utils";
import type { Content } from "@/types/content";

export type ContentSort = "latest" | "likes" | "comments";

export const CONTENT_SORTS: { key: ContentSort; label: string }[] = [
  { key: "latest", label: "최신순" },
  { key: "likes", label: "좋아요순" },
  { key: "comments", label: "댓글순" },
];

/** 콘텐츠 목록을 정렬 기준에 따라 정렬(원본 불변). 동점은 최신순으로 보조 정렬. */
export function sortContents<T extends Content>(items: T[], sort: ContentSort): T[] {
  const byLatest = (a: Content, b: Content) => toMillis(b.createdAt) - toMillis(a.createdAt);
  const arr = [...items];
  if (sort === "likes") {
    arr.sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0) || byLatest(a, b));
  } else if (sort === "comments") {
    arr.sort((a, b) => (b.commentCount ?? 0) - (a.commentCount ?? 0) || byLatest(a, b));
  } else {
    arr.sort(byLatest);
  }
  return arr;
}
