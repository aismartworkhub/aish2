import type {
  RunmoaContent,
  RunmoaContentsParams,
  RunmoaContentsResponse,
  RunmoaCategory,
} from "@/types/runmoa";

/* ── 설정 ── */
const RUNMOA_BASE = "https://aish.runmoa.com";
const RUNMOA_API = `${RUNMOA_BASE}/api/public/v1`;
const API_KEY = process.env.NEXT_PUBLIC_RUNMOA_API_KEY ?? "";

/* ── 관리자 URL 헬퍼 ── */
export const RUNMOA_ADMIN_ADD_URL = `${RUNMOA_BASE}/admin/contents/add`;
export function runmoaAdminEditUrl(contentId: number): string {
  return `${RUNMOA_BASE}/admin/contents/${contentId}`;
}

/* ── 인메모리 캐시 (30s TTL, firestore.ts 패턴 동일) ── */
const CACHE_TTL = 30_000;
const cache = new Map<string, { ts: number; data: unknown }>();

function fromCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data as T;
  return null;
}

function toCache(key: string, data: unknown) {
  cache.set(key, { ts: Date.now(), data });
}

export function invalidateRunmoaCache() {
  cache.clear();
}

/* ── 공통 fetch ── */
async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${RUNMOA_API}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }

  const cacheKey = url.toString();
  const cached = fromCache<T>(cacheKey);
  if (cached) return cached;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    throw new Error(`Runmoa API ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as T;
  toCache(cacheKey, data);
  return data;
}

/* ── 콘텐츠 목록 ── */
export async function getRunmoaContents(
  params: RunmoaContentsParams = {}
): Promise<RunmoaContentsResponse> {
  const q: Record<string, string> = {};
  if (params.page) q.page = String(params.page);
  if (params.limit) q.limit = String(params.limit);
  if (params.status) q.status = params.status;
  if (params.content_type) q.content_type = params.content_type;
  if (params.category_id) q.category_id = String(params.category_id);
  if (params.search) q.search = params.search;

  return apiFetch<RunmoaContentsResponse>("/contents", q);
}

/* ── 콘텐츠 단건 조회 ── */
export async function getRunmoaContentById(
  contentId: number
): Promise<RunmoaContent> {
  return apiFetch<RunmoaContent>(`/contents/${contentId}`);
}

/* ── 카테고리 목록 ── */
export async function getRunmoaCategories(): Promise<RunmoaCategory[]> {
  return apiFetch<RunmoaCategory[]>("/content-categories");
}
