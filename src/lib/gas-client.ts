import { loadFeatureFlags } from "@/lib/site-settings-public";

type GasRequestType = "welcome-email" | "admin-notify" | "business-card";

interface GasResponse {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

/**
 * Apps Script 웹 앱 호출 래퍼.
 * Feature Flag가 비활성이거나 URL이 없으면 무시(no-op).
 */
export async function callGasWebapp(
  type: GasRequestType,
  payload: Record<string, unknown>,
): Promise<GasResponse | null> {
  const flags = await loadFeatureFlags();
  if (!flags.phase2.enabled) return null;

  const url = flags.phase2.gasWebappUrl;
  if (!url) return null;

  if (type === "welcome-email" && flags.phase2.welcomeEmail !== true) return null;
  if (type === "business-card" && flags.phase2.businessCardDrive !== true) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...payload }),
    });
    return (await res.json()) as GasResponse;
  } catch {
    return null;
  }
}
