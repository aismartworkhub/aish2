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
  where,
  serverTimestamp,
  DocumentData,
  WithFieldValue,
} from "firebase/firestore";
import { db } from "./firebase";

// In-memory cache (stale-while-revalidate)
const CACHE_TTL = 30_000; // 30초 내 재요청은 캐시 반환
const _cache = new Map<string, { data: unknown[]; ts: number }>();

export function invalidateCache(col: string) {
  for (const key of _cache.keys()) {
    if (key === col || key.startsWith(`${col}__`)) {
      _cache.delete(key);
    }
  }
}

// Generic helpers

export async function getCollection<T>(col: string): Promise<T[]> {
  const cached = _cache.get(col);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as T[];
  }
  const snap = await getDocs(collection(db, col));
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
  _cache.set(col, { data: result, ts: Date.now() });
  return result;
}

export async function getOrderedCollection<T>(col: string, field: string, dir: "asc" | "desc" = "asc"): Promise<T[]> {
  const cacheKey = `${col}__${field}__${dir}`;
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as T[];
  }
  const q = query(collection(db, col), orderBy(field, dir));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
  _cache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}

export async function getFilteredCollection<T>(
  col: string,
  field: string,
  value: string,
): Promise<T[]> {
  const cacheKey = `${col}__${field}__${value}`;
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as T[];
  }
  const q = query(collection(db, col), where(field, "==", value));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
  _cache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}

export async function createDoc<T extends DocumentData>(col: string, data: WithFieldValue<T>): Promise<string> {
  const ref = await addDoc(collection(db, col), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  invalidateCache(col);
  return ref.id;
}

export async function upsertDoc<T extends DocumentData>(col: string, id: string, data: WithFieldValue<T>): Promise<void> {
  await setDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  invalidateCache(col);
}

export async function updateDocFields<T extends DocumentData>(col: string, id: string, data: Partial<T>): Promise<void> {
  await updateDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() } as DocumentData);
  invalidateCache(col);
}

export async function removeDoc(col: string, id: string): Promise<void> {
  await deleteDoc(doc(db, col, id));
  invalidateCache(col);
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
  invalidateCache(col);
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
  USERS: "users",
  ADMIN_EVENTS: "adminEvents",
  RESOURCES: "resources",
  INSTRUCTOR_COMMENTS: "instructorComments",
  POST_COMMENTS: "postComments",
  LIKES: "likes",
  BOOKMARKS: "bookmarks",
  NOTIFICATIONS: "notifications",
} as const;
