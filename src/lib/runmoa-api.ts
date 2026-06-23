import { getSingletonDoc, COLLECTIONS } from "@/lib/firestore";
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

/* ── Firestore 미러 (Runmoa가 브라우저 직접요청을 403 차단하므로 우선 사용) ──
   cron(서버)이 siteSettings/runmoa-programs 에 매일 저장한 공개 프로그램 목록. */
async function loadProgramsMirror(): Promise<RunmoaContent[]> {
  try {
    const doc = await getSingletonDoc<{ items?: RunmoaContent[] }>(COLLECTIONS.SETTINGS, "runmoa-programs");
    return doc?.items ?? [];
  } catch {
    return [];
  }
}

/* ── 콘텐츠 목록 ── */
export async function getRunmoaContents(
  params: RunmoaContentsParams = {}
): Promise<RunmoaContentsResponse> {
  // 1) Firestore 미러 우선 — 브라우저에서 Runmoa 직접 호출은 403이므로 미러로 서빙
  const mirror = await loadProgramsMirror();
  if (mirror.length > 0) {
    let items = mirror;
    if (params.status) items = items.filter((c) => c.status === params.status);
    if (params.content_type) items = items.filter((c) => c.content_type === params.content_type);
    if (params.category_id) items = items.filter((c) => c.category_ids?.includes(Number(params.category_id)));
    if (params.search) {
      const term = params.search.toLowerCase();
      items = items.filter((c) => c.title.toLowerCase().includes(term));
    }
    const perPage = params.limit ?? (items.length || 1);
    const page = params.page ?? 1;
    const start = (page - 1) * perPage;
    const paged = items.slice(start, start + perPage);
    return {
      data: paged,
      pagination: {
        current_page: page,
        per_page: perPage,
        total: items.length,
        last_page: Math.max(1, Math.ceil(items.length / perPage)),
        from: items.length ? start + 1 : 0,
        to: start + paged.length,
        has_more_pages: start + perPage < items.length,
      },
    };
  }

  // 2) 폴백 — 직접 API (서버/허용 환경. 브라우저에서는 403 가능)
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
  // 미러 프로그램들의 카테고리에서 고유 목록 파생 (브라우저 403 회피)
  const mirror = await loadProgramsMirror();
  if (mirror.length > 0) {
    const unique = new Map<number, RunmoaCategory>();
    mirror.forEach((c) => (c.categories ?? []).forEach((cat) => unique.set(cat.category_id, cat)));
    if (unique.size > 0) return Array.from(unique.values());
  }
  // 폴백 — 직접 API
  return apiFetch<RunmoaCategory[]>("/content-categories");
}
