export interface QuickBannerDemo {
 id: string;
 title: string;
 description: string;
 ctaText: string;
 ctaLink: string;
 ctaOpenNewTab: boolean;
 style: "INFO" | "PROMOTION" | "WARNING" | "EVENT";
 position: "TOP" | "BOTTOM" | "MODAL";
 backgroundColor: string | null;
 textColor: string | null;
 targetPages: string[];
 isDismissible: boolean;
 isActive: boolean;
 startDate: string;
 endDate: string;
 displayOrder: number;
}

export const DEMO_STATS = [
 { label: "누적 수강생", value: 1500, unit: "명", icon: "Users" },
 { label: "진행 기수", value: 11, unit: "기", icon: "GraduationCap" },
 { label: "전문 강사진", value: 5, unit: "인", icon: "UserCheck" },
 { label: "정부과제", value: 3, unit: "건", icon: "Building" },
];

export const DEMO_INSTRUCTORS = [
 {
   id: "ins-1",
   name: "김상용",
   title: "AI 교육 총괄 디렉터",
   organization: "AISH",
   profileImageUrl: "/images/placeholder-profile.jpg",
   specialties: ["AI 기초", "프롬프트 엔지니어링"],
   bio: "15년 이상의 AI/ML 분야 경력을 바탕으로, 초보자부터 실무자까지 쉽게 이해할 수 있는 교육 커리큘럼을 설계합니다.",
   socialLinks: {
     linkedin: "",
     youtube: "",
     instagram: "",
     github: null,
     personalSite: null,
   },
   programs: ["AI 기초 정규과정 11기", "AI 정부과제 A"],
 },
 {
   id: "ins-2",
   name: "제갈정",
   title: "바이브 코딩 전문가",
   organization: "AISH",
   profileImageUrl: "/images/placeholder-profile.jpg",
   specialties: ["바이브 코딩", "웹 개발", "크리에이티브 코딩"],
   bio: "코드와 예술의 경계를 허무는 바이브 코딩의 선구자. 창의적인 접근방식으로 프로그래밍의 즐거움을 전달합니다.",
   socialLinks: {
     linkedin: "",
     youtube: "",
     instagram: null,
     github: "",
     personalSite: null,
   },
   programs: ["바이브코딩 입문"],
 },
 {
   id: "ins-3",
   name: "김학태",
   title: "데이터 분석 전문가",
   organization: "AISH",
   profileImageUrl: "/images/placeholder-profile.jpg",
   specialties: ["데이터 분석", "시각화", "Python"],
   bio: "대규모 데이터 분석 프로젝트를 다수 수행한 경험을 바탕으로, 실무에서 바로 활용 가능한 데이터 분석 기법을 교육합니다.",
   socialLinks: {
     linkedin: "",
     youtube: null,
     instagram: null,
     github: null,
     personalSite: null,
   },
   programs: ["데이터분석 실무"],
 },
 {
   id: "ins-4",
   name: "이서연",
   title: "AI 비즈니스 컨설턴트",
   organization: "AISH",
   profileImageUrl: "/images/placeholder-profile.jpg",
   specialties: ["AI 비즈니스", "디지털 전환", "자동화"],
   bio: "기업의 AI 도입 전략 수립과 실행을 돕는 전문가. 비즈니스 관점에서 AI 활용법을 알려드립니다.",
   socialLinks: {
     linkedin: "",
     youtube: null,
     instagram: "",
     github: null,
     personalSite: null,
   },
   programs: ["AI 비즈니스 활용"],
 },
 {
   id: "ins-5",
   name: "박준혁",
   title: "머신러닝 엔지니어",
   organization: "AISH",
   profileImageUrl: "/images/placeholder-profile.jpg",
   specialties: ["머신러닝", "딥러닝", "MLOps"],
   bio: "실전 머신러닝 프로젝트 경험을 기반으로, 이론과 실습을 균형 있게 전달하는 것을 목표로 합니다.",
   socialLinks: {
     linkedin: "",
     youtube: "",
     instagram: null,
     github: "",
     personalSite: null,
   },
   programs: ["머신러닝 심화과정"],
 },
];

