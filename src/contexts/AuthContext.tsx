"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut, deleteUser } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { SUPER_ADMIN_EMAIL, ADMIN_ROLES, type UserRole } from "@/lib/constants";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: unknown;
  lastLoginAt: unknown;
  // 확장 프로필 필드
  name?: string;
  cohort?: string;
  phone?: string;
  companyName?: string;
  companyProduct?: string;
  companyWebsite?: string;
  companySocial?: string;
  bio?: string;
  interests?: string[];
  socialLinks?: {
    linkedin?: string;
    youtube?: string;
    instagram?: string;
    github?: string;
  };
}

function checkProfileComplete(profile: UserProfile): boolean {
  return !!(profile.name?.trim() && profile.cohort?.trim() && profile.phone?.trim());
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isProfileComplete: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  isProfileComplete: false,
  signOut: async () => {},
  refreshProfile: async () => {},
  deleteAccount: async () => {},
});

const PROFILE_SESSION_KEY = "aish_profile_cache_v1";

function readProfileSession(uid: string): UserProfile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { uid: string; profile: UserProfile };
    if (parsed.uid !== uid || !parsed.profile?.role) return null;
    return parsed.profile;
  } catch {
    return null;
  }
}

function writeProfileSession(uid: string, profile: UserProfile) {
  try {
    sessionStorage.setItem(PROFILE_SESSION_KEY, JSON.stringify({ uid, profile }));
  } catch {
    /* quota / private mode */
  }
}

