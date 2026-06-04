/** 메인 페이지(홈) 섹션 레이아웃 — 표시/순서/제목/여백 관리. 템플릿별로 섹션 구성이 다름. */

export type HomeTemplateKey = "default" | "modern" | "community";

export interface HomeSectionItem {
  /** 섹션 키 (템플릿마다 다름) */
  key: string;
  /** 공개 페이지 노출 여부 */
  visible: boolean;
  /** 렌더 순서 (오름차순). 작을수록 위. */
  order: number;
  /** 섹션 제목 — 헤딩이 있는 섹션만 사용 */
  title?: string;
  /** 섹션 설명(부제) */
  description?: string;
  /** 상단 여백 px 오버라이드 (null/undefined = 기본 유지) */
  paddingTop?: number | null;
  /** 하단 여백 px 오버라이드 (null/undefined = 기본 유지) */
  paddingBottom?: number | null;
}

export interface HomeLayout {
  sections: HomeSectionItem[];
}
