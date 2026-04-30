/**
 * 사용자 피드백/버그 신고 수집·저장 엔진.
 * - 글로벌 ring buffer로 콘솔 에러·네트워크 실패 보관 (메모리 ~10건)
 * - html2canvas로 화면 캡쳐 (동적 import, 버튼 클릭 시에만 로드)
 * - DOM outerHTML 스냅샷
 * - Firestore feedbackReports 컬렉션 저장
 */

"use client";

import { auth } from "@/lib/firebase";
import { COLLECTIONS, createDoc } from "@/lib/firestore";

const MAX_LOG = 10;
const MAX_DOM_CHARS = 180_000; // ~180KB cap before Firestore base64 inflation
const SCREENSHOT_QUALITY = 0.7;
const SCREENSHOT_MAX_WIDTH = 1280;

export type FeedbackStatus = "open" | "in_progress" | "closed";

export type ConsoleErrorEntry = {
  message: string;
  source?: string;
  line?: number;
  col?: number;
  stack?: string;
  at: string;
};

export type NetworkErrorEntry = {
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  at: string;
};

export type FeedbackContext = {
  url: string;
  pathname: string;
  search?: string;
  hash?: string;
  routeFile?: string; // src/app/(public)/community/page.tsx 같은 추정 경로
  userAgent: string;
  viewport: { w: number; h: number };
  language: string;
  consoleErrors: ConsoleErrorEntry[];
  networkErrors: NetworkErrorEntry[];
};

export type FeedbackReport = {
  id?: string;
  message: string;
  context: FeedbackContext;
  /** data:image/jpeg;base64,... — 캡쳐 실패 시 빈 문자열 */
  screenshotDataUrl: string;
  /** outerHTML 일부(최대 MAX_DOM_CHARS) */
  domSnapshot: string;
  reporterUid?: string;
  reporterEmail?: string;
  status: FeedbackStatus;
  createdAt: string;
};

// ─────────────────────────── Ring buffer ───────────────────────────

const consoleErrors: ConsoleErrorEntry[] = [];
const networkErrors: NetworkErrorEntry[] = [];
let installed = false;

function pushBounded<T>(arr: T[], item: T) {
  arr.push(item);
  if (arr.length > MAX_LOG) arr.shift();
}

/** 한 번만 호출 — 글로벌 에러/네트워크 후크 설치 */
export function installFeedbackHooks() {
  if (installed) return;
  if (typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    pushBounded(consoleErrors, {
      message: e.message,
      source: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error?.stack,
      at: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    pushBounded(consoleErrors, {
      message: `unhandledrejection: ${reason?.message ?? String(reason)}`,
      stack: reason?.stack,
      at: new Date().toISOString(),
    });
  });

  // fetch wrapper — 4xx/5xx · 네트워크 실패 캡쳐
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    try {
      const res = await origFetch(input, init);
      if (!res.ok) {
        pushBounded(networkErrors, {
          url,
          method: method ?? "GET",
          status: res.status,
          statusText: res.statusText,
          at: new Date().toISOString(),
        });
      }
      return res;
    } catch (err) {
      pushBounded(networkErrors, {
        url,
        method: method ?? "GET",
        statusText: err instanceof Error ? err.message : "fetch failed",
        at: new Date().toISOString(),
      });
      throw err;
    }
  };
}

// ─────────────────────────── Capture ───────────────────────────

