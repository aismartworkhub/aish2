"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
 LayoutDashboard, Settings, BookOpen, Users, FileText, Video,
 Star, Trophy, HelpCircle, Mail, ImageIcon, Handshake, Clock,
 Award, Shield, ChevronDown, ChevronRight, X,
 Megaphone, Zap, FolderOpen,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";

const ICON_MAP: Record<string, React.ElementType> = {
 LayoutDashboard, Settings, BookOpen, Users, FileText, Video,
 Star, Trophy, HelpCircle, Mail, Image: ImageIcon, Handshake, Clock,
 Award, Shield, Megaphone, Zap, FolderOpen,
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

const NAV_ITEMS: NavItem[] = [
 { label: "대시보드", href: "/admin", icon: "LayoutDashboard" },
 {
   label: "사이트 설정", href: "/admin/settings", icon: "Settings",
   children: [
     { label: "히어로 섹션", href: "/admin/settings?tab=hero" },
     { label: "실적 수치", href: "/admin/settings?tab=stats" },
     { label: "CTA 설정", href: "/admin/settings?tab=cta" },
     { label: "배너 관리", href: "/admin/settings?tab=banner" },
   ],
 },
 { label: "퀵배너 관리", href: "/admin/banners", icon: "Megaphone" },
 { label: "프로그램 관리", href: "/admin/programs", icon: "BookOpen" },
 { label: "Event", href: "/admin/event", icon: "Zap" },
 { label: "강사 관리", href: "/admin/instructors", icon: "Users" },
 {
   label: "게시판", href: "/admin/posts", icon: "FileText",
   children: [
     { label: "공지사항", href: "/admin/posts?type=NOTICE" },
   ],
 },
 { label: "자료실", href: "/admin/resources", icon: "FolderOpen" },
 { label: "영상 관리", href: "/admin/videos", icon: "Video" },
 { label: "후기 관리", href: "/admin/reviews", icon: "Star" },
 {
   label: "행사관리", href: "/admin/workathon", icon: "Trophy",
 },
 { label: "FAQ", href: "/admin/faq", icon: "HelpCircle" },
 { label: "문의 관리", href: "/admin/inquiries", icon: "Mail" },
 { label: "갤러리", href: "/admin/gallery", icon: "Image" },
 { label: "파트너", href: "/admin/partners", icon: "Handshake" },
 { label: "연혁", href: "/admin/history", icon: "Clock" },
 { label: "수료증", href: "/admin/certificates", icon: "Award" },
 { label: "관리자", href: "/admin/admins", icon: "Shield" },
 { label: "회원관리", href: "/admin/users", icon: "Users" },
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

     <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
       {NAV_ITEMS.map((item) => (
         <SidebarItem key={item.href} item={item} onNavigate={onClose} />
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
