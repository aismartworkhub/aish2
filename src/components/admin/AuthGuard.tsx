"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ShieldX, UserX } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, isAdmin, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  if (!profile.isActive) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <UserX className="mx-auto mb-4 text-gray-400" size={48} />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">계정이 비활성화되었습니다</h2>
          <p className="text-sm text-gray-500 mb-6">
            관리자에 의해 계정이 비활성화되었습니다.<br />
            관리자에게 문의해 주세요.
          </p>
          <button
            onClick={async () => { await signOut(); router.replace("/"); }}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <ShieldX className="mx-auto mb-4 text-red-400" size={48} />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">접근 권한이 없습니다</h2>
          <p className="text-sm text-gray-500 mb-6">
            관리자로 등록되지 않은 계정입니다.<br />
            관리자에게 문의해 주세요.
          </p>
          <button
            onClick={async () => { await signOut(); router.replace("/"); }}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
