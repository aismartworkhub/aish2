"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, UserCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const DISMISS_KEY = "profile-banner-dismissed";

export default function ProfileCompletionBanner() {
  const { user, isProfileComplete, loading } = useAuth();
  // Phase 5-20 — 초기값을 sessionStorage 동기 읽기로 → 마운트 직후 깜빡임 제거
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true; // SSR/정적 export 시 기본 숨김 → 깜빡임 차단
    return sessionStorage.getItem(DISMISS_KEY) === "true";
  });
  // SSR ↔ 클라이언트 hydration 불일치 방지 — mounted 이후만 표시
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "true");
  };

  if (!mounted || loading || !user || isProfileComplete || dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="w-[90%] max-w-[1400px] mx-auto flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <UserCircle size={18} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 truncate">
            프로필을 완성해 주세요! 이름, 기수, 연락처를 입력하면 원활한 서비스를 이용할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/profile"
            className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            입력하기
          </Link>
          <button
            onClick={handleDismiss}
            className="p-2.5 text-amber-500 hover:text-amber-700 transition-colors"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
