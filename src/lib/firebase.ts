import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
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

// Only initialize if we have a valid config (prevents build-time crash)
const app =
  getApps().length === 0
    ? initializeApp(
        firebaseConfig.apiKey ? firebaseConfig : { ...firebaseConfig, apiKey: "dummy" }
      )
    : getApps()[0];

/** 브라우저: IndexedDB 로컬 캐시로 Firestore 읽기 지연 완화. SSR/빌드: 메모리 전용. */
function createFirestore() {
  if (typeof window === "undefined") {
    return getFirestore(app);
  }
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
}

export const db = createFirestore();
export const auth = getAuth(app);
export default app;
