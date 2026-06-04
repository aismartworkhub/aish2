"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Send, Loader2, Sparkles, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGeminiApiKey } from "@/lib/gemini";
import { GEMINI_MODEL } from "@/lib/gemini-model";
import { buildAdminAssistantContext } from "@/lib/admin-help-content";

type Msg = { role: "user" | "model"; text: string };

const SUGGESTIONS = [
  "히어로 배경 이미지는 어디서 바꾸나요?",
  "메인 페이지 섹션 순서를 바꾸고 싶어요",
  "신규 과정 개강 공지글 초안 써줘",
  "프로그램 소개 문구 3가지 제안해줘",
];

export default function AdminAiAssistantPage() {
  const systemPrompt = useMemo(() => buildAdminAssistantContext(), []);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getGeminiApiKey()
      .then((k) => setApiKey(k))
      .catch(() => setApiKey(null))
      .finally(() => setKeyLoaded(true));
  }, []);

  const send = useCallback(
    async (text?: string) => {
      const userMsg = (text ?? input).trim();
      if (!apiKey || !userMsg || loading) return;
      setInput("");
      setLoading(true);
      const prior = messages;
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: systemPrompt });
        const chat = model.startChat({
          history: prior.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
        });
        const result = await chat.sendMessage(userMsg);
        setMessages([...prior, { role: "user", text: userMsg }, { role: "model", text: result.response.text() }]);
      } catch (e) {
        const raw = e instanceof Error ? e.message : "";
        const quota = /429|RESOURCE_EXHAUSTED|quota/i.test(raw);
        setMessages([
          ...prior,
          { role: "user", text: userMsg },
          {
            role: "model",
            text: quota
              ? "오늘 AI 이용량이 많아 일시적으로 답변이 어렵습니다. 잠시 후 다시 시도해 주세요."
              : "AI 응답에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [apiKey, input, loading, messages, systemPrompt],
  );

  const aiUnavailable = keyLoaded && !apiKey;

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles size={22} className="text-primary-600" /> 관리자 AI 도우미
        </h1>
        <p className="text-gray-500 mt-1">
          “어디서 어떻게 수정하나요?” 안내와 콘텐츠 문구 초안 작성을 도와드립니다. (설정을 직접 바꾸진 않습니다 — 안내·초안만)
        </p>
      </div>

      {aiUnavailable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          AI 도우미를 쓰려면 Gemini API 키가 필요합니다.{" "}
          <Link href="/admin/settings?tab=ai" className="underline font-medium">사이트 설정 → AI 수집</Link>의 ② Gemini 칸에 키를 저장해 주세요.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col" style={{ height: "calc(100vh - 230px)", minHeight: 420 }}>
          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <Bot size={36} className="text-gray-300" />
                <p className="text-sm text-gray-500">무엇이든 물어보세요. 예를 들어:</p>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={!keyLoaded}
                      className="px-3 py-1.5 rounded-full border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "model" && (
                    <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <Bot size={15} className="text-primary-600" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                      m.role === "user" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-800",
                    )}
                  >
                    {m.text}
                  </div>
                  {m.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                      <User size={15} className="text-gray-500" />
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <Bot size={15} className="text-primary-600" />
                </div>
                <div className="bg-gray-100 rounded-2xl px-3.5 py-2.5">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              </div>
            )}
          </div>

          {/* 입력 영역 */}
          <div className="border-t border-gray-100 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="질문하거나 초안을 요청하세요. (Shift+Enter 줄바꿈)"
                className="flex-1 resize-none max-h-32 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <button
                onClick={() => send()}
                disabled={loading || !input.trim() || !keyLoaded}
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5 text-center">
              AI 답변은 참고용입니다. 실제 변경은 안내된 메뉴에서 직접 저장하세요. · <Link href="/admin/help" className="underline">도움말 문서</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
