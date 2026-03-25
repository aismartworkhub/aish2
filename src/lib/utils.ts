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
  const ucMatch = trimmed.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (ucMatch) return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;

  return trimmed;
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
