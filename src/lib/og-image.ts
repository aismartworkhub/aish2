import { loadFeatureFlags } from "@/lib/site-settings-public";

export type OgImageResult =
  | { ok: true; ogImage: string }
  | { ok: false; error: string };

/**
 * GAS Webapp에 외부 URL의 og:image 추출을 요청.
 * gasWebappUrl 미설정 / phase2 비활성 / 에러 시 graceful 실패.
 *
 * 정적 export 환경에서는 클라이언트 직접 fetch가 CORS로 막히므로
 * Google Apps Script Webapp을 우회로로 사용 (gas-client.ts와 동일 패턴).
 */
export async function fetchOgImage(url: string): Promise<OgImageResult> {
  if (!url || !/^https?:\/\//.test(url)) {
    return { ok: false, error: "유효한 URL이 아닙니다" };
  }
  const flags = await loadFeatureFlags();
  if (!flags.phase2.enabled) {
    return { ok: false, error: "Phase 2가 비활성 상태입니다 (관리자 설정 → 기능 플래그)" };
  }
  const gasUrl = flags.phase2.gasWebappUrl;
  if (!gasUrl) {
    return { ok: false, error: "GAS Webapp URL이 설정되지 않았습니다 (관리자 설정 → 외부 연동 또는 Phase 2)" };
  }
  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "fetch-og-image", url }),
    });
    if (!res.ok) {
      return { ok: false, error: `GAS 응답 오류: HTTP ${res.status}` };
    }
    const json = (await res.json()) as { ok?: boolean; ogImage?: string; error?: string };
    if (json.ok && typeof json.ogImage === "string" && json.ogImage.length > 0) {
      return { ok: true, ogImage: json.ogImage };
    }
    return { ok: false, error: json.error || "추출 실패" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "네트워크 오류" };
  }
}
