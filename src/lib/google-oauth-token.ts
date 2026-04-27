/**
 * Google Identity Services (GIS) Token Client 래퍼.
 *
 * 배경:
 *   Firebase Auth `signInWithPopup`은 앱 로그인용으로 설계되어,
 *   BigQuery·Drive 같은 추가 OAuth 스코프 요청 시 Cross-Origin-Opener-Policy
 *   영향을 받아 토큰 전달이 막히는 문제가 있다.
 *   GIS Token Client는 OAuth 액세스 토큰 취득 전용으로 COOP 친화적이다.
 *
 * 사전 작업 (한 번만):
 *   GCP 콘솔 → API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID(웹 앱)
 *   - 승인된 JS 출처: https://aish-web-v2.web.app , http://localhost:3000
 *   - 발급된 Client ID를 NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID 환경변수로 등록
 *
 * 사용:
 *   const token = await requestGoogleAccessToken("https://www.googleapis.com/auth/bigquery.readonly");
 */

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

/** 토큰을 스코프별로 캐시 (만료 60초 전까지 재사용) */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

let gisLoadPromise: Promise<void> | null = null;

/* ── GIS 글로벌 타입 (최소 정의) ─────────────────────────────── */

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type?: string; message?: string }) => void;
  prompt?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          revoke?: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

/* ── 스크립트 로더 ─────────────────────────────────────────── */

function loadGisScript(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("브라우저 환경이 아닙니다."));
      return;
    }
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Google Identity Services 스크립트 로드 실패.")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity Services 스크립트 로드 실패."));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

/* ── 메인 API ─────────────────────────────────────────────── */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

/**
 * 지정된 스코프에 대해 Google OAuth 액세스 토큰을 취득한다.
 * 캐시된 토큰이 만료되지 않았다면 재사용한다.
 *
 * @param scope OAuth 스코프 URL (예: "https://www.googleapis.com/auth/bigquery.readonly")
 * @param options.forceConsent true면 캐시 무시하고 동의 화면 강제 표시
 */
export async function requestGoogleAccessToken(
  scope: string,
  options: { forceConsent?: boolean } = {},
): Promise<string> {
  if (!CLIENT_ID) {
    throw new Error(
      "Google OAuth 클라이언트 ID가 설정되지 않았습니다.\n" +
        "관리자에게 NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID 환경변수 등록을 요청하세요.",
    );
  }

  if (!options.forceConsent) {
    const cached = tokenCache.get(scope);
    if (cached && Date.now() < cached.expiresAt - 60_000) {
      return cached.token;
    }
  }

  await loadGisScript();

  return new Promise<string>((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services가 로드되지 않았습니다."));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope,
      callback: (response) => {
        if (response.error) {
          reject(
            new Error(
              `Google OAuth 오류: ${response.error}${response.error_description ? ` — ${response.error_description}` : ""}`,
            ),
          );
          return;
        }
        if (!response.access_token) {
          reject(new Error("액세스 토큰을 받지 못했습니다."));
          return;
        }
        const expiresInMs = (response.expires_in ?? 3600) * 1000;
        tokenCache.set(scope, {
          token: response.access_token,
          expiresAt: Date.now() + expiresInMs,
        });
        resolve(response.access_token);
      },
      error_callback: (err) => {
        reject(new Error(err?.message || err?.type || "Google OAuth 인증이 취소되었습니다."));
      },
    });
    client.requestAccessToken({ prompt: options.forceConsent ? "consent" : "" });
  });
}

/** 캐시된 토큰을 비운다. (스코프 미지정 시 전체) */
export function clearGoogleTokenCache(scope?: string): void {
  if (scope) tokenCache.delete(scope);
  else tokenCache.clear();
}

/** 현재 OAuth 클라이언트 ID가 설정되어 있는지 확인 (UI에서 사전 안내용) */
export function hasGoogleOAuthClientId(): boolean {
  return !!CLIENT_ID;
}
