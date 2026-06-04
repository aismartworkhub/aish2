/**
 * 상담 AI RAG (검색 증강) — 콘텐츠를 임베딩 색인하고, 질문마다 관련 조각만 검색해 주입한다.
 *
 * - 임베딩: Gemini text-embedding-004 (출력 256차원으로 축소 → 1MiB 문서에 안전).
 * - 저장: siteSettings/ai-index 단일 문서 { chunks:[{id,text,source,vector}], count, dims, model }.
 *   (규칙상 공개읽기/admin쓰기. 상담 세션당 1 read + 인메모리 코사인.)
 * - 색인은 관리자 "재색인"으로 갱신. 콘텐츠(과정 등)는 자동 주입도 병행하므로, RAG는 보강 역할.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCollection, getSingletonDoc, setSingletonDoc, COLLECTIONS } from "@/lib/firestore";
import { getRunmoaContents } from "@/lib/runmoa-api";
import type { Instructor } from "@/types/firestore";
import type { BusinessInfoConfig } from "@/lib/site-settings-public";
import type { AiKnowledge } from "@/lib/ai-counselor-context";

const EMBED_MODEL = "text-embedding-004";
const EMBED_DIMS = 256;
const MAX_CHUNKS = 120;
const CHUNK_CHARS = 700;
const BATCH_SIZE = 100;
const RETRIEVE_K = 6;
const MIN_SCORE = 0.3;
const PROGRAM_DESC_MAX = 400;

export interface RagChunk {
  id: string;
  text: string;
  source: string;
  vector: number[];
}
interface RagIndexDoc {
  chunks: RagChunk[];
  count: number;
  dims: number;
  model: string;
}

/* ── 텍스트 청크 ── */
function chunkText(text: string): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (clean.length <= CHUNK_CHARS) return clean ? [clean] : [];
  const paras = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if ((buf + "\n\n" + p).length > CHUNK_CHARS) {
      if (buf) chunks.push(buf.trim());
      if (p.length > CHUNK_CHARS) {
        for (let i = 0; i < p.length; i += CHUNK_CHARS) chunks.push(p.slice(i, i + CHUNK_CHARS).trim());
        buf = "";
      } else {
        buf = p;
      }
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}
function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

/* ── Gemini 임베딩 ── */
function embedder(apiKey: string) {
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: EMBED_MODEL });
}

async function embedTexts(apiKey: string, texts: string[]): Promise<number[][]> {
  const model = embedder(apiKey);
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await model.batchEmbedContents({
      requests: batch.map((t) => ({
        content: { role: "user", parts: [{ text: t }] },
        outputDimensionality: EMBED_DIMS,
      })),
    });
    for (const e of res.embeddings) out.push((e.values ?? []).map(round6));
  }
  return out;
}

