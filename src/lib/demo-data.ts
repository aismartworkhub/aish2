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
 { label: "AI실전마스터", value: 5, unit: "인", icon: "UserCheck" },
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
   experience: [
     { period: "2020 - 현재", description: "AI 교육 총괄 디렉터, AISH" },
     { period: "2015 - 2020", description: "AI 연구원, 삼성전자 AI센터" },
   ],
   education: [
     { degree: "컴퓨터공학 박사", institution: "KAIST", year: "2015" },
     { degree: "컴퓨터과학 학사", institution: "서울대학교", year: "2010" },
   ],
   certifications: ["Google Cloud ML Engineer", "AWS Solutions Architect"],
   contactEmail: "",
   isActive: true,
   displayOrder: 0,
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
   experience: [{ period: "2018 - 현재", description: "바이브 코딩 강사, AISH" }],
   education: [{ degree: "소프트웨어공학 석사", institution: "연세대학교", year: "2018" }],
   certifications: [], contactEmail: "", isActive: true, displayOrder: 1,
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
   experience: [{ period: "2016 - 현재", description: "데이터 분석 전문가, AISH" }],
   education: [{ degree: "통계학 석사", institution: "고려대학교", year: "2016" }],
   certifications: [], contactEmail: "", isActive: true, displayOrder: 2,
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
   experience: [], education: [], certifications: [], contactEmail: "", isActive: true, displayOrder: 3,
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
   experience: [{ period: "2019 - 현재", description: "머신러닝 엔지니어, AISH" }],
   education: [{ degree: "인공지능 석사", institution: "포항공과대학교", year: "2019" }],
   certifications: ["TensorFlow Developer Certificate"], contactEmail: "", isActive: true, displayOrder: 4,
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

