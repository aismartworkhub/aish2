/** 기업 성공사례 — AI 활용으로 어떻게 성공·변화했는지 소개 */

export interface SuccessMetric {
  /** 지표 이름 (예: 업무시간 절감) */
  label: string;
  /** 지표 값 (예: -40%, +25%, 3배) */
  value: string;
}

export interface SuccessCase {
  id: string;
  companyName: string;
  companyLogoUrl?: string;
  industry?: string;
  title: string;
  summary?: string;
  thumbnailUrl?: string;
  /** 도입 전 과제·문제 */
  challenge?: string;
  /** 어떤 AI를 어떻게 활용했는지 */
  solution?: string;
  /** 성과·변화(서술) */
  result?: string;
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
