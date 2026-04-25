"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Users, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import LoginModal from "@/components/public/LoginModal";

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
  matchPrefix?: string;
};

const TABS: Tab[] = [
  { href: "/", label: "홈", icon: Home },
  { href: "/media", label: "탐색", icon: Compass, matchPrefix: "/media" },
  // 중앙 FAB는 별도 처리
  { href: "/community", label: "커뮤니티", icon: Users, matchPrefix: "/community" },
  { href: "/profile", label: "MY", icon: User, matchPrefix: "/profile" },
];

/**
 * 모바일 하단 5슬롯 네비게이션. lg 이상에서는 숨김.
 * 중앙 FAB는 글쓰기 시트를 열어 권한별 동선 안내.
 */
export default function BottomTabNav() {
  const pathname = usePathname() ?? "/";
  const { user, profile } = useAuth();
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";

  const isActive = (tab: Tab) => {
    if (tab.matchPrefix) return pathname.startsWith(tab.matchPrefix);
    return pathname === tab.href;
  };

  const openWrite = () => {
    if (!user) {
      requireLogin(() => setSheetOpen(true), "글쓰기는 로그인 후 가능합니다.");
      return;
    }
    setSheetOpen(true);
  };

  const closeSheet = () => setSheetOpen(false);

  return (
    <>
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur",
          "lg:hidden",
        )}
        aria-label="모바일 하단 네비게이션"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {/* 좌측 2개 탭 */}
          {TABS.slice(0, 2).map((t) => (
            <TabButton key={t.href} tab={t} active={isActive(t)} />
          ))}

          {/* 중앙 FAB */}
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={openWrite}
              aria-label="글쓰기"
              className={cn(
                "-mt-5 flex h-12 w-12 items-center justify-center rounded-full",
                "bg-gray-900 text-white shadow-lg ring-4 ring-white transition-transform hover:scale-105",
              )}
            >
              <Plus size={22} />
            </button>
          </div>

          {/* 우측 2개 탭 */}
          {TABS.slice(2).map((t) => (
            <TabButton key={t.href} tab={t} active={isActive(t)} />
          ))}
        </div>
        {/* iOS safe area */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {/* 글쓰기 시트 */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[55] flex items-end justify-center lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="글쓰기 옵션"
        >
          <div className="absolute inset-0 bg-black/40" onClick={closeSheet} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl animate-slide-up">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
            <h3 className="mb-3 px-2 text-base font-bold text-gray-900">어디에 작성하시겠어요?</h3>
            <div className="space-y-1.5">
              <SheetItem
                href="/community?tab=free"
                title="묻고 답하기"
                desc="자유 게시판에 질문 또는 의견을 작성합니다."
                onClick={closeSheet}
              />
              <SheetItem
                href="/community?tab=review"
                title="수강후기"
                desc="이수한 강의·프로그램의 후기를 남깁니다."
                onClick={closeSheet}
              />
              {isAdmin && (
                <SheetItem
                  href="/admin/contents"
                  title="관리자 콘텐츠 등록"
                  desc="통합 콘텐츠 관리에서 모든 보드에 작성할 수 있습니다."
                  onClick={closeSheet}
                  accent
                />
              )}
            </div>
            <button
              type="button"
              onClick={closeSheet}
              className="mt-3 w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </>
  );
}

function TabButton({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      className={cn(
        "flex min-w-[64px] flex-1 flex-col items-center justify-center py-2 text-xs",
        active ? "text-gray-900" : "text-gray-400",
      )}
    >
      <Icon size={22} className={active ? "stroke-[2.2]" : ""} />
      <span className={cn("mt-0.5", active && "font-semibold")}>{tab.label}</span>
    </Link>
  );
}

function SheetItem({
  href,
  title,
  desc,
  onClick,
  accent,
}: {
  href: string;
  title: string;
  desc: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "block rounded-xl border px-4 py-3 transition-colors",
        accent
          ? "border-primary-200 bg-primary-50 hover:bg-primary-100"
          : "border-gray-100 bg-gray-50 hover:bg-gray-100",
      )}
    >
      <p className={cn("text-sm font-semibold", accent ? "text-primary-700" : "text-gray-900")}>{title}</p>
      <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
    </Link>
  );
}
