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

/** http(s) 외부 URL이면 true (새 탭 / noopener 처리용) */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
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
