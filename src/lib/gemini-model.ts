/**
 * 전 기능 공용 Gemini 모델 ID (단일 소스).
 *
 * 상담창·AI 요약·콘텐츠 큐레이션·명함/이벤트/강사 분석이 모두 이 값을 사용한다.
 * Google이 모델을 폐기(404 "no longer available")하면 **이 한 줄만** 교체하면 된다.
 * 의존성 없는 leaf 모듈 — 클라이언트·Node 크론 양쪽에서 안전하게 import 가능.
 */
export const GEMINI_MODEL = "gemini-2.5-flash-lite";
