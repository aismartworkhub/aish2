/** AI 쇼룸 단위 프로젝트(공장) 목록 — 성공사례 '관련 프롬프트' 링크용
 *  출처: https://ai-showroom-xi.vercel.app/#/factories */

export const AI_SHOWROOM_FACTORY_BASE = "https://ai-showroom-xi.vercel.app/#/factories";

export const AI_SHOWROOM_FACTORIES: { slug: string; name: string }[] = [
  { slug: "automation-basics", name: "자동화 기초 공장" },
  { slug: "lecture-slide-mill", name: "강의 슬라이드 공장" },
  { slug: "sillok-insta", name: "고전 기록 인스타 공장" },
  { slug: "briefing", name: "브리핑 공장" },
  { slug: "research", name: "콘텐츠 리서치 공장" },
  { slug: "cardnews", name: "카드뉴스 공장" },
  { slug: "kakao-brief", name: "카톡 브리핑 공장" },
  { slug: "briefing-maker", name: "브리핑 메이커" },
  { slug: "ppt", name: "PPT 공장" },
  { slug: "sourcing", name: "소싱 공장" },
  { slug: "video-cloner", name: "바이럴 영상 복제 공장" },
  { slug: "expo", name: "전시회 소싱 공장" },
  { slug: "keywords", name: "키워드 리서치 공장" },
  { slug: "youtube", name: "유튜브 영상 공장" },
  { slug: "cases", name: "설치 사례 3종 공장" },
  { slug: "novel", name: "밤의 서재 — 책 공장" },
  { slug: "travel", name: "여행 보딩패스 공장" },
  { slug: "vibecoding", name: "바이브코딩 기초 공장" },
  { slug: "hari", name: "하리 브랜드 공장" },
  { slug: "obsidian", name: "옵시디언 공장" },
  { slug: "naver-blog", name: "블로그 원고 공장" },
  { slug: "gov-grant", name: "정부과제 공장" },
  { slug: "buddy", name: "버디 앱 공장 (영어·중국어)" },
];

export const factoryUrl = (slug: string) => `${AI_SHOWROOM_FACTORY_BASE}/${slug}`;
