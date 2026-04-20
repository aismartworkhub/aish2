/**
 * 도움말 텍스트 — 각 기능/메뉴별 설명.
 * key는 고유 ID. 추후 Firestore로 이관 가능.
 */
export const HELP_TEXTS: Record<string, string> = {
  // ── 관리자: 사이트 설정 ──
  "admin.settings.hero": "히어로 섹션은 홈페이지 최상단 슬라이드 배너입니다. 이미지 URL, 제목, CTA 버튼을 설정할 수 있습니다.",
  "admin.settings.stats": "실적 수치는 홈페이지에 표시되는 핵심 성과 지표(교육생 수, 프로그램 수 등)입니다.",
  "admin.settings.cta": "CTA(Call to Action) 버튼의 텍스트와 연결 URL을 설정합니다. 모든 페이지에 적용됩니다.",
  "admin.settings.banner": "상단 배너는 D-Day 카운트다운과 함께 긴급 공지를 표시합니다.",
  "admin.settings.theme": "공개 홈페이지에 적용할 디자인 테마를 선택합니다.",
  "admin.settings.features": "각 개선 단계(Phase)를 ON/OFF하여 사이트 기능을 점진적으로 활성화합니다.",
  "admin.settings.ai": "YouTube·GitHub 등에서 AI 관련 콘텐츠를 자동 수집하고 Gemini로 품질을 평가합니다.",

  // ── 관리자: 콘텐츠 관리 ──
  "admin.contents": "통합 콘텐츠 관리자입니다. 미디어, 강좌, 블로그 등 모든 콘텐츠를 한곳에서 관리합니다.",
  "admin.boards": "게시판 유형을 생성·수정합니다. 커뮤니티와 미디어에서 사용됩니다.",
  "admin.resources": "파일·자료를 업로드하고 회원에게 공유합니다.",

  // ── 관리자: 교육 운영 ──
  "admin.programs": "AI 교육 프로그램(과정)을 등록·수정합니다. 홈페이지와 프로그램 목록에 표시됩니다.",
  "admin.instructors": "강사 프로필을 관리합니다. 이름, 소속, 전문 분야 등을 설정합니다.",
  "admin.certificates": "수료증 발급을 위한 기수·수료생 데이터를 관리합니다.",
  "admin.workathon": "스마트 워크톤 행사 정보를 등록하고 참가 현황을 관리합니다.",

  // ── 관리자: 사용자 관리 ──
  "admin.users": "가입 회원 목록을 조회하고 역할(관리자/회원)을 변경합니다.",
  "admin.admins": "관리자 권한이 있는 사용자를 관리합니다.",

  // ── 공개 페이지 ──
  "public.media": "AI 관련 영상·자료·아티클을 탐색합니다. 출처별로 필터링할 수 있습니다.",
  "public.community": "회원 간 자유 토론, 공지사항, FAQ를 확인하는 커뮤니티입니다.",
  "public.programs": "진행 중인 AI 교육 프로그램 목록과 상세 정보를 확인합니다.",
  "public.instructors": "AISH 소속 강사진의 프로필과 전문 분야를 확인합니다.",
  "public.workathon": "스마트 워크톤 행사 일정과 참가 안내입니다.",
  "public.about": "AISH(AI Smart Hub) 소개와 연혁, 협력 기관 정보입니다.",

  // ── 프로필·AI 기능 ──
  "profile.geminiKey": "Google Gemini API 키를 입력하면 명함 분석, AI 상담 등 개인화된 AI 기능을 사용할 수 있습니다. 키는 본인만 볼 수 있습니다.",
  "profile.businessCard": "명함 사진을 업로드하면 AI가 이름, 직함, 회사 정보를 자동으로 인식합니다.",
  "profile.companyIntro": "소속 회사(기관)에 대한 간단한 소개를 작성합니다. 네트워킹에 도움이 됩니다.",

  // ── Feature Phases ──
  "feature.phase1": "기본 UX 개선: 샘플 배지 표시, 콘텐츠 공유 URL, 로딩 스켈레톤으로 사이트의 신뢰도와 사용성을 높입니다.",
  "feature.phase2": "Google Apps Script 연동: 가입 환영 이메일 발송, 명함 이미지 Google Drive 자동 저장 등 외부 서비스를 연결합니다.",
  "feature.phase3": "프로필 강화: Gemini API 키를 활용한 명함 AI 분석, 직책·회사소개 등 확장 프로필을 추가합니다.",
  "feature.phase4": "알림·커뮤니티 강화: 실시간 알림 시스템, 인기글 섹션, 콘텐츠 공유 기능을 추가합니다.",
  "feature.phase5": "AI 상담사: 사이트의 모든 정보를 학습한 AI 챗봇이 실시간으로 사용자 질문에 답변합니다.",
};
