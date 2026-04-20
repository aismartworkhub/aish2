import type { Content } from "@/types/content";

/** 사이트에 보여 줄 제목: 한글 표시용이 있으면 우선 */
export function contentDisplayTitle(c: Content): string {
  const ko = c.titleKo?.trim();
  if (ko) return ko;
  return c.title;
}

/** 사이트에 보여 줄 본문: 한글 표시용이 있으면 우선 */
export function contentDisplayBody(c: Content): string {
  const ko = c.bodyKo?.trim();
  if (ko) return ko;
  return c.body ?? "";
}
