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
// 스토어프론트 API — 공개키(브라우저 삽입 안전, CORS 허용). 실시간 직접 호출용.
const STOREFRONT_API = `${RUNMOA_BASE}/api/storefront/v1`;
const SITE_KEY = process.env.NEXT_PUBLIC_RUNMOA_SITE_KEY ?? "";

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

/* ── 스토어프론트(실시간, 공개키) → RunmoaContent 매핑 ──
   스토어프론트 응답은 내부 원시 구조라 카드가 쓰는 정규 형태로 변환한다. */
type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
const asNum = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
};
/** { data: [{ src }] } 형태에서 첫 이미지 URL 추출 */
const firstImageSrc = (v: unknown): string => {
  const data = asRec(v).data;
  if (Array.isArray(data) && data.length > 0) return asStr(asRec(data[0]).src);
  return "";
};

function mapStorefrontProduct(p: Rec): RunmoaContent {
  const id = asNum(p.id);
  const det = asRec(p.details);
  const priceArr = det.price;
  const priceRow = Array.isArray(priceArr) ? asRec(priceArr[0]) : {};
  const base = asNum(priceRow.base_price);
  const sale = asNum(priceRow.sale_price);
  const onSale = priceRow.is_on_sale === 1 || priceRow.is_on_sale === true;
  const image = firstImageSrc(asRec(det.main_image).image_url) || asStr(p.thumbnail_link);
  return {
    content_id: id,
    title: asStr(asRec(det.translation).name),
    description_html: "",
    content_type: "offline",
    status: (asStr(p.status) || "publish") as RunmoaContent["status"],
    language: "ko",
    category_ids: p.category_id != null ? [asNum(p.category_id)] : [],
    categories: [],
    featured_image: image,
    images: [],
    thumbnail_link: asStr(p.thumbnail_link) || null,
    base_price: base,
    sale_price: sale,
    is_on_sale: onSale,
    is_free: base === 0 && sale === 0,
    options: [],
    created_at: asStr(p.arrange_at) || asStr(p.created_at),
    updated_at: asStr(p.updated_at),
    detail_url: `${RUNMOA_BASE}/products/${id}`,
  };
}

function mapStorefrontContent(c: Rec): RunmoaContent {
  const id = asNum(c.ID ?? c.id);
  const price = asNum(c.price);
  const image = firstImageSrc(c.img) || asStr(c.thumbnail_link);
  return {
    content_id: id,
    title: asStr(c.title),
    description_html: "",
    content_type: (asStr(c.type) || "offline") as RunmoaContent["content_type"],
    status: (asStr(c.status) || "publish") as RunmoaContent["status"],
    language: "ko",
    category_ids: [],
    categories: [],
    featured_image: image,
    images: [],
    thumbnail_link: asStr(c.thumbnail_link) || null,
    base_price: price,
    sale_price: 0,
    is_on_sale: false,
    is_free: price === 0,
    options: [],
    created_at: asStr(c.arrange_at) || asStr(c.created_at),
    updated_at: asStr(c.updated_at),
    detail_url: `${RUNMOA_BASE}/classes/${id}`,
  };
}

async function fetchStorefrontList(resource: "products" | "contents"): Promise<Rec[]> {
  const res = await fetch(`${STOREFRONT_API}/${resource}?limit=100`, {
    headers: { Accept: "application/json", "X-Runmoa-Site-Key": SITE_KEY },
  });
  if (!res.ok) throw new Error(`storefront ${resource} ${res.status}`);
  const json = (await res.json()) as Rec;
  const wrap = asRec(resource === "products" ? json.products : json.classes);
  const list = wrap.data;
  return Array.isArray(list) ? (list as Rec[]) : [];
}

/** 스토어프론트에서 상품+콘텐츠를 실시간 조회해 정규 형태로 반환 (공개키 없으면 빈 배열) */
async function loadStorefrontPrograms(): Promise<RunmoaContent[]> {
  if (!SITE_KEY) return [];
  const cacheKey = "storefront-programs";
  const cached = fromCache<RunmoaContent[]>(cacheKey);
  if (cached) return cached;
  const [products, contents] = await Promise.all([
    fetchStorefrontList("products").catch(() => [] as Rec[]),
    fetchStorefrontList("contents").catch(() => [] as Rec[]),
  ]);
  const mapped = [
    ...products.map(mapStorefrontProduct),
    ...contents.map(mapStorefrontContent),
  ].filter((x) => x.content_id > 0 && x.title);
  // content_id 기준 중복 제거 (먼저 온 항목 유지)
  const byId = new Map<number, RunmoaContent>();
  mapped.forEach((m) => { if (!byId.has(m.content_id)) byId.set(m.content_id, m); });
  const result = Array.from(byId.values());
  toCache(cacheKey, result);
  return result;
}

/* ── 콘텐츠 목록 ── */
export async function getRunmoaContents(
  params: RunmoaContentsParams = {}
): Promise<RunmoaContentsResponse> {
  // 0) 실시간 — 스토어프론트 공개키 브라우저 직접 호출, 실패 시 1) Firestore 미러(cron)로 폴백
  let base: RunmoaContent[] = [];
  try {
    base = await loadStorefrontPrograms();
  } catch { /* 폴백 진행 */ }
  if (base.length === 0) base = await loadProgramsMirror();

  if (base.length > 0) {
    let items = base;
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
