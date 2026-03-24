export const SITE_NAME = "AISH";
export const SITE_FULL_NAME = "AI Smart Hub";
export const SITE_DESCRIPTION = "미래를 선도하는 교육 플랫폼 AISH - 체계적인 교육(SYSTEM)과 실무 중심 연구(PRACTICE)";
export const SITE_DOMAIN = "aish.co.kr";

export const CTA_URL = "https://aish.runmoa.com/classes";
export const CTA_TEXT = "교육과정 보기";

export const NAV_ITEMS = [
 { label: "홈", href: "/" },
 { label: "소개", href: "/about" },
 { label: "교육 프로그램", href: "/programs" },
 { label: "강사진", href: "/instructors" },
 { label: "스마트워크톤", href: "/workathon" },
 { label: "영상·콘텐츠", href: "/videos" },
 { label: "커뮤니티", href: "/community" },
] as const;

export const ADMIN_NAV_ITEMS = [
 { label: "대시보드", href: "/admin", icon: "LayoutDashboard" },
 {
   label: "사이트 설정",
   href: "/admin/settings",
   icon: "Settings",
   children: [
     { label: "히어로 섹션", href: "/admin/settings/hero" },
     { label: "실적 수치", href: "/admin/settings/stats" },
     { label: "CTA 설정", href: "/admin/settings/cta" },
     { label: "배너 관리", href: "/admin/settings/banner" },
   ],
 },
 {
   label: "교육 관리",
   href: "/admin/programs",
   icon: "BookOpen",
   children: [
     { label: "프로그램", href: "/admin/programs" },
     { label: "외부 링크", href: "/admin/programs/links" },
   ],
 },
 { label: "강사 관리", href: "/admin/instructors", icon: "Users" },
 {
   label: "게시판",
   href: "/admin/posts",
   icon: "FileText",
   children: [
     { label: "공지사항", href: "/admin/posts?type=NOTICE" },
     { label: "자료실", href: "/admin/posts?type=RESOURCE" },
   ],
 },
 { label: "영상 관리", href: "/admin/videos", icon: "Video" },
 { label: "후기 관리", href: "/admin/reviews", icon: "Star" },
 {
   label: "행사관리",
   href: "/admin/workathon",
   icon: "Trophy",
 },
 { label: "FAQ", href: "/admin/faq", icon: "HelpCircle" },
 { label: "문의 관리", href: "/admin/inquiries", icon: "Mail" },
 { label: "갤러리", href: "/admin/gallery", icon: "Image" },
 { label: "파트너", href: "/admin/partners", icon: "Handshake" },
 { label: "연혁", href: "/admin/history", icon: "Clock" },
 { label: "수료증", href: "/admin/certificates", icon: "Award" },
 { label: "관리자", href: "/admin/admins", icon: "Shield" },
 { label: "회원관리", href: "/admin/users", icon: "Users" },
] as const;

export const PROGRAM_CATEGORY_LABELS: Record<string, string> = {
 REGULAR_FREE: "정규 무료",
 REGULAR_PAID: "화요일 정회원 유료",
 ONLINE_PAID: "온라인 유료",
 OFFLINE_PAID: "오프라인 유료",
 GOVERNMENT: "정부과제 연계",
};

export const PROGRAM_STATUS_LABELS: Record<string, string> = {
 PRO: "진행중",
 FREE: "무료 개방",
 SOON: "오픈 예정",
 GOV: "정부과제",
 CLOSED: "종료",
};

export const PROGRAM_STATUS_COLORS: Record<string, string> = {
 PRO: "bg-green-100 text-green-800",
 FREE: "bg-blue-100 text-blue-800",
 SOON: "bg-yellow-100 text-yellow-800",
 GOV: "bg-purple-100 text-purple-800",
 CLOSED: "bg-gray-100 text-gray-800",
};

export const VIDEO_CATEGORY_LABELS: Record<string, string> = {
 LECTURE: "강의 영상",
 WORKATHON: "워크톤 현장",
 INTERVIEW: "강사 인터뷰",
 PROMO: "홍보 영상",
};

export const INQUIRY_STATUS_LABELS: Record<string, string> = {
 NEW: "신규",
 IN_PROGRESS: "처리중",
 RESOLVED: "해결",
 CLOSED: "종료",
};

export const TARGET_PAGE_OPTIONS = [
 { value: "/", label: "홈" },
 { value: "/about", label: "소개" },
 { value: "/programs", label: "교육 프로그램" },
 { value: "/instructors", label: "강사진" },
 { value: "/workathon", label: "스마트워크톤" },
 { value: "/videos", label: "영상/콘텐츠" },
 { value: "/community", label: "커뮤니티" },
] as const;

export const BANNER_STYLE_LABELS: Record<string, string> = {
 INFO: "안내",
 PROMOTION: "프로모션",
 WARNING: "주의",
 EVENT: "이벤트",
};

export const BANNER_POSITION_LABELS: Record<string, string> = {
 TOP: "페이지 상단",
 BOTTOM: "페이지 하단",
 MODAL: "팝업",
};

// ── 사용자 역할 체계 ──
export const SUPER_ADMIN_EMAIL = "aismartworkhub@gmail.com";

export type UserRole = "superadmin" | "admin" | "member" | "user" | "premium";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
 superadmin: "슈퍼관리자",
 admin: "권한위임자",
 member: "정회원",
 user: "일반 사용자",
 premium: "멤버십",
};

export const USER_ROLE_COLORS: Record<UserRole, string> = {
 superadmin: "bg-red-50 text-red-700",
 admin: "bg-blue-50 text-blue-700",
 member: "bg-green-50 text-green-700",
 user: "bg-gray-100 text-gray-600",
 premium: "bg-purple-50 text-purple-700",
};

/** 관리자 페이지 접근 가능 역할 */
export const ADMIN_ROLES: UserRole[] = ["superadmin", "admin"];

/** 기수 옵션 */
export const COHORT_OPTIONS = Array.from({ length: 20 }, (_, i) => `${i + 1}기`);