function clearProfileSession() {
  try {
    sessionStorage.removeItem(PROFILE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** 로그인 시 users 컬렉션에 프로필 생성/업데이트 */
async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, "users", user.uid);
  // #region agent log
  const t0 = Date.now();
  fetch("http://127.0.0.1:7724/ingest/3e7c6e79-c94d-4a95-8003-483776893f4b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "86a510" }, body: JSON.stringify({ sessionId: "86a510", hypothesisId: "H1", location: "AuthContext.tsx:ensureUserProfile", message: "before_getDoc", data: { uidTail: user.uid.slice(-4) }, timestamp: t0, runId: "pre-fix" }) }).catch(() => {});
  // #endregion
  const snap = await getDoc(ref);
  // #region agent log
  fetch("http://127.0.0.1:7724/ingest/3e7c6e79-c94d-4a95-8003-483776893f4b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "86a510" }, body: JSON.stringify({ sessionId: "86a510", hypothesisId: "H1", location: "AuthContext.tsx:ensureUserProfile", message: "after_getDoc", data: { uidTail: user.uid.slice(-4), exists: snap.exists(), msSinceBefore: Date.now() - t0 }, timestamp: Date.now(), runId: "pre-fix" }) }).catch(() => {});
  // #endregion

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;

  if (snap.exists()) {
    const data = snap.data();
    const role: UserRole = isSuperAdmin ? "superadmin" : (data.role ?? "user");
    const needsRoleUpdate = isSuperAdmin && data.role !== "superadmin";

    // non-blocking: 프로필 반환을 지연시키지 않도록 await 하지 않음
    setDoc(ref, {
      ...(needsRoleUpdate ? { role: "superadmin" } : {}),
      displayName: user.displayName ?? data.displayName ?? "",
      photoURL: user.photoURL ?? data.photoURL ?? null,
      lastLoginAt: serverTimestamp(),
    }, { merge: true }).catch(() => {});

    return {
      uid: user.uid,
      email: user.email ?? data.email,
      displayName: user.displayName ?? data.displayName ?? "",
      photoURL: user.photoURL ?? data.photoURL ?? null,
      role,
      isActive: data.isActive ?? true,
      createdAt: data.createdAt,
      lastLoginAt: data.lastLoginAt,
      name: data.name ?? "",
      cohort: data.cohort ?? "",
      phone: data.phone ?? "",
      companyName: data.companyName ?? "",
      companyProduct: data.companyProduct ?? "",
      companyWebsite: data.companyWebsite ?? "",
      companySocial: data.companySocial ?? "",
    };
  }

  // 신규 사용자 생성 (Firestore Rules에서 role='user'만 허용)
  const newProfile: Omit<UserProfile, "uid"> = {
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    photoURL: user.photoURL ?? null,
    role: "user",
    isActive: true,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  await setDoc(ref, newProfile);
  // #region agent log
  fetch("http://127.0.0.1:7724/ingest/3e7c6e79-c94d-4a95-8003-483776893f4b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "86a510" }, body: JSON.stringify({ sessionId: "86a510", hypothesisId: "H3", location: "AuthContext.tsx:ensureUserProfile", message: "new_user_initial_setDoc_done", data: { uidTail: user.uid.slice(-4) }, timestamp: Date.now(), runId: "pre-fix" }) }).catch(() => {});
  // #endregion

  // 슈퍼관리자인 경우 생성 후 role 업데이트 (update 규칙에서 isSuperAdmin()으로 허용됨)
  if (isSuperAdmin) {
    await setDoc(ref, { role: "superadmin" }, { merge: true });
    return { uid: user.uid, ...newProfile, role: "superadmin" as UserRole };
  }

  return { uid: user.uid, ...newProfile };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const p = await ensureUserProfile(user);
      setProfile(p);
      writeProfileSession(user.uid, p);
    } catch {
      setProfile({
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? "",
        photoURL: user.photoURL ?? null,
        role: user.email === SUPER_ADMIN_EMAIL ? "superadmin" : "user",
        isActive: true,
        createdAt: null,
        lastLoginAt: null,
      });
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // #region agent log
      const authT = Date.now();
      fetch("http://127.0.0.1:7724/ingest/3e7c6e79-c94d-4a95-8003-483776893f4b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "86a510" }, body: JSON.stringify({ sessionId: "86a510", hypothesisId: "H2", location: "AuthContext.tsx:onAuthStateChanged", message: "auth_callback", data: { hasUser: !!firebaseUser, uidTail: firebaseUser?.uid?.slice(-4) ?? null }, timestamp: authT, runId: "pre-fix" }) }).catch(() => {});
      // #endregion
      setUser(firebaseUser);
      let closedLoadingEarly = false;
      if (firebaseUser) {
        const cached = readProfileSession(firebaseUser.uid);
        if (cached) {
          setProfile(cached);
          setLoading(false);
          closedLoadingEarly = true;
          // #region agent log
          fetch("http://127.0.0.1:7724/ingest/3e7c6e79-c94d-4a95-8003-483776893f4b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "86a510" }, body: JSON.stringify({ sessionId: "86a510", hypothesisId: "H1", location: "AuthContext.tsx:onAuthStateChanged", message: "session_profile_cache_hit", data: { uidTail: firebaseUser.uid.slice(-4) }, timestamp: Date.now(), runId: "post-fix" }) }).catch(() => {});
          // #endregion
        }
        try {
          const p = await ensureUserProfile(firebaseUser);
          setProfile(p);
          writeProfileSession(firebaseUser.uid, p);
        } catch (e) {
          // #region agent log
          fetch("http://127.0.0.1:7724/ingest/3e7c6e79-c94d-4a95-8003-483776893f4b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "86a510" }, body: JSON.stringify({ sessionId: "86a510", hypothesisId: "H5", location: "AuthContext.tsx:onAuthStateChanged", message: "ensureUserProfile_catch", data: { name: e instanceof Error ? e.name : "unknown" }, timestamp: Date.now(), runId: "pre-fix" }) }).catch(() => {});
          // #endregion
          setProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? "",
            displayName: firebaseUser.displayName ?? "",
            photoURL: firebaseUser.photoURL ?? null,
            role: firebaseUser.email === SUPER_ADMIN_EMAIL ? "superadmin" : "user",
            isActive: true,
            createdAt: null,
            lastLoginAt: null,
          });
        }
      } else {
        setProfile(null);
        clearProfileSession();
      }
      // #region agent log
      fetch("http://127.0.0.1:7724/ingest/3e7c6e79-c94d-4a95-8003-483776893f4b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "86a510" }, body: JSON.stringify({ sessionId: "86a510", hypothesisId: "H2", location: "AuthContext.tsx:onAuthStateChanged", message: "setLoading_false", data: { hadUser: !!firebaseUser, closedLoadingEarly }, timestamp: Date.now(), runId: "post-fix" }) }).catch(() => {});
      // #endregion
      if (!closedLoadingEarly) {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    clearProfileSession();
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const deleteAccount = async () => {
    if (!user) throw new Error("로그인되지 않았습니다.");
    // Firestore 프로필 삭제
    clearProfileSession();
    await deleteDoc(doc(db, "users", user.uid));
    // Firebase Auth 계정 삭제 (본인만 가능)
    await deleteUser(user);
    setProfile(null);
  };

  const isAdmin = profile ? ADMIN_ROLES.includes(profile.role) : false;
  const isSuperAdmin = profile?.role === "superadmin";
  const isProfileComplete = profile ? checkProfileComplete(profile) : false;

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isSuperAdmin, isProfileComplete, signOut, refreshProfile, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
