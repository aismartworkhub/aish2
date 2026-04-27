/**
 * BigQuery 공개 데이터셋 (`bigquery-public-data.google_trends.*`) 클라이언트.
 *
 * 사전 작업 (한 번만):
 * 1) GCP 콘솔 → Firebase 프로젝트(aish-web-v2) 선택
 * 2) "BigQuery API" 활성화 (무료, sandbox 모드 가능)
 *
 * 사용 흐름:
 * - 관리자가 BigQuery 조회를 요청하면 OAuth 팝업으로 `bigquery.readonly` 스코프 동의
 * - jobs.query REST API 호출 → 결과 JSON 파싱
 * - 결과는 admin 페이지에서 일 단위로 Firestore 캐시에 저장 (선택)
 *
 * 비용: BigQuery sandbox는 결제수단 없이 1TB/월 쿼리 무료. 대상 테이블이
 * 작아서 한 번 조회 시 수MB 내외 → 사실상 무료.
 */

import { requestGoogleAccessToken, hasGoogleOAuthClientId } from "./google-oauth-token";

const BIGQUERY_SCOPE = "https://www.googleapis.com/auth/bigquery.readonly";

/**
 * BigQuery REST API 호출용 액세스 토큰을 취득.
 * 내부적으로 Google Identity Services Token Client 사용 (COOP 친화적).
 */
export async function getBigQueryAccessToken(): Promise<string> {
  return requestGoogleAccessToken(BIGQUERY_SCOPE);
}

/** UI 사전 안내용 — OAuth Client ID가 설정되어 있는지 확인 */
export function isBigQueryConfigured(): boolean {
  return hasGoogleOAuthClientId();
}

export interface BigQueryTopTerm {
  rank: number;
  term: string;
  refreshDate: string;
  countryCode?: string;
  countryName?: string;
  score?: number | null;
  weekIso?: string;
}

interface BqRow {
  f: { v: string | null }[];
}

interface BqQueryResponse {
  jobComplete: boolean;
  schema?: { fields: { name: string; type: string }[] };
  rows?: BqRow[];
  totalRows?: string;
  errors?: { message: string; reason?: string }[];
  error?: { message: string };
}

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "aish-web-v2";
const BQ_API = `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}`;

async function runBqQuery(token: string, sql: string): Promise<BqQueryResponse> {
  const res = await fetch(`${BQ_API}/queries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: sql,
      useLegacySql: false,
      timeoutMs: 30000,
    }),
  });

  const data = (await res.json()) as BqQueryResponse;
  if (!res.ok) {
    const msg = data.error?.message ?? `BigQuery 호출 실패 (HTTP ${res.status})`;
    throw new Error(msg);
  }
  if (data.errors && data.errors.length > 0) {
    throw new Error(data.errors[0].message);
  }
  return data;
}

function rowsToObjects(resp: BqQueryResponse): Record<string, string | null>[] {
  const fields = resp.schema?.fields ?? [];
  const rows = resp.rows ?? [];
  return rows.map((row) => {
    const obj: Record<string, string | null> = {};
    fields.forEach((f, i) => {
      obj[f.name] = row.f[i]?.v ?? null;
    });
    return obj;
  });
}

/**
 * 한국 등 국가별 일간 인기 검색어 Top N
 * 데이터 소스: bigquery-public-data.google_trends.international_top_terms
 */
export async function fetchInternationalTopTerms(
  token: string,
  countryCode: string,
  limit = 25
): Promise<BigQueryTopTerm[]> {
  const safeCountry = countryCode.replace(/[^A-Z]/gi, "").toUpperCase().slice(0, 2);
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const sql = `
    SELECT rank, term, refresh_date, country_code, country_name, score, week
    FROM \`bigquery-public-data.google_trends.international_top_terms\`
    WHERE country_code = '${safeCountry}'
      AND refresh_date = (
        SELECT MAX(refresh_date)
        FROM \`bigquery-public-data.google_trends.international_top_terms\`
        WHERE country_code = '${safeCountry}'
      )
    ORDER BY rank ASC
    LIMIT ${safeLimit}
  `;
  const resp = await runBqQuery(token, sql);
  if (!resp.jobComplete) {
    throw new Error("BigQuery 쿼리가 시간 내에 완료되지 않았습니다. 다시 시도해 주세요.");
  }
  const rows = rowsToObjects(resp);
  return rows.map((r) => ({
    rank: Number(r.rank ?? 0),
    term: r.term ?? "",
    refreshDate: r.refresh_date ?? "",
    countryCode: r.country_code ?? undefined,
    countryName: r.country_name ?? undefined,
    score: r.score == null ? null : Number(r.score),
    weekIso: r.week ?? undefined,
  }));
}

/**
 * 미국 일간 인기 검색어 Top N
 * 데이터 소스: bigquery-public-data.google_trends.top_terms
 */
export async function fetchUsTopTerms(token: string, limit = 25): Promise<BigQueryTopTerm[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const sql = `
    SELECT rank, term, refresh_date, score, week
    FROM \`bigquery-public-data.google_trends.top_terms\`
    WHERE refresh_date = (
      SELECT MAX(refresh_date) FROM \`bigquery-public-data.google_trends.top_terms\`
    )
    ORDER BY rank ASC
    LIMIT ${safeLimit}
  `;
  const resp = await runBqQuery(token, sql);
  if (!resp.jobComplete) {
    throw new Error("BigQuery 쿼리가 시간 내에 완료되지 않았습니다. 다시 시도해 주세요.");
  }
  const rows = rowsToObjects(resp);
  return rows.map((r) => ({
    rank: Number(r.rank ?? 0),
    term: r.term ?? "",
    refreshDate: r.refresh_date ?? "",
    countryCode: "US",
    countryName: "United States",
    score: r.score == null ? null : Number(r.score),
    weekIso: r.week ?? undefined,
  }));
}

export const BIGQUERY_SUPPORTED_COUNTRIES: { code: string; label: string }[] = [
  { code: "KR", label: "대한민국" },
  { code: "US", label: "미국" },
  { code: "JP", label: "일본" },
  { code: "GB", label: "영국" },
  { code: "DE", label: "독일" },
  { code: "FR", label: "프랑스" },
  { code: "IN", label: "인도" },
  { code: "BR", label: "브라질" },
  { code: "CA", label: "캐나다" },
  { code: "AU", label: "호주" },
  { code: "ID", label: "인도네시아" },
  { code: "VN", label: "베트남" },
  { code: "TH", label: "태국" },
  { code: "TW", label: "대만" },
];
