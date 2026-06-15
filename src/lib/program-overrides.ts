import { getSingletonDoc, setSingletonDoc, COLLECTIONS } from "@/lib/firestore";
import type { RunmoaContent, RunmoaContentType } from "@/types/runmoa";

/**
 * Runmoa 프로그램(외부 읽기전용)에 관리자가 덧씌우는 표시 오버레이.
 * 노출 순서·숨김 + 카드 표시 필드(제목·설명·이미지·유형·가격)를 덮어쓴다.
 * 값이 없는 필드는 Runmoa 원본을 그대로 사용한다.
 */
export type ProgramOverride = {
  order?: number;
  hidden?: boolean;
  // 표시 필드 오버레이
  title?: string;
  description?: string;          // 평문/HTML 모두 허용 — 카드에서 htmlToPlainTextSummary 처리
  featuredImage?: string;
  contentType?: RunmoaContentType;
  isFree?: boolean;
  basePrice?: number;
  salePrice?: number;
  isOnSale?: boolean;
};

/** content_id(문자열) → 오버라이드 */
export type ProgramOverrides = Record<string, ProgramOverride>;

const OVERRIDES_DOC_ID = "program-overrides";

type OverridesDoc = { items?: ProgramOverrides };

/** 관리자 오버레이 맵 로드 (없으면 빈 맵) */
export async function loadProgramOverrides(): Promise<ProgramOverrides> {
  const doc = await getSingletonDoc<OverridesDoc>(COLLECTIONS.SETTINGS, OVERRIDES_DOC_ID);
  return doc?.items ?? {};
}

/** 관리자 오버레이 맵 저장 */
export async function saveProgramOverrides(items: ProgramOverrides): Promise<void> {
  await setSingletonDoc(COLLECTIONS.SETTINGS, OVERRIDES_DOC_ID, { items });
}

/**
 * Runmoa 원문에 흔한 표시 오타를 표시 단계에서 정리한다.
 * - 단독 한글 자모(깨진 글자) 제거
 * - 복제 접미사 `_copy` 제거
 * - 대괄호 주변 공백 정규화, 연속 공백 축소
 * - 단독/한글 앞 소문자 `ai` → `AI` (email·training 등 단어 내부는 건드리지 않음)
 */
export function sanitizeProgramText(s: string): string {
  if (!s) return s;
  return s
    .replace(/[㄰-㆏]/g, "")
    .replace(/(?:_copy)+\s*$/i, "")
    .replace(/\[\s+/g, "[")
    .replace(/\s+\]/g, "]")
    .replace(/\](?=[^\s\]])/g, "] ")
    .replace(/\bai\b/gi, "AI")
    .replace(/\bai(?=[가-힣])/g, "AI")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Runmoa 콘텐츠에 오버레이 표시 필드를 병합(있는 필드만 덮어씀) */
export function mergeProgram(c: RunmoaContent, ov?: ProgramOverride): RunmoaContent {
  if (!ov) return c;
  return {
    ...c,
    title: ov.title?.trim() ? ov.title : c.title,
    description_html: ov.description?.trim() ? ov.description : c.description_html,
    featured_image: ov.featuredImage?.trim() ? ov.featuredImage : c.featured_image,
    content_type: ov.contentType ?? c.content_type,
    is_free: ov.isFree ?? c.is_free,
    base_price: typeof ov.basePrice === "number" ? ov.basePrice : c.base_price,
    sale_price: typeof ov.salePrice === "number" ? ov.salePrice : c.sale_price,
    is_on_sale: ov.isOnSale ?? c.is_on_sale,
  };
}

/**
 * Runmoa 목록에 오버레이 적용: 숨김 제거 + 지정 순서 우선 정렬 + 표시 필드 병합.
 * 순서가 지정된 항목이 (작은 값부터) 앞에 오고, 미지정 항목은 원래 순서를 유지한다(stable).
 */
export function applyProgramOverrides(
  list: RunmoaContent[],
  overrides: ProgramOverrides,
): RunmoaContent[] {
  const visible = list.filter((c) => !overrides[String(c.content_id)]?.hidden);
  const orderOf = (c: RunmoaContent): number | null => {
    const v = overrides[String(c.content_id)]?.order;
    return typeof v === "number" ? v : null;
  };
  return visible
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const oa = orderOf(a.c);
      const ob = orderOf(b.c);
      if (oa !== null && ob !== null) return oa - ob || a.i - b.i;
      if (oa !== null) return -1;
      if (ob !== null) return 1;
      return a.i - b.i;
    })
    .map((x) => {
      const merged = mergeProgram(x.c, overrides[String(x.c.content_id)]);
      // 관리자 오버레이가 없는 필드에 남은 원문 오타를 표시 단계에서 정리
      return { ...merged, title: sanitizeProgramText(merged.title) };
    });
}
