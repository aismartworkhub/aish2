"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, X, Send, Loader2, Phone, Mail, LifeBuoy, ArrowLeft, CheckCircle2 } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { buildCounselorContext } from "@/lib/ai-counselor-context";
import { getGeminiApiKey } from "@/lib/gemini";
import { loadBusinessInfo, type BusinessInfoConfig } from "@/lib/site-settings-public";
import { submitFeedback } from "@/lib/feedback-engine";
import { BUSINESS_INFO } from "@/lib/constants";
import { cn } from "@/lib/utils";

const MODEL_ID = "gemini-2.5-flash-lite";

export default function AiCounselor() {
  const ff = useFeatureFlags();
  const enabled = ff.phase5.enabled && ff.phase5.aiCounselor === true;
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [siteKey, setSiteKey] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // 담당자 연락 폴백
  const [biz, setBiz] = useState<BusinessInfoConfig>(BUSINESS_INFO);
  const [showContact, setShowContact] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    buildCounselorContext().then(setSystemPrompt).catch(() => setSystemPrompt(""));
    getGeminiApiKey().then((k) => setSiteKey(k ?? "")).catch(() => {});
    loadBusinessInfo().then(setBiz).catch(() => {});
  }, [enabled]);

  // 공용 사이트 키(siteSettings/gemini) 우선, 개인 프로필 키가 있으면 override
  const effectiveKey = (profile?.geminiApiKey?.trim() || siteKey).trim();
  const aiUnavailable = !effectiveKey;

  const send = useCallback(async () => {
    const key = effectiveKey;
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
    } catch (e) {
      // 쿼터 소진(429/RESOURCE_EXHAUSTED) 여부에 따라 안내 차등
      const raw = e instanceof Error ? e.message : "";
      const quota = /429|RESOURCE_EXHAUSTED|quota/i.test(raw);
      setMessages([
        ...prior,
        { role: "user", text: userMsg },
        {
          role: "model",
          text: quota
            ? "오늘 AI 상담 이용량이 많아 일시적으로 답변이 어렵습니다. 아래 ‘담당자 연락’으로 문의해 주세요."
            : "AI 응답에 실패했습니다. 잠시 후 다시 시도하시거나, 아래 ‘담당자 연락’을 이용해 주세요.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [effectiveKey, input, systemPrompt, loading, messages]);

  if (!enabled) return null;

  // 본문 뷰 결정: AI 불가하거나 사용자가 연락 탭을 열면 연락 패널
  const view: "chat" | "contact" = aiUnavailable || showContact ? "contact" : "chat";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // 모바일: BottomTabNav(z-50) + FloatingCta(z-[51]) 위로 (z-[52]). 데스크톱(lg+): 원래 위치.
        // z-index 표준 (Phase 3-3): BottomTab=50, FloatingCta=51, AiCounselor=52, FeedbackButton=52(좌측), 모든 모달=60+
        className="fixed bottom-44 right-4 z-[52] flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue text-white shadow-lg transition-transform hover:scale-105 md:bottom-44 lg:bottom-6 lg:right-6"
        aria-label="AI 상담 열기"
      >
        <MessageCircle size={26} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[65] flex items-end justify-end p-4 sm:items-center sm:justify-end sm:p-6">
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
              <span className="text-sm font-bold text-gray-900">
                {view === "contact" ? "담당자 연락" : "AISH AI 안내"}
              </span>
              <div className="flex items-center gap-1">
                {/* 채팅 ↔ 연락 전환 (AI 사용 가능할 때만 토글 노출) */}
                {!aiUnavailable && (
                  view === "chat" ? (
                    <button
                      type="button"
                      onClick={() => setShowContact(true)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10"
                    >
                      <LifeBuoy size={14} /> 담당자 연락
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowContact(false)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
                    >
                      <ArrowLeft size={14} /> AI 상담
                    </button>
                  )
                )}
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                  <X size={18} />
                </button>
              </div>
            </div>

            {view === "contact" ? (
              <ContactPanel biz={biz} aiUnavailable={aiUnavailable} />
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
                  {messages.length === 0 && (
                    <p className="text-gray-500">AISH 이용 방법을 물어보세요. 답변이 어려우면 우측 상단 ‘담당자 연락’을 이용하세요.</p>
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

function ContactPanel({ biz, aiUnavailable }: { biz: BusinessInfoConfig; aiUnavailable: boolean }) {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const telHref = `tel:${biz.phone.replace(/[^0-9+]/g, "")}`;
  const mailHref = `mailto:${biz.email}?subject=${encodeURIComponent("[AISH] 상담 문의")}`;

  const submit = async () => {
    const text = msg.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await submitFeedback(`[AI 상담창 문의] ${text}`);
      setSent(true);
      setMsg("");
    } catch {
      // 실패해도 전화·이메일 안내는 그대로 사용 가능
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
      <p className="text-gray-600">
        {aiUnavailable
          ? "지금은 AI 상담을 이용할 수 없습니다. 아래로 담당자에게 직접 문의해 주세요."
          : "담당자에게 직접 연락하실 수 있습니다."}
      </p>

      {/* 전화 · 이메일 */}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={telHref}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Phone size={15} className="text-brand-blue" /> 전화 상담
        </a>
        <a
          href={mailHref}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Mail size={15} className="text-brand-blue" /> 이메일 문의
        </a>
      </div>
      <dl className="space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
        <div className="flex gap-2">
          <dt className="shrink-0 text-gray-400">전화</dt>
          <dd>{biz.phone}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-gray-400">이메일</dt>
          <dd>{biz.email}</dd>
        </div>
      </dl>

      {/* 메시지 남기기 (feedbackReports — 담당자 확인) */}
      <div className="border-t border-gray-100 pt-3">
        <p className="mb-1.5 text-xs font-medium text-gray-600">또는 메시지를 남겨주세요</p>
        {sent ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            <CheckCircle2 size={16} />
            접수되었습니다. 담당자가 확인 후 연락드리겠습니다.
          </div>
        ) : (
          <>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={3}
              placeholder="문의 내용과 연락처를 남겨주세요."
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={sending || !msg.trim()}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-blue px-3 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-40"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              메시지 보내기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