async function embedQuery(apiKey: string, text: string): Promise<number[]> {
  const res = await embedder(apiKey).embedContent({
    content: { role: "user", parts: [{ text }] },
    outputDimensionality: EMBED_DIMS,
  });
  return res.embedding.values ?? [];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/* ── 색인 소스 수집 ── */
async function gatherRagSources(): Promise<{ text: string; source: string }[]> {
  const out: { text: string; source: string }[] = [];

  try {
    const kn = await getSingletonDoc<Partial<AiKnowledge>>(COLLECTIONS.SETTINGS, "ai-knowledge");
    for (const [src, val] of [
      ["관리자지식", kn?.manual],
      ["드라이브자료", kn?.drive],
      ["유튜브", kn?.youtube],
    ] as const) {
      if (val?.trim()) for (const c of chunkText(val)) out.push({ text: c, source: src });
    }
  } catch { /* skip */ }

  try {
    const res = await getRunmoaContents({ status: "publish", limit: 100 });
    for (const c of res?.data ?? []) {
      const cats = (c.categories ?? []).map((x) => x.name).filter(Boolean).join(", ");
      const price = c.is_free ? "무료" : c.is_on_sale && c.sale_price > 0 ? `${c.sale_price.toLocaleString("ko-KR")}원` : c.base_price > 0 ? `${c.base_price.toLocaleString("ko-KR")}원` : "";
      const desc = stripHtml(c.description_html ?? "").slice(0, PROGRAM_DESC_MAX);
      out.push({ text: `[교육과정] ${c.title}${cats ? ` · ${cats}` : ""}${price ? ` · ${price}` : ""}${desc ? `\n${desc}` : ""}`, source: "과정" });
    }
  } catch { /* skip */ }

  try {
    const faq = await getCollection<{ question?: string; answer?: string }>(COLLECTIONS.FAQ);
    for (const f of faq) if (f.question?.trim()) out.push({ text: `[FAQ] Q: ${f.question}\nA: ${f.answer ?? ""}`, source: "FAQ" });
  } catch { /* skip */ }

  try {
    const ins = await getCollection<Instructor>(COLLECTIONS.INSTRUCTORS);
    for (const i of ins) {
      if (i.isActive === false || !i.name?.trim()) continue;
      const org = [i.title, i.organization].filter((v) => v?.trim()).join(" · ");
      const sp = i.specialties?.length ? `\n전문: ${i.specialties.join(", ")}` : "";
      const bio = i.bio?.trim() ? `\n${i.bio.trim().slice(0, 300)}` : "";
      out.push({ text: `[강사] ${i.name}${org ? ` (${org})` : ""}${sp}${bio}`, source: "강사" });
    }
  } catch { /* skip */ }

  try {
    const biz = await getSingletonDoc<BusinessInfoConfig>(COLLECTIONS.SETTINGS, "business");
    if (biz) {
      const lines = [biz.companyName && `상호 ${biz.companyName}`, biz.address && `주소 ${biz.address}`, biz.phone && `고객센터 ${biz.phone}`, biz.email && `이메일 ${biz.email}`].filter(Boolean).join(" · ");
      if (lines) out.push({ text: `[사업자정보] ${lines}`, source: "사업자" });
    }
  } catch { /* skip */ }

  return out.slice(0, MAX_CHUNKS);
}

/* ── 색인 생성 ── */
export async function buildRagIndex(apiKey: string): Promise<{ count: number }> {
  const sources = await gatherRagSources();
  if (sources.length === 0) throw new Error("색인할 콘텐츠가 없습니다. (과정·FAQ·강사·AI 지식 확인)");
  const vectors = await embedTexts(apiKey, sources.map((s) => s.text));
  const chunks: RagChunk[] = sources.map((s, i) => ({ id: String(i), text: s.text, source: s.source, vector: vectors[i] ?? [] }));
  await setSingletonDoc(COLLECTIONS.SETTINGS, "ai-index", {
    chunks,
    count: chunks.length,
    dims: vectors[0]?.length ?? EMBED_DIMS,
    model: EMBED_MODEL,
  });
  invalidateRagIndexCache();
  return { count: chunks.length };
}

/* ── 색인 로드 / 검색 ── */
let cache: RagIndexDoc | null = null;
let inflight: Promise<RagIndexDoc | null> | null = null;

async function loadRagIndex(): Promise<RagIndexDoc | null> {
  if (cache) return cache;
  if (!inflight) {
    inflight = getSingletonDoc<RagIndexDoc>(COLLECTIONS.SETTINGS, "ai-index")
      .then((d) => {
        cache = d && Array.isArray(d.chunks) ? d : null;
        return cache;
      })
      .catch(() => null)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function invalidateRagIndexCache(): void {
  cache = null;
  inflight = null;
}

/** 색인 메타(관리자 UI 표시용). */
export async function getRagIndexInfo(): Promise<{ count: number } | null> {
  const idx = await loadRagIndex();
  return idx ? { count: idx.count ?? idx.chunks.length } : null;
}

/**
 * 질문과 관련된 조각을 검색해 시스템 프롬프트용 텍스트 블록으로 반환한다.
 * 색인이 없거나 실패하면 "" (기존 동작 유지 — 무중단).
 */
export async function retrieveRagContext(apiKey: string, query: string, k = RETRIEVE_K): Promise<string> {
  try {
    const idx = await loadRagIndex();
    if (!idx?.chunks?.length) return "";
    const qv = await embedQuery(apiKey, query);
    if (qv.length === 0) return "";
    const scored = idx.chunks
      .map((c) => ({ c, s: cosine(qv, c.vector) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, k)
      .filter((x) => x.s > MIN_SCORE);
    if (scored.length === 0) return "";
    return `## 질문과 관련된 자료 (검색됨)\n${scored.map((x) => x.c.text).join("\n\n")}`;
  } catch {
    return "";
  }
}
