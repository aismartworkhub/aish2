/**
 * 관리자 폼 검증 — 공개 페이지 CTA/이미지 URL 등
 */

const HTTP_OR_PATH = /^(https?:\/\/|\/)/i;

/** 비어 있으면 통과. 값이 있으면 `http(s)://` 또는 `/` 로 시작해야 함 */
export function isValidOptionalHttpOrPath(value: string): boolean {
  const v = value.trim();
  if (v === "") return true;
  return HTTP_OR_PATH.test(v);
}

/** 이미지·파일 URL: 비어 있으면 false (필수 필드용). 값이 있으면 일반 URL·사이트 경로·구글 드라이브 공유 링크 허용 */
export function isValidNonEmptyImageSource(value: string): boolean {
  const v = value.trim();
  if (v === "") return false;
  if (v.startsWith("/")) return true;
  if (/^https?:\/\//i.test(v)) return true;
  return false;
}

export const ADMIN_SETTINGS_SAVED_PUBLIC_HINT =
  "공개 페이지는 새로고침 후(최대 약 30초 내 캐시) 반영됩니다.";
