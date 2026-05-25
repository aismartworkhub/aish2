/**
 * AI 콘텐츠 수집·큐레이션 차단 키워드 리스트.
 *
 * AISH 는 AI 교육 플랫폼이므로 다음 카테고리는 메인 피드에 부적합:
 *   - 정치·시사 (정치인·정당·대선·선거 등)
 *   - 게임 스트리밍·리뷰 (단, 'AI 게임' / '게임 AI' 등 기술 맥락은 허용 필요)
 *   - 도박·성인 콘텐츠
 *   - 폭력·혐오·차별 발언
 *   - 단순 자극성·뉴스 토론 (시사평론 채널 등)
 *
 * 키워드는 소문자로 비교 (한글은 대소문자 구분 없음). 부분 매칭.
 *
 * 운영 가이드:
 *   - false positive (정상 콘텐츠 차단) 가 false negative 보다 비싸므로 보수적으로 운영.
 *   - 'AI', '머신러닝' 같은 허용 키워드가 있으면 차단 카운트 1점 감산 (오버라이드).
 */

/** 1점 이상 매칭 시 차단 후보로 분류 */
export const BLOCK_KEYWORDS: string[] = [
  // 정치·시사 (특정 인물 이름은 false positive 위험으로 보수적)
  "시사평론", "시사 평론", "정치평론", "정치 평론",
  "대통령", "국회의원", "장관후보", "법무부장관",
  "여당", "야당", "민주당", "국민의힘",
  "검찰", "검사동일체", "탄핵",
  "대선", "총선", "지방선거", "정치공방",
  // 게임 스트리밍·순수오락
  "게임실황", "게임 실황", "겜방송", "롤", "리그오브레전드", "오버워치",
  "스트리머", "트위치", "겜방", "치지직",
  // 도박
  "도박", "베팅", "토토", "사다리", "바카라", "카지노", "슬롯",
  // 성인·혐오
  "성인용", "야동", "음란", "혐오",
  // 가짜뉴스·음모론
  "음모론", "딥스테이트", "음모설",
];

/** 매칭 시 차단 카운트 1점 감산 — 허용 컨텍스트 (AI·교육 맥락) */
export const ALLOW_OVERRIDE_KEYWORDS: string[] = [
  "ai", "인공지능", "머신러닝", "딥러닝",
  "데이터", "데이터과학", "데이터분석",
  "코딩", "프로그래밍", "개발자", "엔지니어",
  "교육", "강의", "튜토리얼", "course",
  "llm", "chatgpt", "claude", "gemini", "openai",
  "rag", "agent", "에이전트", "프롬프트",
  "tensorflow", "pytorch", "huggingface",
];

/** 콘텐츠가 차단 대상인지 판정 */
export function isBlockedContent(text: string): { blocked: boolean; reason?: string; hits: string[] } {
  const t = text.toLowerCase();
  const blockHits = BLOCK_KEYWORDS.filter((k) => t.includes(k.toLowerCase()));
  if (blockHits.length === 0) return { blocked: false, hits: [] };

  const allowHits = ALLOW_OVERRIDE_KEYWORDS.filter((k) => t.includes(k.toLowerCase()));
  // 차단 키워드 카운트가 허용 키워드보다 많으면 차단
  if (blockHits.length > allowHits.length) {
    return {
      blocked: true,
      reason: `차단 키워드 ${blockHits.length}건 ${allowHits.length ? `(허용 컨텍스트 ${allowHits.length}건보다 우세)` : ""}`,
      hits: blockHits,
    };
  }
  return { blocked: false, hits: blockHits };
}

/** 차단 키워드 매칭이 있되 허용 컨텍스트로 통과한 경우 — 운영 검토용 */
export function isSuspectContent(text: string): { suspect: boolean; hits: string[] } {
  const r = isBlockedContent(text);
  return { suspect: !r.blocked && r.hits.length > 0, hits: r.hits };
}
