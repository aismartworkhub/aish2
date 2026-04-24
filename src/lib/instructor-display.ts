/** 강사 표시 로직 공통 유틸 */

export type InstructorFilterable = {
  isActive?: boolean;
  status?: string;
  displayOrder?: number;
};

/**
 * 공개 노출용 강사 필터 + 정렬.
 * - 비활성(isActive === false) 제외
 * - status가 "pending" 또는 "rejected"면 제외
 * - displayOrder 오름차순 (없으면 999 취급)
 */
export function filterActiveInstructors<T extends InstructorFilterable>(list: T[]): T[] {
  return list
    .filter((i) => i.isActive !== false && i.status !== "pending" && i.status !== "rejected")
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
}
