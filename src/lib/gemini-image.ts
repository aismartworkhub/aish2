/**
 * Gemini 2.5 Flash Image API — 글 내용 기반 AI 썸네일 생성.
 *
 * 호출 결과는 data URL 문자열(`data:image/png;base64,...`)로 반환.
 * 호출처는 그대로 Content.thumbnailUrl에 저장하면 카드 렌더링 시 <img> 태그에서 정상 노출됨.
 *
 * 무료 한도: gemini-2.5-flash-image-preview는 일 한도 모델 시점·계정에 따라 다름.
 * Phase 3.5 categorySettings.maxPerRun과 함께 쓰면 무료 한도 안전.
 *
 * 참고:
 * - 더 큰 사이트 통합 시 Phase 4-B/4-C에서 Drive 업로드로 전환하면 Firestore doc 크기 부담 ↓.
 * - 첫 v1은 base64 data URL 직접 저장이 가장 단순.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent";

export type GenerateImageResult =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string };

/**
 * 글의 제목·본문·태그를 prompt로 사용해 시각화 이미지를 생성한다.
 * - 16:9 영상 비율 (썸네일 자리에 자연스럽게 들어감)
 * - 텍스트가 들어가지 않는 추상/아이콘 톤 — 한국어 제목 직접 그리기는 부정확
 */
export async function generateThumbnailImage(opts: {
  apiKey: string;
  title: string;
  body?: string;
  tags?: string[];
  category?: string;
}): Promise<GenerateImageResult> {
  if (!opts.apiKey) return { ok: false, error: "Gemini API 키가 없습니다" };
  const summary = (opts.body ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
  const tagLine = opts.tags?.length ? `Keywords: ${opts.tags.slice(0, 5).join(", ")}.` : "";
  const categoryLine = opts.category ? `Category: ${opts.category}.` : "";

  const prompt = [
    `Generate a clean, professional 16:9 thumbnail illustration that visualizes the following blog/article content.`,
    `Style: minimalist abstract or iconic, soft gradient background, subtle modern aesthetic, no text or letters.`,
    `Subject: ${opts.title}.`,
    summary ? `Summary: ${summary}` : "",
    tagLine,
    categoryLine,
    `Avoid: photorealism, watermarks, logos, copyrighted characters, text overlays.`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(opts.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: `Gemini Image ${res.status}: ${errBody.slice(0, 200)}` };
    }
    const json = await res.json();
    // 응답 구조: candidates[0].content.parts[N].inlineData = { mimeType, data: base64 }
    const parts: Array<{ inlineData?: { mimeType?: string; data?: string } }> =
      json?.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      const d = p.inlineData;
      if (d?.data && d?.mimeType) {
        return { ok: true, dataUrl: `data:${d.mimeType};base64,${d.data}` };
      }
    }
    return { ok: false, error: "응답에 이미지 데이터가 없습니다" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "네트워크 오류" };
  }
}
