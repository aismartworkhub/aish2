import { getSingletonDoc, setSingletonDoc, COLLECTIONS } from "@/lib/firestore";

/** Runmoa 프로그램(외부 읽기전용)에 관리자가 덧씌우는 노출 순서·숨김 값 */
export type ProgramOverride = { order?: number; hidden?: boolean };

/** content_id(문자열) → 오버라이드 */
export type ProgramOverrides = Record<string, ProgramOverride>;

const OVERRIDES_DOC_ID = "program-overrides";

type OverridesDoc = { items?: ProgramOverrides };

/** 관리자 지정 순서·숨김 맵 로드 (없으면 빈 맵) */
export async function loadProgramOverrides(): Promise<ProgramOverrides> {
  const doc = await getSingletonDoc<OverridesDoc>(COLLECTIONS.SETTINGS, OVERRIDES_DOC_ID);
  return doc?.items ?? {};
}

/** 관리자 지정 순서·숨김 맵 저장 */
export async function saveProgramOverrides(items: ProgramOverrides): Promise<void> {
  await setSingletonDoc(COLLECTIONS.SETTINGS, OVERRIDES_DOC_ID, { items });
}

/**
 * Runmoa 목록에 오버라이드 적용: 숨김 제거 + 지정 순서 우선 정렬.
 * 순서가 지정된 항목이 (작은 값부터) 앞에 오고, 미지정 항목은 원래 순서를 유지한다(stable).
 */
export function applyProgramOverrides<T extends { content_id: number }>(
  list: T[],
  overrides: ProgramOverrides,
): T[] {
  const visible = list.filter((c) => !overrides[String(c.content_id)]?.hidden);
  const orderOf = (c: T): number | null => {
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
    .map((x) => x.c);
}
