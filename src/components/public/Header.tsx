"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, User, LogOut, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { getFilteredCollection, updateDocFields, COLLECTIONS } from "@/lib/firestore";
import type { AppNotification } from "@/types/firestore";
import { useSiteCta } from "@/hooks/useSiteCta";
import { isExternalHref, resolveNotificationHref } from "@/lib/utils";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, isProfileComplete, signOut } = useAuth();
  const { buttonUrl, buttonText } = useSiteCta();
  const featureFlags = useFeatureFlags();
  const notificationUiEnabled =
    featureFlags.phase4.enabled && featureFlags.phase4.notificationSystem === true;
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<(AppNotification & { id: string })[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    const checkNotifications = async () => {
      try {
        const notifs = await getFilteredCollection<AppNotification & { id: string }>(
          COLLECTIONS.NOTIFICATIONS, "recipientUid", user.uid
        );
        const sorted = notifs.sort((a, b) => {
          const ta =
            typeof a.createdAt === "string"
              ? new Date(a.createdAt).getTime()
              : (a.createdAt as { seconds?: number } | undefined)?.seconds
                ? (a.createdAt as { seconds: number }).seconds * 1000
                : 0;
          const tb =
            typeof b.createdAt === "string"
              ? new Date(b.createdAt).getTime()
              : (b.createdAt as { seconds?: number } | undefined)?.seconds
                ? (b.createdAt as { seconds: number }).seconds * 1000
                : 0;
          return tb - ta;
        });
        setNotifications(sorted.slice(0, 10));
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

  // 경로 변경 시 드롭다운 자동 닫기
  useEffect(() => {
    setNotifOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-brand-border transition-all duration-300 flex items-center",
          isScrolled ? "h-14 md:h-[70px] shadow-[0_10px_20px_rgba(0,0,0,0.05)]" : "h-16 md:h-20"
        )}
      >
        <div className="w-[90%] max-w-[1440px] mx-auto flex items-center justify-between">
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
                  "px-5 py-2 text-[15px] font-medium transition-colors rounded focus:outline-none focus:ring-2 focus:ring-brand-blue/30",
                  pathname === item.href
                    ? "text-brand-blue"
                    : "text-gray-700 hover:text-brand-blue"
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
              className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 bg-brand-blue text-white text-sm font-medium rounded-sm uppercase tracking-widest hover:bg-brand-lightBlue transition-colors"
            >
              {buttonText}
            </a>

            {/* 알림 벨 */}
            {user && (
              notificationUiEnabled ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                    className="relative p-2 text-gray-600 hover:text-brand-blue transition-colors"
                    aria-label="알림"
                    aria-expanded={notifOpen}
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">알림</span>
                        <Link href="/community?tab=notice" className="text-xs text-brand-blue hover:underline" onClick={() => setNotifOpen(false)}>커뮤니티</Link>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="py-8 text-center text-sm text-gray-400">알림이 없습니다</p>
                        ) : (
                          notifications.map((n) => {
                            const href = resolveNotificationHref(n);
                            const ext = isExternalHref(href);
                            return (
                              <Link
                                key={n.id}
                                href={href}
                                target={ext ? "_blank" : undefined}
                                rel={ext ? "noopener noreferrer" : undefined}
                                onClick={() => {
                                  setNotifOpen(false);
                                  if (!n.isRead) {
                                    updateDocFields(COLLECTIONS.NOTIFICATIONS, n.id, { isRead: true }).catch(() => {});
                                    setUnreadCount((prev) => Math.max(0, prev - 1));
                                    setNotifications((prev) =>
                                      prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
                                    );
                                  }
                                }}
                                className={cn(
                                  "block px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50",
                                  !n.isRead && "bg-blue-50/50",
                                )}
                              >
                                <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</p>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/community?tab=notice" className="relative p-2 text-gray-600 hover:text-brand-blue transition-colors" aria-label="알림">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
              )
            )}

            {/* 로그인 / 프로필 */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-sm hover:bg-brand-gray transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  aria-label="사용자 메뉴"
                >
                  <div className="relative w-8 h-8">
                    <div className="w-8 h-8 rounded-full bg-brand-gray flex items-center justify-center">
                      {user.photoURL ? (
                         
                        <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <span className="text-sm font-bold text-brand-blue">
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
                    <div className="absolute right-0 top-12 z-50 w-48 bg-white rounded-sm shadow-lg border border-brand-border py-2">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-brand-dark truncate">{user.displayName || "사용자"}</p>
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
                className="inline-flex items-center gap-2 px-3 md:px-4 py-2 border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
              >
                <User size={16} />
                <span className="hidden md:inline">로그인 / 회원가입</span>
                <span className="md:hidden">로그인</span>
              </button>
            )}

            <Link href="/programs" className="lg:hidden p-2 text-gray-700 hover:text-brand-blue" aria-label="검색">
              <Search size={20} />
            </Link>
            {/* 모바일 햄버거는 BottomTabNav로 대체 — Sprint 2 Batch C */}
          </div>
        </div>
      </header>
    </>
  );
}