// ─── 성공사례 (데모 폴백) ───────────────────────────────────────────────
export const DEMO_SUCCESS_CASES = [
  {
    id: "sc-1",
    companyName: "그린테크 물류",
    companyLogoUrl: "",
    industry: "물류/유통",
    title: "AI 수요예측으로 재고 비용 38% 절감",
    summary: "생성형 AI와 수요예측 모델로 재고·배차를 자동 최적화해 운영비를 크게 줄였습니다.",
    thumbnailUrl: "/images/defaults/edu-data.jpg",
    consultants: [
      { id: "ins-3", name: "김학태", title: "데이터 분석 전문가", imageUrl: "/images/placeholder-profile.jpg" },
    ],
    situation: "주문·재고·배차 데이터가 엑셀과 담당자 머릿속에 흩어져 있었고, 성수기마다 재고 과잉과 결품이 반복됐습니다. 배차 계획은 매일 사람이 수기로 세워 오류와 야근이 잦았습니다.",
    diagnosis: "과거 3년 주문 데이터를 분석하니 뚜렷한 계절성·요일별 수요 패턴이 확인됐습니다. 예측 모델로 수요를 미리 잡고, 배차는 규칙 기반 + 생성형 AI 초안화로 자동화하는 것이 적합하다고 진단했습니다.",
    challenge: "성수기 재고 과잉과 결품이 반복되고, 배차 계획을 사람이 수기로 세워 오류와 야근이 잦았습니다.",
    solution: "과거 3년 주문 데이터를 학습한 수요예측 모델을 도입하고, 생성형 AI로 일일 배차 계획 초안을 자동 생성했습니다.",
    result: "재고 회전율이 개선되고 배차 담당자의 반복 업무가 사라져, 팀이 고부가 업무에 집중하게 됐습니다.",
    prompts: [
      { title: "자동화 기초 공장", content: "재고·배차 등 반복 업무를 AI로 자동화하는 기초 도구", url: "https://ai-showroom-xi.vercel.app/#/factories/automation-basics" },
      { title: "브리핑 메이커", content: "예측 수요·재고 현황으로 일일 배차 브리핑을 자동 작성", url: "https://ai-showroom-xi.vercel.app/#/factories/briefing-maker" },
    ],
    metrics: [
      { label: "재고 비용", value: "-38%" },
      { label: "배차 계획 시간", value: "-70%" },
      { label: "결품률", value: "-52%" },
    ],
    tags: ["수요예측", "생성형AI", "업무자동화"],
    testimonial: "사람이 며칠 걸리던 일을 AI가 몇 분 만에 초안으로 만들어 줍니다. 이제 검토와 판단에만 집중합니다.",
    testimonialAuthor: "물류운영팀 김OO 팀장",
    ctaText: "도입 문의",
    ctaLink: "/community",
    order: 1,
    hidden: false,
    createdAt: "2026-05-01",
  },
  {
    id: "sc-2",
    companyName: "브라이트 커머스",
    companyLogoUrl: "",
    industry: "이커머스",
    title: "AI 상담봇으로 고객응대 70% 자동화",
    summary: "문의 데이터를 학습한 AI 상담봇이 반복 문의를 처리하고, 상담사는 복잡한 케이스에 집중합니다.",
    thumbnailUrl: "/images/defaults/edu-smart.jpg",
    consultants: [
      { id: "ins-1", name: "김상용", title: "AI 교육 총괄 디렉터", imageUrl: "/images/placeholder-profile.jpg" },
    ],
    situation: "프로모션 시즌마다 문의량이 폭증해 응대가 지연되고 고객 이탈이 늘었습니다. FAQ와 주문 데이터가 분산돼 상담사가 매번 여러 시스템을 오갔습니다.",
    diagnosis: "문의를 유형별로 분석하니 약 70%가 반복 FAQ(배송·교환·주문조회)로 커버 가능했습니다. FAQ·주문 데이터를 연결한 RAG 챗봇으로 1차 응대를 자동화하고, 미해결 건만 상담사에게 이관하는 구조가 적합하다고 진단했습니다.",
    challenge: "문의량 급증으로 응대 지연과 고객 이탈이 늘고, 상담사 채용·교육 비용이 부담이었습니다.",
    solution: "자사 FAQ·주문 데이터를 연결한 RAG 기반 상담봇을 구축하고, 미해결 건만 상담사에게 자동 이관했습니다.",
    result: "1차 응대의 대부분을 AI가 처리해 평균 응답 시간이 크게 단축되고 고객 만족도가 올랐습니다.",
    prompts: [
      { title: "자동화 기초 공장", content: "반복 고객 문의 응대를 AI로 자동화하는 기초 도구", url: "https://ai-showroom-xi.vercel.app/#/factories/automation-basics" },
      { title: "옵시디언 공장", content: "흩어진 FAQ·상담 지식을 챗봇 지식베이스로 구조화·정리", url: "https://ai-showroom-xi.vercel.app/#/factories/obsidian" },
    ],
    metrics: [
      { label: "문의 자동응대", value: "70%" },
      { label: "평균 응답시간", value: "-65%" },
      { label: "CS 만족도", value: "+18%p" },
    ],
    tags: ["RAG", "챗봇", "고객경험"],
    testimonial: "야간·주말 문의까지 AI가 즉시 응대하니 고객 불만이 눈에 띄게 줄었습니다.",
    testimonialAuthor: "CX팀 이OO 매니저",
    ctaText: "도입 문의",
    ctaLink: "/community",
    order: 2,
    hidden: false,
    createdAt: "2026-04-10",
  },
  {
    id: "sc-3",
    companyName: "한빛 제조",
    companyLogoUrl: "",
    industry: "제조",
    title: "AI 비전 검사로 불량 검출률 3배 향상",
    summary: "생산 라인에 AI 영상 검사를 도입해 육안 검사의 한계를 넘고 품질 대응 속도를 높였습니다.",
    thumbnailUrl: "/images/defaults/edu-ai.jpg",
    consultants: [
      { id: "ins-1", name: "김상용", title: "AI 교육 총괄 디렉터", imageUrl: "/images/placeholder-profile.jpg" },
      { id: "ins-3", name: "김학태", title: "데이터 분석 전문가", imageUrl: "/images/placeholder-profile.jpg" },
    ],
    situation: "품질 검사를 작업자 육안에 의존해 미세 불량을 놓치는 경우가 많았고, 반복 검사로 인력 피로도와 클레임이 높았습니다.",
    diagnosis: "불량 유형이 표면 스크래치·이물·변형 등 영상 패턴으로 명확히 구분 가능함을 확인했습니다. 라인 카메라 영상에 컴퓨터비전 검사 모델을 적용하고, 이상 발생 시 실시간 대시보드로 알림하는 방식이 적합하다고 진단했습니다.",
    challenge: "육안 검사에 의존해 미세 불량을 놓치는 경우가 많고, 검사 인력의 피로도가 높았습니다.",
    solution: "라인 카메라 영상에 AI 비전 검사 모델을 적용하고, 이상 패턴을 실시간 대시보드로 알림 처리했습니다.",
    result: "미세 불량까지 자동으로 잡아내며 재작업·클레임이 감소하고, 검사 인력은 설비 관리로 재배치됐습니다.",
    prompts: [
      { title: "바이브코딩 기초 공장", content: "비전 검사 등 현장용 AI 도구를 직접 만들어보는 코딩 기초", url: "https://ai-showroom-xi.vercel.app/#/factories/vibecoding" },
      { title: "브리핑 메이커", content: "일일 검사 결과로 불량률·추세 품질 리포트를 자동 작성", url: "https://ai-showroom-xi.vercel.app/#/factories/briefing-maker" },
    ],
    metrics: [
      { label: "불량 검출률", value: "3배" },
      { label: "클레임", value: "-44%" },
      { label: "검사 소요", value: "-60%" },
    ],
    tags: ["컴퓨터비전", "품질검사", "스마트팩토리"],
    testimonial: "사람 눈으로 놓치던 불량을 AI가 잡아냅니다. 품질 신뢰도가 확실히 올라갔어요.",
    testimonialAuthor: "품질보증팀 박OO 책임",
    ctaText: "도입 문의",
    ctaLink: "/community",
    order: 3,
    hidden: false,
    createdAt: "2026-03-20",
  },
];
