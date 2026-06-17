"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Bot, User, Send, X, Trash2, Maximize2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminAssistant } from "@/hooks/useAdminAssistant";

const SUGGESTIONS = [
  "이 기능 어디서 바꾸나요?",
  "신규 과정 공지글 초안 써줘",
];

/** 모든 관리자 화면에 떠 있는 AI 도우미 챗 — 전용 페이지(/admin/ai-assistant)에서는 숨김. */
export default function AdminChatWidget() {
  const pathname = usePathname();
  // 전용 페이지에서는 위젯 숨김 — 훅(대화기록·Gemini)이 이중 실행되지 않도록 마운트 전에 차단
  if (pathname?.startsWith("/admin/ai-assistant")) return null;
  return <AdminChatWidgetInner />;
}

function AdminChatWidgetInner() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { apiKey, keyLoaded, messages, loading, send, clearChat } = useAdminAssistant();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  const submit = (text?: string) => {
    const t = text ?? input;
    if (loading || !t.trim()) return;
    setInput("");
    void send(t);
  };

  const aiUnavailable = keyLoaded && !apiKey;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="관리자 AI 도우미 열기"
          className="fixed bottom-6 right-6 z-[55] flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-700"
        >
          <Sparkles size={22} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-[55] flex w-[min(92vw,380px)] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl" style={{ height: "min(70vh, 560px)" }}>
          {/* 헤더 */}
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary-600" />
              <span className="text-sm font-bold text-gray-900">관리자 AI 도우미</span>
            </div>
            <div className="flex items-center gap-1">
              <Link href="/admin/ai-assistant" title="전체 화면" className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
                <Maximize2 size={15} />
              </Link>
              {messages.length > 0 && (
                <button onClick={clearChat} title="대화 지우기" className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
                  <Trash2 size={15} />
                </button>
              )}
              <button onClick={() => setOpen(false)} title="닫기" className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>
          </div>

          {aiUnavailable ? (
            <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              AI 도우미를 쓰려면 Gemini API 키가 필요합니다.{" "}
              <Link href="/admin/settings?tab=ai" className="underline font-medium">사이트 설정 → AI 수집</Link>의 Gemini 칸에 키를 저장해 주세요.
            </div>
          ) : (
            <>
              {/* 메시지 */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-2">
                    <Bot size={30} className="text-gray-300" />
                    <p className="text-xs text-gray-500">관리자 페이지 사용법이나 문구 초안을 물어보세요.</p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {SUGGESTIONS.map((s) => (
                        <button key={s} onClick={() => submit(s)} disabled={!keyLoaded} className="px-2.5 py-1 rounded-full border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                      {m.role === "model" && (
                        <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                          <Bot size={13} className="text-primary-600" />
                        </div>
                      )}
                      <div className={cn("max-w-[82%] rounded-2xl px-3 py-2 text-[13px] whitespace-pre-wrap leading-relaxed", m.role === "user" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-800")}>
                        {m.text}
                      </div>
                      {m.role === "user" && (
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                          <User size={13} className="text-gray-500" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                {loading && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <Bot size={13} className="text-primary-600" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl px-3 py-2">
                      <Loader2 size={14} className="animate-spin text-gray-400" />
                    </div>
                  </div>
                )}
              </div>

              {/* 입력 */}
              <div className="border-t border-gray-100 p-2.5">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                    rows={1}
                    placeholder="질문 입력 (Shift+Enter 줄바꿈)"
                    className="flex-1 resize-none max-h-24 px-3 py-2 rounded-xl border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <button
                    onClick={() => submit()}
                    disabled={loading || !input.trim() || !keyLoaded}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
