/**
 * YouTube Data API v3 일일 쿼터 추적.
 * - Firestore: siteSettings/youtube-quota = { date: "YYYY-MM-DD" (KST), used: number }
 * - 매일 KST 자정 기준으로 자동 리셋 (date 비교)
 * - YouTube 무료 쿼터 10,000 단위/일
 */

import { doc, getDoc, setDoc, increment } from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS } from "./firestore";

const DOC_ID = "youtube-quota";

export const YOUTUBE_DAILY_LIMIT = 10000;
export const YOUTUBE_WARN_THRESHOLD = 9000;
export const YOUTUBE_BLOCK_THRESHOLD = 9800;

function todayKst(): string {
  const now = new Date();
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

export async function getYoutubeQuotaToday(): Promise<{ used: number; date: string }> {
  const today = todayKst();
  const ref = doc(db, COLLECTIONS.SETTINGS, DOC_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { used: 0, date: today };
  const data = snap.data() as { date?: string; used?: number };
  if (data.date !== today) return { used: 0, date: today };
  return { used: data.used ?? 0, date: today };
}

export async function incrementYoutubeQuota(units: number): Promise<void> {
  if (units <= 0) return;
  const today = todayKst();
  const ref = doc(db, COLLECTIONS.SETTINGS, DOC_ID);
  const snap = await getDoc(ref);
  const sameDay = snap.exists() && (snap.data() as { date?: string }).date === today;
  if (sameDay) {
    await setDoc(ref, { date: today, used: increment(units), updatedAt: new Date().toISOString() }, { merge: true });
  } else {
    await setDoc(ref, { date: today, used: units, updatedAt: new Date().toISOString() });
  }
}
