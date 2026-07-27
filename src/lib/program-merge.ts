import type { RunmoaContent, RunmoaContentType } from "@/types/runmoa";
import type { ProgramOverrides } from "@/lib/program-overrides";
import { mergeProgram, sanitizeProgramText } from "@/lib/program-overrides";
import { PROGRAM_CATEGORY_LABELS } from "@/lib/constants";

const RUNMOA_BASE = "https://aish.runmoa.com";
/** 정렬 미지정 항목을 뒤로 보내기 위한 기본 순서값 */
const NO_ORDER = Number.MAX_SAFE_INTEGER;
/** 자체 프로그램 유형 뱃지 기본값 */
const SELF_DEFAULT_TYPE: RunmoaContentType = "offline";
/** 실제로 존재하지 않는 레거시 placeholder 경로 — '이미지 없음'으로 처리해 카드 폴백을 띄운다. */
const MISSING_PLACEHOLDERS = new Set([
  "/images/placeholder-program.jpg",
  "/images/placeholder-profile.jpg",
]);

/** 유효한 썸네일만 반환 (없거나 레거시 placeholder면 빈 문자열) */
function resolveThumb(url?: string): string {
  const u = url?.trim() || "";
  return MISSING_PLACEHOLDERS.has(u) ? "" : u;
}

/**
 * aish.co.kr 자체 등록 프로그램 (Firestore `programs` 컬렉션).
 * Runmoa 원본과 겹치는 상품이면 `runmoaContentId`로 연결해 중복 노출을 막는다.
 */
export type SelfProgram = {
  id: string;
  title: string;
  category?: string;
  summary?: string;
  description?: string;
  thumbnailUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  status?: string;
  // 표시/가격
  contentType?: RunmoaContentType;
  isFree?: boolean;
  basePrice?: number;
  salePrice?: number;
  isOnSale?: boolean;
  // 노출 제어 + 중복 연결
  order?: number;
  hidden?: boolean;
  runmoaContentId?: number;
};

/**
 * 홈·교육과정 카드가 소비하는 통합 프로그램 형태.
 * 기존 카드가 RunmoaContent 필드를 그대로 쓰므로 자체 프로그램도 같은 형태로 어댑트하고,
 * 링크·React key 용도의 확장 필드만 덧붙인다.
 */
export type MergedProgram = RunmoaContent & {
  /** 자체 프로그램이면 원본 Firestore 문서 id (Runmoa 항목은 undefined) */
  __selfId?: string;
  /** 카드 링크 대상 (자체=ctaLink, Runmoa=classes URL) */
  __href: string;
  /** 정렬용 순서값 (작을수록 앞) */
  __order: number;
};

/** 카드 React key — 자체는 self:id, Runmoa는 content_id */
export function programKey(c: MergedProgram): string {
  return c.__selfId ? `self:${c.__selfId}` : `runmoa:${c.content_id}`;
}

/** 제목 정규화 — 공백·대소문자 무시로 중복 추정 비교 */
function normalizeTitle(title: string): string {
  return sanitizeProgramText(title).toLowerCase().replace(/\s+/g, "");
}

/** 자체 프로그램을 RunmoaContent 형태로 어댑트 */
function selfToMerged(p: SelfProgram): MergedProgram {
  const categoryName = (p.category && PROGRAM_CATEGORY_LABELS[p.category]) || p.category || "교육과정";
  const href = p.ctaLink?.trim() || `${RUNMOA_BASE}/classes`;
  const thumb = resolveThumb(p.thumbnailUrl);
  return {
    content_id: 0,
    title: sanitizeProgramText(p.title),
    description_html: p.description ?? p.summary ?? "",
    content_type: p.contentType ?? SELF_DEFAULT_TYPE,
    status: "publish",
    language: "ko",
    category_ids: [],
    categories: [{ category_id: 0, parent_category_id: 0, name: categoryName, description: "", path: "" }],
    featured_image: thumb,
    images: [],
    thumbnail_link: thumb || null,
    base_price: p.basePrice ?? 0,
    sale_price: p.salePrice ?? 0,
    is_on_sale: p.isOnSale ?? false,
    is_free: p.isFree ?? false,
    options: [],
    created_at: "",
    updated_at: "",
    __selfId: p.id,
    __href: href,
    __order: typeof p.order === "number" ? p.order : NO_ORDER,
  };
}

/** Runmoa 콘텐츠를 통합 형태로 어댑트 (오버레이 병합 + 순서) */
function runmoaToMerged(c: RunmoaContent, overrides: ProgramOverrides): MergedProgram {
  const ov = overrides[String(c.content_id)];
  const merged = mergeProgram(c, ov);
  return {
    ...merged,
    title: sanitizeProgramText(merged.title),
    __href: `${RUNMOA_BASE}/classes/${c.content_id}`,
    __order: typeof ov?.order === "number" ? ov.order : NO_ORDER,
  };
}

/**
 * Runmoa 상품과 자체 프로그램을 병합한다.
 * - 숨김 항목 제외
 * - 중복 제거: 자체 프로그램의 runmoaContentId가 Runmoa 목록에 있으면 자체를 버림(원본 우선).
 *   미연결이라도 정규화 제목이 Runmoa 항목과 같으면 중복으로 보고 제외.
 * - 정렬: order 지정 항목이 (작은 값부터) 먼저, 미지정은 [Runmoa→자체] 삽입 순서 유지(stable).
 */
export function mergeProgramSources(
  runmoa: RunmoaContent[],
  self: SelfProgram[],
  overrides: ProgramOverrides = {},
): MergedProgram[] {
  const runmoaVisible = runmoa.filter((c) => !overrides[String(c.content_id)]?.hidden);
  const runmoaItems = runmoaVisible.map((c) => runmoaToMerged(c, overrides));

  const runmoaIds = new Set(runmoaVisible.map((c) => c.content_id));
  const runmoaTitleKeys = new Set(runmoaItems.map((c) => normalizeTitle(c.title)));

  const selfItems = self
    .filter((p) => !p.hidden)
    .filter((p) => !(typeof p.runmoaContentId === "number" && runmoaIds.has(p.runmoaContentId)))
    .filter((p) => !runmoaTitleKeys.has(normalizeTitle(p.title)))
    .map(selfToMerged);

  const combined = [...runmoaItems, ...selfItems];
  return combined
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.__order - b.c.__order || a.i - b.i)
    .map((x) => x.c);
}