export const DEMO_PROGRAMS = [
 {
   id: "prog-1",
   title: "AI 기초 정규과정 11기",
   category: "REGULAR_FREE",
   status: "PRO",
   cohort: "11기",
   summary: "AI의 기본 개념부터 실무 활용까지, 12주간 체계적으로 학습하는 무료 정규 과정입니다.",
   schedule: "매주 화요일 19:00-21:00",
   startDate: "2026-03-01",
   endDate: "2026-06-30",
   instructors: ["김상용"],
   thumbnailUrl: "/images/placeholder-program.jpg",
   ctaText: "무료 과정 신청",
   ctaLink: "/about",
 },
 {
   id: "prog-2",
   title: "데이터분석 실무",
   category: "REGULAR_PAID",
   status: "PRO",
   cohort: "3기",
   summary: "Python과 주요 라이브러리를 활용한 실무 데이터 분석 과정입니다.",
   schedule: "매주 목요일 19:00-21:00",
   startDate: "2026-03-15",
   endDate: "2026-06-15",
   instructors: ["김학태"],
   thumbnailUrl: "/images/placeholder-program.jpg",
   ctaText: "유료 과정 안내",
   ctaLink: "/community",
 },
 {
   id: "prog-3",
   title: "바이브코딩 입문",
   category: "ONLINE_PAID",
   status: "SOON",
   cohort: "1기",
   summary: "코드로 예술 작품을 만드는 바이브 코딩의 세계에 입문하세요.",
   schedule: "매주 수요일 20:00-22:00",
   startDate: "2026-04-01",
   endDate: "2026-06-30",
   instructors: ["제갈정"],
   thumbnailUrl: "/images/placeholder-program.jpg",
   ctaText: "오픈 알림 받기",
   ctaLink: "/community",
 },
 {
   id: "prog-4",
   title: "AI 정부과제 스마트시티",
   category: "GOVERNMENT",
   status: "GOV",
   cohort: "",
   summary: "과학기술정보통신부 연계 AI 스마트시티 교육 프로그램입니다.",
   schedule: "별도 공지",
   startDate: "2026-05-01",
   endDate: "2026-12-31",
   instructors: ["김상용", "박준혁"],
   thumbnailUrl: "/images/placeholder-program.jpg",
   ctaText: "과제 상세 보기",
   ctaLink: "/about",
 },
 {
   id: "prog-5",
   title: "AI 기초 정규과정 10기",
   category: "REGULAR_FREE",
   status: "CLOSED",
   cohort: "10기",
   summary: "10기 정규 무료 과정은 성공적으로 종료되었습니다.",
   schedule: "매주 화요일 19:00-21:00",
   startDate: "2025-09-01",
   endDate: "2025-12-15",
   instructors: ["김상용"],
   thumbnailUrl: "/images/placeholder-program.jpg",
 },
];

export const DEMO_REVIEWS = [
 {
   authorName: "김○○",
   authorCohort: "10기 수강생",
   content: "AI가 막연히 어렵게만 느껴졌는데, AISH 과정을 통해 자신감을 얻었습니다. 특히 실습 위주의 커리큘럼이 큰 도움이 되었어요.",
   rating: 5,
   programTitle: "AI 기초 정규과정 10기",
 },
 {
   authorName: "이○○",
   authorCohort: "9기 수강생",
   content: "강사님들의 열정이 대단합니다. 질문에 항상 친절하게 답변해 주셔서 초보자도 따라갈 수 있었습니다.",
   rating: 5,
   programTitle: "AI 기초 정규과정 9기",
 },
 {
   authorName: "박○○",
   authorCohort: "데이터분석 2기",
   content: "실무에서 바로 쓸 수 있는 기술을 배웠습니다. 과정 수료 후 업무 효율이 확실히 올라갔어요.",
   rating: 4,
   programTitle: "데이터분석 실무 2기",
 },
 {
   authorName: "최○○",
   authorCohort: "10기 수강생",
   content: "무료 과정인데도 이렇게 퀄리티가 높다니 놀랍습니다. 주변에도 많이 추천하고 있어요!",
   rating: 5,
   programTitle: "AI 기초 정규과정 10기",
 },
];

