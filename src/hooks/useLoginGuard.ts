"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useLoginGuard() {
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");

  // user 변경 시 모달 자동 닫기 (Phase 4-3) — 다른 탭 로그인 후 원래 탭 모달 잔류 방지
  useEffect(() => {
    if (user && showLogin) {
      setShowLogin(false);
      setLoginMessage("");
    }
  }, [user, showLogin]);

  const requireLogin = useCallback(
    (action: () => void, message?: string) => {
      if (user) {
        action();
      } else {
        setLoginMessage(message || "");
        setShowLogin(true);
      }
    },
    [user]
  );

  const closeLogin = useCallback(() => {
    setShowLogin(false);
    setLoginMessage("");
  }, []);

  return {
    user,
    showLogin,
    loginMessage,
    requireLogin,
    closeLogin,
  };
}
