"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useLoginGuard() {
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");

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
