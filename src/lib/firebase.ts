import { initializeApp, getApps } from "firebase/app";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
 apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
 authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
 projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
 storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
 messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
 appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isFirstInit = getApps().length === 0;
const app = isFirstInit
  ? initializeApp(
      firebaseConfig.apiKey ? firebaseConfig : { ...firebaseConfig, apiKey: "dummy" }
    )
  : getApps()[0];

/**
 * Firestore 초기화 — IndexedDB 영구 캐시 활성화.
 * - 재방문 시 같은 쿼리는 IndexedDB에서 즉시 반환 → 첫 표시 가속
 * - 백그라운드에서 서버와 sync (stale-while-revalidate)
 * - 멀티 탭 동기화 지원
 * - SSR/빌드 시점에 indexedDB 미존재로 throw할 수 있어 try/catch로 폴백
 */
function createDb() {
  try {
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // SSR · 첫 호출 외 호출 · IndexedDB 미지원 환경 폴백
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  }
}

export const db = isFirstInit ? createDb() : getFirestore(app);
export const auth = getAuth(app);
export default app;
