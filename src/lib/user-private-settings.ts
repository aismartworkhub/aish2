/**
 * 사용자 비공개 설정 (관리자도 읽을 수 없음) — Gemini API 키 등.
 * 경로: users/{uid}/private/settings
 */
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const USER_PRIVATE_SUBCOLLECTION = "private";
export const USER_PRIVATE_SETTINGS_DOC_ID = "settings";

export function userPrivateSettingsRef(uid: string) {
  return doc(db, "users", uid, USER_PRIVATE_SUBCOLLECTION, USER_PRIVATE_SETTINGS_DOC_ID);
}

export async function loadUserGeminiApiKey(uid: string): Promise<string> {
  const snap = await getDoc(userPrivateSettingsRef(uid));
  if (!snap.exists()) return "";
  const v = snap.data()?.geminiApiKey;
  return typeof v === "string" ? v : "";
}

export async function saveUserGeminiApiKey(uid: string, geminiApiKey: string): Promise<void> {
  await setDoc(
    userPrivateSettingsRef(uid),
    { geminiApiKey: geminiApiKey.trim(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function deleteUserPrivateSettings(uid: string): Promise<void> {
  try {
    await deleteDoc(userPrivateSettingsRef(uid));
  } catch {
    /* 없으면 무시 */
  }
}
