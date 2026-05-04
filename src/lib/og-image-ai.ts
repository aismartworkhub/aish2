export type OgImageResult =
  | { ok: true; ogImage: string }
  | { ok: false; error: string };

/**
 * Gemini 2.5 Flash + URL Context 도구로 외부 URL에서 og:image 메타 태그를 추출.
 *
 * 정적 export 환경에서 클라이언트 fetch는 CORS로 막히는데,
 * Gemini의 URL Context 도구는 Google 인프라 측에서 페이지를 fetch하므로
 * 별도 우회로(GAS 등) 없이 추출 가능. Gemini API 키는 이미 프로젝트에 등록됨.
 *
 * 무료 한도: gemini-2.5-flash 일 1500 RPD — 관리자 추출 트래픽 충분 커버.
 */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const PROMPT = (url: string) =>
  `다음 웹페이지를 읽어 og:image (또는 twitter:image) 메타 태그의 절대 URL을 찾아줘.
응답은 반드시 한 줄 JSON으로만 출력:
{"ogImage":"https://...절대URL..."} 또는 {"ogImage":null}

웹페이지 URL: ${url}`;

export async function extractOgImageWithAI(url: string): Promise<OgImageResult> {
  if (!url || !/^https?:\/\//.test(url)) {
    return { ok: false, error: "유효한 URL이 아닙니다" };
  }
  // 동적 import — Gemini SDK 모듈을 호출 시점에만 로드 (chunk 분리, 페이지 초기 로드 부담 ↓)
  const { getGeminiApiKey } = await import("@/lib/gemini");
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    return { ok: false, error: "Gemini API 키가 설정되지 않았습니다 (관리자 설정 → 외부 연동)" };
  }

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT(url) }] }],
        // URL Context 도구 — Gemini가 URL 자체를 fetch해서 콘텐츠 활용
        tools: [{ url_context: {} }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: `Gemini API 오류 ${res.status}: ${errBody.slice(0, 200)}` };
    }

    const json = await res.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { ok: false, error: "Gemini 응답이 비어있습니다" };
    }

    let parsed: { ogImage?: string | null };
    try {
      parsed = JSON.parse(text);
    } catch {
      // JSON이 아니면 응답 자체에 URL이 끼어 있을 수 있음 — 정규식 보강
      const m = text.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?[^\s"']*)?/i);
      if (m) return { ok: true, ogImage: m[0] };
      return { ok: false, error: "응답을 해석할 수 없습니다" };
    }

    if (parsed.ogImage && typeof parsed.ogImage === "string" && /^https?:\/\//.test(parsed.ogImage)) {
      return { ok: true, ogImage: parsed.ogImage };
    }
    return { ok: false, error: "og:image를 찾을 수 없습니다" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "네트워크 오류" };
  }
}