export const DEMO_WORKATHON = {
 title: "제4회 스마트워크톤",
 edition: 4,
 eventDate: "2026-07-07",
 venue: "서울 강남구 테헤란로",
 status: "REGISTRATION_OPEN",
 description:
   "AI와 업무 자동화를 주제로 한 실무 해커톤! 24시간 동안 팀을 이루어 실제 업무 문제를 AI로 해결하는 경험을 하세요.",
 maxParticipants: 50,
 currentParticipantCount: 32,
 schedule: [
   { time: "09:00 - 09:30", title: "개회식 및 팀 빌딩", speaker: null },
   { time: "09:30 - 10:30", title: "AI 도구 활용 특강", speaker: "김상용" },
   { time: "10:30 - 18:00", title: "해커톤 진행", speaker: null },
   { time: "18:00 - 19:00", title: "발표 및 심사", speaker: null },
   { time: "19:00 - 19:30", title: "시상식 및 네트워킹", speaker: null },
 ],
};

export const DEMO_FAQ = [
 {
   question: "AISH 교육은 누구나 참여할 수 있나요?",
   answer:
     "네! 정규 무료 과정은 AI에 관심 있는 누구나 참여 가능합니다. 별도의 사전 지식이나 자격 요건은 없습니다.",
   category: "GENERAL",
 },
 {
   question: "수강 신청은 어떻게 하나요?",
   answer:
     "웹사이트 상단 또는 하단의 '수강 신청하기' 버튼을 클릭하면 Runmoa 플랫폼으로 이동합니다. 해당 플랫폼에서 원하시는 과정을 선택하여 신청하실 수 있습니다.",
   category: "ENROLLMENT",
 },
 {
   question: "수료증은 어떻게 발급받나요?",
   answer:
     "전체 과정의 80% 이상 출석하신 수강생에게 수료증을 발급합니다. 수료 요건 충족 시 커뮤니티 > 수료증 발급 메뉴에서 확인하실 수 있습니다.",
   category: "CERTIFICATE",
 },
 {
   question: "스마트워크톤은 무엇인가요?",
   answer:
     "스마트워크톤은 AISH가 주최하는 AI 활용 해커톤입니다. 참가자들이 팀을 이루어 실무 문제를 AI로 해결하며, 우수 팀에게는 상금과 함께 실무 프로젝트 참여 기회가 주어집니다.",
   category: "WORKATHON",
 },
];

export const DEMO_PARTNERS = [
 { name: "과학기술정보통신부", category: "GOVERNMENT" },
 { name: "한국정보화진흥원", category: "GOVERNMENT" },
 { name: "서울대학교 AI연구원", category: "UNIVERSITY" },
 { name: "KAIST", category: "UNIVERSITY" },
 { name: "삼성전자", category: "CORPORATE" },
 { name: "네이버", category: "CORPORATE" },
];

