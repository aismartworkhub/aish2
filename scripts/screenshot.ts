/**
 * 외부 URL 화면 캡처 (cron 전용).
 *
 * Phase 4 fallback 체인의 중간 단계 — og:image 추출 실패 시 사이트 본문 시각을
 * 직접 캡처해 썸네일로 사용. AI 이미지 생성보다 글 내용 충실도 높음.
 *
 * @sparticuz/chromium은 GitHub Actions ubuntu에서 검증된 헤드리스 Chromium.
 * puppeteer-core는 Chromium 다운로드 없는 가벼운 패키지.
 */

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const VIEWPORT = { width: 1280, height: 720 };  // 16:9
const NAV_TIMEOUT_MS = 15000;

export type ScreenshotResult =
  | { ok: true; buffer: Buffer; mimeType: "image/jpeg" }
  | { ok: false; error: string };

/**
 * URL을 16:9 뷰포트로 열고 첫 화면 캡처. 페이지 로드는 networkidle2로 안정화.
 * 실패 시 graceful — 호출자가 다른 fallback(AI 생성 등)으로 진행.
 */
export async function captureUrl(url: string): Promise<ScreenshotResult> {
  if (!url || !/^https?:\/\//.test(url)) {
    return { ok: false, error: "유효한 URL이 아닙니다" };
  }
  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: VIEWPORT,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (compatible; AISH-bot/1.0)");
    await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });

    // 일부 사이트의 쿠키 배너·로그인 모달 제거 시도 (best effort)
    await page.evaluate(() => {
      const selectors = [
        '[id*="cookie"]', '[class*="cookie"]',
        '[id*="consent"]', '[class*="consent"]',
        '[role="dialog"]',
      ];
      for (const s of selectors) {
        document.querySelectorAll(s).forEach((el) => (el as HTMLElement).remove?.());
      }
    }).catch(() => undefined);

    const screenshot = await page.screenshot({
      type: "jpeg",
      quality: 75,
      clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
    });
    await browser.close();
    browser = undefined;

    return { ok: true, buffer: Buffer.from(screenshot), mimeType: "image/jpeg" };
  } catch (e) {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    return { ok: false, error: e instanceof Error ? e.message : "캡처 실패" };
  }
}
