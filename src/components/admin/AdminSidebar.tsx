"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
 LayoutDashboard, Settings, BookOpen, Users, FileText, Video,
 Star, Trophy, HelpCircle, Mail, ImageIcon, Handshake, Clock,
 Award, Shield, ChevronDown, ChevronRight, X,
 Megaphone, Calendar, FolderOpen, LayoutTemplate, Layers, LayoutGrid,
 Archive, Sparkles, TrendingUp, Bug,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";

const ICON_MAP: Record<string, React.ElementType> = {
 LayoutDashboard, Settings, BookOpen, Users, FileText, Video,
 Star, Trophy, HelpCircle, Mail, Image: ImageIcon, Handshake, Clock,
 Award, Shield, Megaphone, Calendar, FolderOpen, LayoutTemplate, Layers, LayoutGrid,
 Archive, Sparkles, TrendingUp, Bug,
};

interface NavChild {
 label: string;
 href: string;
}

interface NavItem {
 label: string;
 href: string;
 icon: string;
 children?: NavChild[];
}

interface NavGroup {
 title: string;
 items: NavItem[];
 collapsible?: boolean;
 defaultOpen?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
 {
   title: "",
   items: [
     { label: "대시보드", href: "/admin", icon: "LayoutDashboard" },
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
        { label: "섹션 표시", href: "/admin/settings?tab=sections" },
        { label: "히어로 섹션", href: "/admin/settings?tab=hero" },
        { label: "실적 수치", href: "/admin/settings?tab=stats" },
        { label: "CTA 설정", href: "/admin/settings?tab=cta" },
        { label: "배너 관리", href: "/admin/settings?tab=banner" },
        { label: "기능 플래그 (Phase)", href: "/admin/settings?tab=phases" },
      ],
     },
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

function SidebarItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
 const pathname = usePathname();
 const [isOpen, setIsOpen] = useState(false);
 const Icon = ICON_MAP[item.icon] || LayoutDashboard;
 const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

 if (item.children) {
   return (
     <div>
       <button
         onClick={() => setIsOpen(!isOpen)}
         className={cn(
           "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
           isActive ? "text-primary-700 bg-primary-50" : "text-gray-600 hover:bg-gray-50"
         )}
       >
         <Icon size={18} />
         <span className="flex-1 text-left">{item.label}</span>
         {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
       </button>
       {isOpen && (
         <div className="ml-8 mt-1 space-y-0.5">
           {item.children.map((child) => (
             <Link
               key={child.href}
               href={child.href}
               onClick={onNavigate}
               className={cn(
                 "block px-3 py-2 rounded-lg text-sm transition-colors",
                 pathname === child.href
                   ? "text-primary-600 font-medium bg-primary-50/50"
                   : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
               )}
             >
               {child.label}
             </Link>
           ))}
         </div>
       )}
     </div>
   );
 }

 return (
   <Link
     href={item.href}
     onClick={onNavigate}
     className={cn(
       "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
       isActive ? "text-primary-700 bg-primary-50" : "text-gray-600 hover:bg-gray-50"
     )}
   >
     <Icon size={18} />
     <span>{item.label}</span>
   </Link>
 );
}

function SidebarGroup({ group, onNavigate }: { group: NavGroup; onNavigate?: () => void }) {
 const pathname = usePathname();
 const hasActiveChild = group.items.some(
   (item) => pathname === item.href || pathname.startsWith(item.href + "/")
 );
 const [isOpen, setIsOpen] = useState(group.defaultOpen ?? !group.collapsible);

 const showHeader = group.title.length > 0;

 return (
   <div>
     {showHeader && (
       group.collapsible ? (
         <button
           onClick={() => setIsOpen(!isOpen)}
           className={cn(
             "w-full flex items-center gap-2 px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
             hasActiveChild ? "text-primary-600" : "text-gray-400 hover:text-gray-500"
           )}
         >
           <Archive size={12} />
           <span className="flex-1 text-left">{group.title}</span>
           {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
         </button>
       ) : (
         <div className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
           {group.title}
         </div>
       )
     )}
     {(!group.collapsible || isOpen) && (
       <div className="space-y-0.5">
         {group.items.map((item) => (
           <SidebarItem key={item.href} item={item} onNavigate={onNavigate} />
         ))}
       </div>
     )}
   </div>
 );
}

interface AdminSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ mobileOpen, onClose }: AdminSidebarProps) {
 const { profile } = useAuth();
 const pathname = usePathname();

 // 경로 변경 시 모바일 사이드바 자동 닫기
 useEffect(() => {
   onClose();
 }, [pathname, onClose]);

 const sidebarContent = (
   <>
     <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 shrink-0">
       <Link href="/admin" className="flex items-center gap-2">
         <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center">
           <span className="text-white font-bold text-xs">AI</span>
         </div>
         <span className="font-bold text-gray-900">{SITE_NAME} Admin</span>
       </Link>
       <button
         onClick={onClose}
         className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 lg:hidden"
       >
         <X size={18} />
       </button>
     </div>

     <nav className="flex-1 overflow-y-auto p-3 space-y-4">
       {NAV_GROUPS.map((group) => (
         <SidebarGroup key={group.title || "_top"} group={group} onNavigate={onClose} />
       ))}
     </nav>

     {profile && (
       <div className="p-4 border-t border-gray-100 shrink-0">
         <div className="flex items-center gap-3">
           {profile.photoURL ? (
             <img src={profile.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
           ) : (
             <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
               <span className="text-primary-700 text-xs font-bold">{(profile.displayName || profile.email)[0]}</span>
             </div>
           )}
           <div className="flex-1 min-w-0">
             <p className="text-sm font-medium text-gray-900 truncate">{profile.displayName || "관리자"}</p>
             <p className="text-xs text-gray-500 truncate">{profile.email}</p>
           </div>
         </div>
       </div>
     )}
   </>
 );

 return (
   <>
     {/* 데스크톱 사이드바 */}
     <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-200 flex-col z-30">
       {sidebarContent}
     </aside>

     {/* 모바일 오버레이 */}
     {mobileOpen && (
       <div
         className="fixed inset-0 bg-black/40 z-40 lg:hidden"
         onClick={onClose}
       />
     )}

     {/* 모바일 드로어 */}
     <aside
       className={cn(
         "fixed top-0 left-0 h-screen w-72 bg-white border-r border-gray-200 flex flex-col z-50 lg:hidden transition-transform duration-300",
         mobileOpen ? "translate-x-0" : "-translate-x-full"
       )}
     >
       {sidebarContent}
     </aside>
   </>
 );
}
