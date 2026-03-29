"use client";

import { Bell, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

interface AdminHeaderProps {
  onMenuToggle: () => void;
}

export default function AdminHeader({ onMenuToggle }: AdminHeaderProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <header className="h-14 lg:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 lg:hidden"
          aria-label="메뉴 열기"
        >
          <Menu size={20} />
        </button>
      </div>
      <div className="flex items-center gap-2 lg:gap-3">
        {user && (
          <span className="hidden md:inline text-sm text-gray-600 mr-1 lg:mr-2 max-w-[120px] truncate">
            {user.displayName || user.email}
          </span>
        )}
        <Link href="/admin/inquiries" className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="문의 관리">
          <Bell size={18} />
        </Link>
        <button
          onClick={handleSignOut}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          title="로그아웃"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
