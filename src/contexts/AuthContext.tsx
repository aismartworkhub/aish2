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

/** 로그인 시 users 컬렉션에 프로필 생성/업데이트 */
async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;

  if (snap.exists()) {
    const data = snap.data();
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
      name: data.name ?? "",
      cohort: data.cohort ?? "",
      phone: data.phone ?? "",
      companyName: data.companyName ?? "",
      companyProduct: data.companyProduct ?? "",
      companyWebsite: data.companyWebsite ?? "",
      companySocial: data.companySocial ?? "",
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

  const deleteAccount = async () => {
    if (!user) throw new Error("로그인되지 않았습니다.");
    // Firestore 프로필 삭제
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
