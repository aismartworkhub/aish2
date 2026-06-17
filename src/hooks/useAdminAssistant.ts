"use client";

import { useCallback, useEffect, useState } from "react";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { getGeminiApiKey } from "@/lib/gemini";
import { GEMINI_MODEL } from "@/lib/gemini-model";
import { buildAdminAssistantContext, buildAdminAssistantContextLive } from "@/lib/admin-help-content";

export type AdminMsg = { role: "user" | "model"; text: string; attachmentName?: string };
export type AdminAttachment = { name: string; mimeType: string; data: string };

const STORAGE_KEY = "aish_admin_ai_chat_v1";

function loadHistory(): AdminMsg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminMsg[]) : [];
  } catch {
    return [];
  }
}

/**
 * 관리자 AI 도우미 공용 로직 — 전용 페이지와 플로팅 위젯이 함께 사용.
 * 대화 기록은 localStorage 한 곳에 저장되어 페이지/위젯 간 이어집니다.
 */
export function useAdminAssistant() {
  // 정적 매뉴얼로 즉시 시작 → 마운트 후 라이브 컨텍스트로 자동 업그레이드
  const [systemPrompt, setSystemPrompt] = useState<string>(() => buildAdminAssistantContext());
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [messages, setMessages] = useState<AdminMsg[]>(loadHistory);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getGeminiApiKey().then((k) => setApiKey(k)).catch(() => setApiKey(null)).finally(() => setKeyLoaded(true));
  }, []);

  useEffect(() => {
    buildAdminAssistantContextLive().then(setSystemPrompt).catch(() => {});
  }, []);

  // 히스토리 유지 (새로고침·페이지 이동에도 남음)
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    } catch {
      /* 용량 초과 등 무시 */
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const send = useCallback(
    async (text: string, attachment?: AdminAttachment | null) => {
      const userMsg = text.trim();
      if (!apiKey || loading || (!userMsg && !attachment)) return;
      setLoading(true);
      const prior = messages;
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: systemPrompt });
        const chat = model.startChat({
          history: prior.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
        });
        const parts: Part[] = [];
        if (userMsg) parts.push({ text: userMsg });
        if (attachment) parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
        const result = await chat.sendMessage(parts.length ? parts : [{ text: " " }]);
        setMessages([
          ...prior,
          { role: "user", text: userMsg || "(첨부 파일)", attachmentName: attachment?.name },
          { role: "model", text: result.response.text() },
        ]);
      } catch (e) {
        const raw = e instanceof Error ? e.message : "";
        const quota = /429|RESOURCE_EXHAUSTED|quota/i.test(raw);
        setMessages([
          ...prior,
          { role: "user", text: userMsg || "(첨부 파일)", attachmentName: attachment?.name },
          {
            role: "model",
            text: quota
              ? "오늘 AI 이용량이 많아 일시적으로 답변이 어렵습니다. 잠시 후 다시 시도해 주세요."
              : "AI 응답에 실패했습니다. (첨부 파일 형식이 지원되지 않을 수 있습니다: 이미지·PDF·텍스트 권장)",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [apiKey, loading, messages, systemPrompt],
  );

  return { apiKey, keyLoaded, messages, loading, send, clearChat };
}
