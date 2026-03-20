"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, CTA_URL, CTA_TEXT } from "@/lib/constants";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

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
          isScrolled ? "h-[70px] shadow-[0_10px_20px_rgba(0,0,0,0.05)]" : "h-20"
        )}
      >
        <div className="w-[90%] max-w-[1400px] mx-auto flex items-center justify-between">
          {/* 로고 */}
          <Link href="/" className="shrink-0 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  "px-5 py-2 text-[15px] font-medium transition-colors",
                  pathname === item.href
                    ? "text-primary-600"
                    : "text-gray-700 hover:text-primary-600"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* 우측 CTA + 햄버거 */}
          <div className="flex items-center gap-3">
            <a
              href={CTA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white text-sm font-medium rounded hover:bg-primary-600 transition-colors"
            >
              수강 신청
              <Search size={16} />
            </a>

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
          {/* 메뉴 패널 */}
          <div className="fixed top-20 left-0 right-0 z-[56] lg:hidden bg-white border-t border-gray-200 shadow-lg max-h-[calc(100vh-80px)] overflow-y-auto">
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
              <div className="pt-4 px-4 pb-2">
                <a
                  href={CTA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3.5 rounded-lg bg-primary-500 text-white text-center text-base font-semibold hover:bg-primary-600 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {CTA_TEXT}
                </a>
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
