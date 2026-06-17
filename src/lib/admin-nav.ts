/**
 * 관리자 사이드바 내비게이션 정의 — AdminSidebar 렌더 + AI 도우미 메뉴 지식 공용.
 * 메뉴를 여기서 한 번만 정의하면 사이드바와 AI 도우미가 동시에 자동 반영된다.
 */
export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  children?: NavChild[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "",
    items: [
      { label: "대시보드", href: "/admin", icon: "LayoutDashboard" },
      { label: "AI 도우미", href: "/admin/ai-assistant", icon: "Sparkles" },
      { label: "도움말", href: "/admin/help", icon: "HelpCircle" },
    ],
  },
  {
    title: "콘텐츠 관리",
    items: [
      { label: "통합 콘텐츠", href: "/admin/contents", icon: "Layers" },
      { label: "AI 콘텐츠", href: "/admin/ai-content", icon: "Sparkles" },
      { label: "Google 트렌드", href: "/admin/trends", icon: "TrendingUp" },
      { label: "게시판 설정", href: "/admin/boards", icon: "LayoutGrid" },
      { label: "교육자료", href: "/admin/contents?boardKey=media-resource", icon: "FolderOpen" },
    ],
  },
  {
    title: "교육 운영",
    items: [
      { label: "프로그램 관리", href: "/admin/programs", icon: "BookOpen" },
      { label: "강사 관리", href: "/admin/instructors", icon: "Users" },
      { label: "수료증", href: "/admin/certificates", icon: "Award" },
      { label: "스마트워크톤", href: "/admin/workathon", icon: "Trophy" },
      { label: "일반 행사", href: "/admin/event", icon: "Calendar" },
    ],
  },
  {
    title: "커뮤니티",
    items: [
      { label: "문의 관리", href: "/admin/inquiries", icon: "Mail" },
      { label: "사용자 신고", href: "/admin/feedback", icon: "Bug" },
    ],
  },
  {
    title: "사이트 관리",
    items: [
      {
        label: "사이트 설정", href: "/admin/settings", icon: "Settings",
        children: [
          { label: "AI 수집", href: "/admin/settings?tab=ai" },
          { label: "AI 지식", href: "/admin/settings?tab=knowledge" },
          { label: "섹션 표시", href: "/admin/settings?tab=sections" },
          { label: "히어로 섹션", href: "/admin/settings?tab=hero" },
          { label: "실적 수치", href: "/admin/settings?tab=stats" },
          { label: "CTA 설정", href: "/admin/settings?tab=cta" },
          { label: "배너 관리", href: "/admin/settings?tab=banner" },
          { label: "사업자 정보", href: "/admin/settings?tab=business" },
          { label: "기능 플래그 (Phase)", href: "/admin/settings?tab=phases" },
        ],
      },
      { label: "메인 페이지 편집", href: "/admin/home-layout", icon: "LayoutGrid" },
      { label: "퀵배너 관리", href: "/admin/banners", icon: "Megaphone" },
      { label: "페이지 관리", href: "/admin/pages", icon: "LayoutTemplate" },
      { label: "파트너", href: "/admin/partners", icon: "Handshake" },
      { label: "연혁", href: "/admin/history", icon: "Clock" },
    ],
  },
  {
    title: "사용자 관리",
    items: [
      { label: "관리자", href: "/admin/admins", icon: "Shield" },
      { label: "회원관리", href: "/admin/users", icon: "Users" },
    ],
  },
  {
    title: "레거시 (통합 예정)",
    collapsible: true,
    defaultOpen: false,
    items: [
      {
        label: "게시판 (구)", href: "/admin/posts", icon: "FileText",
        children: [
          { label: "공지사항", href: "/admin/posts?type=NOTICE" },
        ],
      },
      { label: "영상 관리 (구)", href: "/admin/videos", icon: "Video" },
      { label: "후기 관리 (구)", href: "/admin/reviews", icon: "Star" },
      { label: "FAQ (구)", href: "/admin/faq", icon: "HelpCircle" },
      { label: "갤러리 (구)", href: "/admin/gallery", icon: "Image" },
    ],
  },
];
