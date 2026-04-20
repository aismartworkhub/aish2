import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

const HTML_SCRIPT_BLOCK_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const HTML_STYLE_BLOCK_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const HTML_TAG_RE = /<[^>]*>/g;

/** 태그만 지우면 <style> 본문(CSS)이 그대로 남는 문제 방지 */
function looksLikeCssOrScopedStyleSnippet(text: string): boolean {
  const s = text.trim();
  if (s.length < 8) return false;
  if (/\.rmclass-/i.test(s)) return true;
  if (/^\/\*[\s\S]*\*\/\s*[\s\S]*\{/.test(s) && /[{}]/.test(s)) return true;
  if (
    /^(\/\*|\.[a-zA-Z0-9_-]+|#[a-zA-Z0-9_-]+|@[a-z-]+)/.test(s) &&
    /--[\w-]+\s*:/.test(s) &&
    /[{};]/.test(s)
  ) {
    return true;
  }
  return false;
}

/**
 * Runmoa 등에서 내려오는 HTML에서 카드용 짧은 일반 텍스트만 추출한다.
 * <script>/<style> 블록 전체를 먼저 제거한 뒤 태그를 벗긴다.
 */
export function htmlToPlainTextSummary(html: string, maxLen?: number): string {
  if (!html) return "";
  let t = html
    .replace(HTML_SCRIPT_BLOCK_RE, " ")
    .replace(HTML_STYLE_BLOCK_RE, " ")
    .replace(HTML_COMMENT_RE, " ");
  t = t.replace(HTML_TAG_RE, " ");
  t = t
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
  t = t.replace(/\s+/g, " ").trim();
  if (looksLikeCssOrScopedStyleSnippet(t)) return "";
  if (maxLen !== undefined && maxLen > 0 && t.length > maxLen) {
    t = t.slice(0, maxLen);
  }
  return t;
}

/** http(s) 외부 URL이면 true (새 탭 / noopener 처리용) */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

/** 알림 문서의 linkUrl / linkTab / linkTargetId로 이동 경로 계산 */
export function resolveNotificationHref(n: {
  linkUrl?: string;
  linkTab?: string;
  linkTargetId?: string;
}): string {
  const u = n.linkUrl?.trim();
  if (u) return u;
  const tab = n.linkTab?.trim();
  const id = n.linkTargetId?.trim();
  if (tab && id) return `/community?tab=${encodeURIComponent(tab)}&postId=${encodeURIComponent(id)}`;
  if (tab) return `/community?tab=${encodeURIComponent(tab)}`;
  return "/community?tab=notice";
}

/**
 * Google Drive 공유 링크를 직접 접근 가능한 이미지 URL로 변환한다.
 * 일반 URL은 그대로 반환한다.
 */
export function toDirectImageUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();

  // drive.google.com/file/d/FILE_ID/... 형식
  const fileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;

  // drive.google.com/open?id=FILE_ID 형식
  const openMatch = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;

  // drive.google.com/uc?id=FILE_ID 또는 export=view&id=FILE_ID
  const ucMatch = trimmed.match(/drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (ucMatch) return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;

  // /drive/u/0/file/d/FILE_ID/ 등
  const driveFileMatch = trimmed.match(/drive\.google\.com\/(?:drive\/[^/]+\/)?file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch) return `https://lh3.googleusercontent.com/d/${driveFileMatch[1]}`;

  return trimmed;
}

/** 공유 링크·uc·usercontent에서 Google Drive 파일 ID 추출 (없으면 null) */
export function extractGoogleDriveFileId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const mFile = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (mFile) return mFile[1];

  const mOpen = trimmed.match(/drive\.google\.com\/open\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (mOpen) return mOpen[1];

  const mUc = trimmed.match(/drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (mUc) return mUc[1];

  const mThumb = trimmed.match(/drive\.google\.com\/thumbnail\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (mThumb) return mThumb[1];

  const mLh = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (mLh) return mLh[1];

  return null;
}

/** 브라우저에서 미리보기가 잘 되는 Drive 썸네일 엔드포인트 (공개 링크일 때) */
export function googleDriveThumbnailUrl(fileId: string, width = 1200): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`;
}

/** Drive 이미지 직접 표시용 (공개 공유 시 비로그인에서 lh3보다 잘 되는 경우 있음) */
export function googleDriveUcExportViewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}


/**
 * Firestore Timestamp 또는 문자열을 안전한 날짜 문자열로 변환한다.
 * Timestamp 객체({seconds, nanoseconds})를 React에서 직접 렌더링하면 에러 발생.
 */
export function toDateString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const ts = value as { seconds: number };
    return new Date(ts.seconds * 1000).toISOString().slice(0, 10).replace(/-/g, ".");
  }
  return String(value);
}

// ── 유효성 검증 유틸 ──

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function isValidUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function isValidDateRange(start: string, end: string): boolean {
  if (!start || !end) return true;
  return new Date(start) <= new Date(end);
}

export function isValidPhone(phone: string): boolean {
  return /^[\d-]{9,15}$/.test(phone.replace(/\s/g, ""));
}

export function calculateDDay(dateStr: string): string {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "D-Day";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}
