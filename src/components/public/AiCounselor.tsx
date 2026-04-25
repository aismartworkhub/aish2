"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { buildCounselorContext } from "@/lib/ai-counselor-context";
import { cn } from "@/lib/utils";

const MODEL_ID = "gemini-2.0-flash";

export default function AiCounselor() {
  const ff = useFeatureFlags();
  const enabled = ff.phase5.enabled && ff.phase5.aiCounselor === true;
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    buildCounselorContext().then(setSystemPrompt).catch(() => setSystemPrompt(""));
  }, [enabled]);

  const send = useCallback(async () => {
    const key = profile?.geminiApiKey?.trim();
    const userMsg = input.trim();
    if (!key || !userMsg || !systemPrompt || loading) return;

    setInput("");
    setLoading(true);
    const prior = messages;
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({
        model: MODEL_ID,
        systemInstruction: systemPrompt,
      });
      const chat = model.startChat({
        history: prior.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.text }],
        })),
      });
      const result = await chat.sendMessage(userMsg);
      const text = result.response.text();
      setMessages([...prior, { role: "user", text: userMsg }, { role: "model", text }]);
    } catch {
      setMessages([
        ...prior,
        { role: "user", text: userMsg },
        {
          role: "model",
          text: "응답에 실패했습니다. 프로필의 Gemini API 키를 확인하거나 잠시 후 다시 시도해 주세요.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [profile?.geminiApiKey, input, systemPrompt, loading, messages]);

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // 모바일: BottomTabNav + FloatingCta 위로 충분히 올림. 데스크톱(lg+): 원래 위치.
        className="fixed bottom-44 right-4 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue text-white shadow-lg transition-transform hover:scale-105 md:bottom-44 lg:bottom-6 lg:right-6"
        aria-label="AI 상담 열기"
      >
        <MessageCircle size={26} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-end p-4 sm:items-center sm:justify-end sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="닫기"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "relative flex h-[min(520px,85vh)] w-full max-w-md flex-col rounded-xl border border-gray-200 bg-white shadow-2xl",
            )}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-bold text-gray-900">AISH AI 안내</span>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            {!profile?.geminiApiKey?.trim() ? (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-gray-500">
                프로필 설정에서 Gemini API 키를 저장하면 상담을 이용할 수 있습니다.
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
                  {messages.length === 0 && (
                    <p className="text-gray-500">AISH 이용 방법을 물어보세요.</p>
                  )}
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg px-3 py-2",
                        m.role === "user" ? "ml-8 bg-brand-blue/10 text-gray-900" : "mr-8 bg-gray-100 text-gray-800",
                      )}
                    >
                      {m.text}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader2 size={16} className="animate-spin" /> 답변 생성 중…
                    </div>
                  )}
                </div>
                <div className="flex gap-2 border-t border-gray-100 p-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="질문 입력…"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                  />
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={loading || !input.trim()}
                    className="rounded-lg bg-brand-blue px-3 py-2 text-white disabled:opacity-40"
                    aria-label="전송"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