/** 현재 pathname을 src/app 라우트 파일 경로로 추정 */
function inferRouteFile(pathname: string): string {
  // 공개/관리자 그룹 매핑 — 정확하진 않지만 디버깅 힌트로 충분
  const trimmed = pathname.replace(/\/$/, "") || "/";
  if (trimmed === "/") return "src/app/(public)/page.tsx";
  if (trimmed.startsWith("/admin")) {
    const sub = trimmed.replace("/admin", "").replace(/^\//, "");
    return sub ? `src/app/admin/${sub}/page.tsx` : "src/app/admin/page.tsx";
  }
  if (trimmed.startsWith("/login")) return "src/app/login/page.tsx";
  // 그 외 모두 (public) 그룹 가정
  const sub = trimmed.replace(/^\//, "");
  return `src/app/(public)/${sub}/page.tsx`;
}

export function collectContext(): FeedbackContext {
  const loc = window.location;
  return {
    url: loc.href,
    pathname: loc.pathname,
    search: loc.search || undefined,
    hash: loc.hash || undefined,
    routeFile: inferRouteFile(loc.pathname),
    userAgent: navigator.userAgent,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    language: navigator.language,
    consoleErrors: [...consoleErrors],
    networkErrors: [...networkErrors],
  };
}

export async function captureScreenshot(): Promise<string> {
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      logging: false,
      // 모바일·고DPI에서 너무 큰 이미지 방지
      width: Math.min(document.body.scrollWidth, SCREENSHOT_MAX_WIDTH),
      windowWidth: Math.min(window.innerWidth, SCREENSHOT_MAX_WIDTH),
    });
    // 폭 다운스케일
    const scale = Math.min(1, SCREENSHOT_MAX_WIDTH / canvas.width);
    if (scale < 1) {
      const scaled = document.createElement("canvas");
      scaled.width = Math.round(canvas.width * scale);
      scaled.height = Math.round(canvas.height * scale);
      const ctx = scaled.getContext("2d");
      ctx?.drawImage(canvas, 0, 0, scaled.width, scaled.height);
      return scaled.toDataURL("image/jpeg", SCREENSHOT_QUALITY);
    }
    return canvas.toDataURL("image/jpeg", SCREENSHOT_QUALITY);
  } catch {
    return "";
  }
}

export function captureDomSnapshot(): string {
  try {
    const html = document.documentElement.outerHTML;
    if (html.length <= MAX_DOM_CHARS) return html;
    // 앞·뒤 절반씩 잘라 양쪽 보존
    const half = Math.floor(MAX_DOM_CHARS / 2);
    return html.slice(0, half) + "\n<!-- ... TRUNCATED ... -->\n" + html.slice(-half);
  } catch {
    return "";
  }
}

// ─────────────────────────── Submit ───────────────────────────

export async function submitFeedback(message: string): Promise<string> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error("메시지를 입력해주세요.");

  const context = collectContext();
  const [screenshotDataUrl, domSnapshot] = await Promise.all([
    captureScreenshot(),
    Promise.resolve(captureDomSnapshot()),
  ]);

  const user = auth.currentUser;
  const report: Omit<FeedbackReport, "id"> = {
    message: trimmed,
    context,
    screenshotDataUrl,
    domSnapshot,
    reporterUid: user?.uid,
    reporterEmail: user?.email ?? undefined,
    status: "open",
    createdAt: new Date().toISOString(),
  };

  const id = await createDoc(COLLECTIONS.FEEDBACK_REPORTS, report);
  return id;
}

// ─────────────────────────── Admin formatting ───────────────────────────

/** 관리자 페이지에서 "Claude Code 프롬프트로 복사" 버튼이 만들 텍스트 */
export function formatPrompt(report: FeedbackReport): string {
  const c = report.context;
  const errs = c.consoleErrors.slice(-3).map((e) => `  - ${e.message}${e.source ? ` (${e.source}:${e.line})` : ""}`).join("\n");
  const nets = c.networkErrors.slice(-3).map((n) => `  - ${n.method} ${n.url} → ${n.status ?? "FAIL"} ${n.statusText ?? ""}`).join("\n");
  return [
    `[사용자 신고]`,
    `메시지: ${report.message}`,
    ``,
    `URL: ${c.url}`,
    `추정 라우트 파일: ${c.routeFile ?? "?"}`,
    `브라우저: ${c.userAgent}`,
    `뷰포트: ${c.viewport.w}×${c.viewport.h}`,
    `보고자: ${report.reporterEmail ?? "(비로그인)"}`,
    `시각: ${report.createdAt}`,
    ``,
    `최근 콘솔 에러:`,
    errs || `  (없음)`,
    ``,
    `최근 네트워크 실패:`,
    nets || `  (없음)`,
    ``,
    `위 신고를 분석하고, 추정 라우트 파일을 시작점으로 원인을 찾아 수정해 주세요.`,
  ].join("\n");
}