export const DEMO_QUICK_BANNERS: QuickBannerDemo[] = [
 {
   id: "qb-1",
   title: "AI 기초 정규과정 11기 모집중",
   description: "2026년 상반기 무료 정규과정에 지금 바로 참여하세요.",
   ctaText: "신청하기",
   ctaLink: "https://aish.runmoa.com/classes",
   ctaOpenNewTab: true,
   style: "PROMOTION",
   position: "TOP",
   backgroundColor: null,
   textColor: null,
   targetPages: ["/", "/programs"],
   isDismissible: true,
   isActive: true,
   startDate: "2026-03-01",
   endDate: "2026-04-30",
   displayOrder: 1,
 },
 {
   id: "qb-2",
   title: "제4회 스마트워크톤 D-112",
   description: "7월 7일 개최 예정! 참가 신청이 곧 마감됩니다.",
   ctaText: "자세히 보기",
   ctaLink: "/workathon",
   ctaOpenNewTab: false,
   style: "EVENT",
   position: "TOP",
   backgroundColor: "#7c3aed",
   textColor: "#ffffff",
   targetPages: ["/", "/about", "/community"],
   isDismissible: true,
   isActive: true,
   startDate: "2026-03-01",
   endDate: "2026-07-07",
   displayOrder: 2,
 },
 {
   id: "qb-3",
   title: "3월 정기 점검 안내",
   description: "3월 20일(목) 02:00~06:00 시스템 점검이 예정되어 있습니다.",
   ctaText: "",
   ctaLink: "",
   ctaOpenNewTab: false,
   style: "WARNING",
   position: "TOP",
   backgroundColor: null,
   textColor: null,
   targetPages: ["/", "/programs", "/community", "/videos", "/instructors", "/workathon", "/about"],
   isDismissible: true,
   isActive: false,
   startDate: "2026-03-19",
   endDate: "2026-03-20",
   displayOrder: 3,
 },
];

export const DEMO_HERO_SLIDES = [
  {
    imageUrl: "/images/defaults/hero-main.jpg",
    title: "미래를 선도하는\nAI 교육 플랫폼",
    subtitle: "체계적인 교육과 실무 중심 연구로 당신의 AI 역량을 한 단계 끌어올립니다.",
    ctaText: "수강 신청하기",
    ctaLink: "https://aish.runmoa.com/classes",
    isActive: true,
    displayOrder: 1,
  },
  {
    imageUrl: "/images/defaults/hero-main.jpg",
    title: "AI 시대,\n당신의 성장 파트너",
    subtitle: "무료 정규 과정부터 실무 프로젝트까지, AISH가 함께합니다.",
    ctaText: "교육 과정 보기",
    ctaLink: "/programs",
    isActive: true,
    displayOrder: 2,
  },
  {
    imageUrl: "/images/defaults/workathon-bg.jpg",
    title: "제4회 스마트워크톤\n참가자 모집",
    subtitle: "AI와 업무 자동화를 주제로 한 실무 해커톤에 참여하세요.",
    ctaText: "참가 신청하기",
    ctaLink: "/workathon",
    isActive: true,
    displayOrder: 3,
  },
];

export const DEMO_EDUCATION_IMAGES = {
  "AI 기초": "/images/defaults/edu-ai.jpg",
  "데이터 분석": "/images/defaults/edu-data.jpg",
  "바이브 코딩": "/images/defaults/edu-vibe.jpg",
  "정부과제": "/images/defaults/edu-cloud.jpg",
  "스마트워크": "/images/defaults/edu-smart.jpg",
};

export const DEMO_SPECIALTY_IMAGES = {
  "SYSTEM": "/images/defaults/spec-system.jpg",
  "PRACTICE": "/images/defaults/spec-practice.jpg",
  "COMMUNITY": "/images/defaults/spec-community.jpg",
};

export const DEMO_HISTORY = [
 { year: 2024, month: 3, title: "AISH 설립", category: "FOUNDATION" },
 { year: 2024, month: 5, title: "제1회 스마트워크톤 개최", category: "WORKATHON" },
 { year: 2024, month: 9, title: "정규 교육과정 1기 시작", category: "EDUCATION" },
 { year: 2025, month: 1, title: "과학기술정보통신부 협력 체결", category: "PARTNERSHIP" },
 { year: 2025, month: 6, title: "제2회 스마트워크톤 개최 (참가자 100명)", category: "WORKATHON" },
 { year: 2025, month: 9, title: "누적 수강생 1,000명 돌파", category: "EDUCATION" },
 { year: 2025, month: 12, title: "제3회 스마트워크톤 개최", category: "WORKATHON" },
 { year: 2026, month: 1, title: "정부과제 3건 선정", category: "PARTNERSHIP" },
 { year: 2026, month: 3, title: "AI 기초 정규과정 11기 시작", category: "EDUCATION" },
];
