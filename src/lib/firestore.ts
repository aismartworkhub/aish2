import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  DocumentData,
  WithFieldValue,
} from "firebase/firestore";
import { db } from "./firebase";

// Tenant path resolver
// Default: flat collections (e.g., "programs")
// Multi-tenant: "tenants/{tenantId}/programs"
let _tenantPrefix = "";

export function setTenantPrefix(tenantId: string | null) {
  _tenantPrefix = tenantId ? `tenants/${tenantId}/` : "";
}

function resolveCol(col: string): string {
  return `${_tenantPrefix}${col}`;
}

// Generic helpers

export async function getCollection<T>(col: string): Promise<T[]> {
  const snap = await getDocs(collection(db, col));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

export async function getOrderedCollection<T>(col: string, field: string, dir: "asc" | "desc" = "asc"): Promise<T[]> {
  const q = query(collection(db, col), orderBy(field, dir));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

export async function createDoc<T extends DocumentData>(col: string, data: WithFieldValue<T>): Promise<string> {
  const ref = await addDoc(collection(db, col), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function upsertDoc<T extends DocumentData>(col: string, id: string, data: WithFieldValue<T>): Promise<void> {
  await setDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateDocFields<T extends DocumentData>(col: string, id: string, data: Partial<T>): Promise<void> {
  await updateDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() } as DocumentData);
}

export async function removeDoc(col: string, id: string): Promise<void> {
  await deleteDoc(doc(db, col, id));
}

export async function getDocById<T>(col: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, col, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

export async function getSingletonDoc<T>(col: string, id: string): Promise<T | null> {
  return getDocById<T>(col, id);
}

export async function setSingletonDoc<T extends DocumentData>(col: string, id: string, data: WithFieldValue<T>): Promise<void> {
  await setDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() });
}

// Collection name constants
export const COLLECTIONS = {
  BANNERS: "banners",
  PROGRAMS: "programs",
  VIDEOS: "videos",
  POSTS: "posts",
  INQUIRIES: "inquiries",
  FAQ: "faq",
  PARTNERS: "partners",
  PARTNER_APPLICATIONS: "partnerApplications",
  REVIEWS: "reviews",
  EVENTS: "events",
  GALLERY: "gallery",
  CERTIFICATES_COHORTS: "certificateCohorts",
  CERTIFICATES_GRADUATES: "certificateGraduates",
  CERTIFICATES_REQUESTS: "certificateRequests",
  SETTINGS: "siteSettings",
  INSTRUCTORS: "instructors",
  HISTORY: "history",
  ADMINS: "admins",
} as const;
