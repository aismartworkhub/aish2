/** YouTube 동영상 ID는 11자 [A-Za-z0-9_-] */
const YOUTUBE_ID_RE = /^[\w-]{11}$/;

/**
 * 다양한 YouTube/Shorts/공유 URL에서 동영상 ID만 추출한다.
 * (watch?v= 뒤에 다른 쿼리가 있어도 동작, m.youtube.com 지원)
 */
export function extractYouTubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const u = new URL(withProtocol);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") {
      const seg = u.pathname.split("/").filter(Boolean)[0]?.split("?")[0] ?? "";
      if (YOUTUBE_ID_RE.test(seg)) return seg;
    }

    if (host === "m.youtube.com" || host === "youtube.com" || host.endsWith(".youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && YOUTUBE_ID_RE.test(v)) return v;

      const parts = u.pathname.split("/").filter(Boolean);
      for (const key of ["embed", "shorts", "live"]) {
        const i = parts.indexOf(key);
        if (i >= 0 && parts[i + 1] && YOUTUBE_ID_RE.test(parts[i + 1])) {
          return parts[i + 1];
        }
      }
    }
  } catch {
    /* URL 파싱 실패 시 아래 정규식으로 재시도 */
  }

  const qv = raw.match(/[?&]v=([\w-]{11})\b/);
  if (qv) return qv[1];

  const be = raw.match(/youtu\.be\/([\w-]{11})/);
  if (be) return be[1];

  const path = raw.match(/youtube\.com\/(?:embed|shorts|live)\/([\w-]{11})/);
  if (path) return path[1];

  return null;
}

/** i.ytimg.com / img.youtube.com 썸네일 URL (품질 단계) */
export type YoutubeThumbQuality = "maxresdefault" | "hqdefault" | "mqdefault" | "default";

export function youtubeThumbnailUrls(videoUrl: string): string[] {
  const id = extractYouTubeVideoId(videoUrl);
  if (!id) return [];
  // hqdefault 우선 — 첫 시도부터 좋은 품질 → 폴백 추가 요청 회피.
  // (mqdefault는 일부 영상에서 letter-box 검은 띠가 있고, hqdefault는 항상 존재)
  return [
    `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/default.jpg`,
  ];
}
