"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
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
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

/** 로그인 시 users 컬렉션에 프로필 생성/업데이트 */
async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;

  if (snap.exists()) {
    const data = snap.data();
    // 슈퍼관리자 이메일이면 항상 superadmin 역할 보장
    const role: UserRole = isSuperAdmin ? "superadmin" : (data.role ?? "user");
    const needsRoleUpdate = isSuperAdmin && data.role !== "superadmin";

    await setDoc(ref, {
      ...(needsRoleUpdate ? { role: "superadmin" } : {}),
      displayName: user.displayName ?? data.displayName ?? "",
      photoURL: user.photoURL ?? data.photoURL ?? null,
      lastLoginAt: serverTimestamp(),
    }, { merge: true });

    return {
      uid: user.uid,
      email: user.email ?? data.email,
      displayName: user.displayName ?? data.displayName ?? "",
      photoURL: user.photoURL ?? data.photoURL ?? null,
      role,
      isActive: data.isActive ?? true,
      createdAt: data.createdAt,
      lastLoginAt: serverTimestamp(),
    };
  }

  // 신규 사용자 생성
  const newProfile: Omit<UserProfile, "uid"> = {
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    photoURL: user.photoURL ?? null,
    role: isSuperAdmin ? "superadmin" : "user",
    isActive: true,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  await setDoc(ref, newProfile);

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
    } catch {
      // Firestore 접근 실패 시 기본 프로필
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
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const p = await ensureUserProfile(firebaseUser);
          setProfile(p);
        } catch {
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
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const isAdmin = profile ? ADMIN_ROLES.includes(profile.role) : false;
  const isSuperAdmin = profile?.role === "superadmin";

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isSuperAdmin, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
