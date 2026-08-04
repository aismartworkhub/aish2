/** 기업 성공사례 — AI 활용으로 어떻게 성공·변화했는지 소개 */

export interface SuccessMetric {
  /** 지표 이름 (예: 업무시간 절감) */
  label: string;
  /** 지표 값 (예: -40%, +25%, 3배) */
  value: string;
}

/** 컨설턴트 — 강사(instructors)에서 선택 (저장 시 이름·이미지 비정규화) */
export interface SuccessConsultant {
  /** 강사 문서 id (연결용) */
  id?: string;
  name: string;
  title?: string;
  imageUrl?: string;
}

/** 관련 프롬프트 — edunfuture 등에서 선택 */
export interface SuccessPrompt {
  title: string;
  /** 프롬프트 본문/설명 */
  content?: string;
  /** 출처 링크 (예: edunfuture 도구 URL) */
  url?: string;
}

export interface SuccessCase {
  id: string;
  companyName: string;
  companyLogoUrl?: string;
  industry?: string;
  title: string;
  summary?: string;
  thumbnailUrl?: string;
  /** 컨설턴트 (강사에서 선택, 1~2명) */
  consultants?: SuccessConsultant[];
  /** 현황파악 — 도입 전 기업의 상황·데이터 진단 */
  situation?: string;
  /** 분석진단 — 문제 원인 분석과 AI 적용 판단 */
  diagnosis?: string;
  /** 도입 전 과제·문제 */
  challenge?: string;
  /** 어떤 AI를 어떻게 활용했는지 */
  solution?: string;
  /** 성과·변화(서술) */
  result?: string;
  /** 관련 프롬프트 (edunfuture 등에서 선택) */
  prompts?: SuccessPrompt[];
  /** 핵심 성과 지표 */
  metrics?: SuccessMetric[];
  /** 활용 AI·분야 태그 */
  tags?: string[];
  /** 담당자 인용(후기) */
  testimonial?: string;
  testimonialAuthor?: string;
  ctaText?: string;
  ctaLink?: string;
  /** 노출 순서 (작을수록 먼저) */
  order?: number;
  /** 공개 숨김 */
  hidden?: boolean;
  createdAt?: string;
}
