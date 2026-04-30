"use client";

import { useEffect, useState } from "react";
import { Bug, X, Send, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { installFeedbackHooks, submitFeedback } from "@/lib/feedback-engine";

type Phase = "idle" | "submitting" | "done" | "error";

/** 좌하단 핫존(px) — 이 영역에 마우스가 들어오면 버튼이 페이드 인 */
const HOT_ZONE_PX = 140;

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [touchDevice, setTouchDevice] = useState(false);

  // 글로벌 콘솔/네트워크 에러 후크 — 마운트 즉시 1회
  useEffect(() => { installFeedbackHooks(); }, []);

  // 터치 기기 감지 (hover 미지원) — 항상 보이게
  useEffect(() => {
    if (typeof window === "undefined") return;
    setTouchDevice(window.matchMedia("(hover: none)").matches);
  }, []);

  // 마우스 좌하단 핫존 진입 감지 — 호버 가능 기기만
  useEffect(() => {
    if (touchDevice) return;
    const onMove = (e: MouseEvent) => {
      const inZone = e.clientX <= HOT_ZONE_PX && e.clientY >= window.innerHeight - HOT_ZONE_PX;
      setRevealed(inZone);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [touchDevice]);

  // ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 버튼 노출 조건: 모달 열림 / 터치 기기 / 호버로 노출됨
  const visible = open || touchDevice || revealed;

  const close = () => {
    setOpen(false);
    // 닫는 애니메이션 후 상태 초기화
    setTimeout(() => {
      setMessage("");
      setPhase("idle");
      setErrorMsg(null);
    }, 200);
  };

  const submit = async () => {
    if (!message.trim() || phase === "submitting") return;
    setPhase("submitting");
    setErrorMsg(null);
    try {
      await submitFeedback(message);
      setPhase("done");
      setTimeout(close, 1500);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "전송 실패");
      setPhase("error");
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="버그 신고·의견 보내기"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed left-4 bottom-24 lg:bottom-6 z-40",
          "h-12 w-12 rounded-full bg-rose-500 text-white shadow-lg",
          "flex items-center justify-center",
          "hover:bg-rose-600 active:scale-95 transition-all duration-200",
          // 평상시 숨김 → 좌하단 호버 시 페이드 인 (터치 기기는 항상 보임)
          visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none",
        )}
      >
        <Bug className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-rose-500" />
                <h3 className="text-base font-semibold">버그 신고·의견 보내기</h3>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="닫기"
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-gray-600">
                무엇이 문제이거나 개선이 필요한지 알려주세요. 현재 화면과 상태가 자동 첨부되어 관리자에게 전달됩니다.
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="예: 수료증 카드를 클릭해도 모달이 열리지 않아요"
                disabled={phase === "submitting" || phase === "done"}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:bg-gray-50"
              />
              {errorMsg && (
                <p className="text-sm text-rose-600">{errorMsg}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <button
                type="button"
                onClick={close}
                disabled={phase === "submitting"}
                className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!message.trim() || phase === "submitting" || phase === "done"}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition",
                  phase === "done" ? "bg-emerald-500" : "bg-rose-500 hover:bg-rose-600",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {phase === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
                {phase === "done" && <Check className="h-4 w-4" />}
                {phase !== "submitting" && phase !== "done" && <Send className="h-4 w-4" />}
                {phase === "submitting" ? "전송 중..." : phase === "done" ? "전송 완료" : "보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
