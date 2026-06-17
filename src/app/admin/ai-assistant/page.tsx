"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Loader2, Sparkles, Bot, User, Paperclip, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminAssistant, type AdminAttachment } from "@/hooks/useAdminAssistant";

const MAX_FILE_MB = 15;
const ACCEPT = "image/*,application/pdf,text/plain,.md,.csv";

const SUGGESTIONS = [
  "히어로 배경 이미지는 어디서 바꾸나요?",
  "메인 페이지 섹션 순서를 바꾸고 싶어요",
  "신규 과정 개강 공지글 초안 써줘",
  "프로그램 소개 문구 3가지 제안해줘",
];

export default function AdminAiAssistantPage() {
  const { apiKey, keyLoaded, messages, loading, send: sendMessage, clearChat: clearChatHook } = useAdminAssistant();
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<AdminAttachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      alert(`${MAX_FILE_MB}MB 이하 파일만 첨부할 수 있습니다.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
      if (base64) setAttachment({ name: file.name, mimeType: file.type || "application/octet-stream", data: base64 });
    };
    reader.readAsDataURL(file);
  };

  const clearChat = () => {
    if (messages.length === 0 || confirm("대화 내용을 모두 지울까요?")) clearChatHook();
  };

  const send = useCallback(
    (text?: string) => {
      const userMsg = text ?? input;
      if (loading || (!userMsg.trim() && !attachment)) return;
      const att = attachment;
      setInput("");
      setAttachment(null);
      void sendMessage(userMsg, att);
    },
    [input, attachment, loading, sendMessage],
  );

  const aiUnavailable = keyLoaded && !apiKey;

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={22} className="text-primary-600" /> 관리자 AI 도우미
          </h1>
          <p className="text-gray-500 mt-1">
            “어디서 어떻게 수정하나요?” 안내와 콘텐츠 문구 초안 작성을 도와드립니다. 대화는 이 브라우저에 저장됩니다.
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">
            <Trash2 size={14} /> 대화 지우기
          </button>
        )}
      </div>

      {aiUnavailable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          AI 도우미를 쓰려면 Gemini API 키가 필요합니다.{" "}
          <Link href="/admin/settings?tab=ai" className="underline font-medium">사이트 설정 → AI 수집</Link>의 ② Gemini 칸에 키를 저장해 주세요.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col" style={{ height: "calc(100vh - 230px)", minHeight: 420 }}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <Bot size={36} className="text-gray-300" />
                <p className="text-sm text-gray-500">무엇이든 물어보세요. 파일(이미지·PDF·텍스트)을 첨부해 분석을 요청할 수도 있습니다.</p>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} disabled={!keyLoaded} className="px-3 py-1.5 rounded-full border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">
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
                  <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed", m.role === "user" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-800")}>
                    {m.attachmentName && (
                      <span className={cn("mb-1 flex items-center gap-1 text-xs", m.role === "user" ? "text-white/80" : "text-gray-500")}>
                        <Paperclip size={12} /> {m.attachmentName}
                      </span>
                    )}
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

          <div className="border-t border-gray-100 p-3">
            {attachment && (
              <div className="mb-2 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-100 text-xs text-gray-600">
                <Paperclip size={12} /> {attachment.name}
                <button onClick={() => setAttachment(null)} className="text-gray-400 hover:text-gray-700"><X size={13} /></button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                title="파일 첨부 (이미지·PDF·텍스트)"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 shrink-0"
              >
                <Paperclip size={16} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                placeholder="질문하거나 초안을 요청하세요. (Shift+Enter 줄바꿈)"
                className="flex-1 resize-none max-h-32 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <button
                onClick={() => send()}
                disabled={loading || (!input.trim() && !attachment) || !keyLoaded}
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
