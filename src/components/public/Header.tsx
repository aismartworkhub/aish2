"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronRight, Search, User, LogOut, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { getFilteredCollection, COLLECTIONS } from "@/lib/firestore";
import type { AppNotification } from "@/types/firestore";
import { useSiteCta } from "@/hooks/useSiteCta";
import { isExternalHref } from "@/lib/utils";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, isProfileComplete, signOut } = useAuth();
  const { buttonUrl, buttonText } = useSiteCta();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    const checkNotifications = async () => {
      try {
        const notifs = await getFilteredCollection<AppNotification & { id: string }>(
          COLLECTIONS.NOTIFICATIONS, "recipientUid", user.uid
        );
        setUnreadCount(notifs.filter((n) => !n.isRead).length);
      } catch { /* ignore */ }
    };
    checkNotifications();
    const interval = setInterval(checkNotifications, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 100);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 경로 변경 시 모바일 메뉴 자동 닫기
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200/60 transition-all duration-300 flex items-center",
          isScrolled ? "h-14 md:h-[70px] shadow-[0_10px_20px_rgba(0,0,0,0.05)]" : "h-16 md:h-20"
        )}
      >
        <div className="w-[90%] max-w-[1400px] mx-auto flex items-center justify-between">
          {/* 로고 */}
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <img
              src="/images/logo-aish-transparent.png"
              alt="AISH - AI Smart Work Hub"
              className="h-12 md:h-14 w-auto"
            />
          </Link>

          {/* 데스크톱 내비게이션 */}
          <nav className="hidden lg:flex items-center">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-5 py-2 text-[15px] font-medium transition-colors rounded focus:outline-none focus:ring-2 focus:ring-primary-500/30",
                  pathname === item.href
                    ? "text-primary-600"
                    : "text-gray-700 hover:text-primary-600"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* 우측 CTA + 로그인 + 햄버거 */}
          <div className="flex items-center gap-3">
            <a
              href={buttonUrl}
              target={isExternalHref(buttonUrl) ? "_blank" : undefined}
              rel={isExternalHref(buttonUrl) ? "noopener noreferrer" : undefined}
              className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white text-sm font-medium rounded hover:bg-primary-600 transition-colors"
            >
              {buttonText}
              <Search size={16} />
            </a>

            {/* 알림 벨 */}
            {user && (
              <Link href="/community?tab=notice" className="relative p-2 text-gray-600 hover:text-primary-600 transition-colors" aria-label="알림">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            )}

            {/* 로그인 / 프로필 */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  aria-label="사용자 메뉴"
                >
                  <div className="relative w-8 h-8">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      {user.photoURL ? (
                         
                        <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <span className="text-sm font-bold text-primary-600">
                          {(user.displayName || user.email || "U").charAt(0)}
                        </span>
                      )}
                    </div>
                    {!isProfileComplete && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <span className="hidden md:block text-sm text-gray-700 max-w-[100px] truncate">
                    {user.displayName || user.email?.split("@")[0]}
                  </span>
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-12 z-50 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.displayName || "사용자"}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <User size={14} />
                        프로필 설정
                        {!isProfileComplete && (
                          <span className="ml-auto w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <LogOut size={14} />
                        로그아웃
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="inline-flex items-center gap-2 px-3 md:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
              >
                <User size={16} />
                <span className="hidden md:inline">로그인 / 회원가입</span>
                <span className="md:hidden">로그인</span>
              </button>
            )}

            <Link href="/programs" className="lg:hidden p-2 text-gray-700 hover:text-primary-600" aria-label="검색">
              <Search size={20} />
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 text-gray-700 relative z-[60]"
              aria-label={isMobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* 모바일 메뉴 - header 바깥에 배치하여 클릭 이벤트 보장 */}
      {isMobileMenuOpen && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 bg-black/30 z-[55] lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* 메뉴 패널 - bottom sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-[56] lg:hidden bg-white rounded-t-2xl shadow-lg max-h-[70vh] overflow-y-auto animate-slide-up">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-2" />
            <nav className="w-[90%] max-w-[1400px] mx-auto py-4 space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3.5 text-base font-medium transition-colors rounded-lg",
                    pathname === item.href
                      ? "text-primary-600 bg-primary-50"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {item.label}
                  <ChevronRight size={16} className="text-gray-300" />
                </Link>
              ))}
              {user && (
                <Link
                  href="/community?tab=notice"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3.5 text-base font-medium transition-colors rounded-lg text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Bell size={18} />
                    알림
                    {unreadCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold leading-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={16} className="text-gray-300" />
                </Link>
              )}
              <div className="pt-4 px-4 pb-2 space-y-2">
                {!user && (
                  <button
                    onClick={() => { handleGoogleLogin(); setIsMobileMenuOpen(false); }}
                    className="block w-full py-3.5 rounded-lg border-2 border-primary-500 text-primary-600 text-center text-base font-semibold hover:bg-primary-50 transition-colors"
                  >
                    Google로 로그인 / 회원가입
                  </button>
                )}
                <a
                  href={buttonUrl}
                  target={isExternalHref(buttonUrl) ? "_blank" : undefined}
                  rel={isExternalHref(buttonUrl) ? "noopener noreferrer" : undefined}
                  className="block w-full py-3.5 rounded-lg bg-primary-500 text-white text-center text-base font-semibold hover:bg-primary-600 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {buttonText}
                </a>
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
