"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, Database, Trash2, RefreshCw, Save, ExternalLink, Loader2, Info } from "lucide-react";
import { COLLECTIONS, createDoc, removeDoc, upsertDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
  parseGoogleTrendsCsv,
  summarizeSeries,
  type ParsedTrendsCsv,
  type TrendsSeriesPoint,
} from "@/lib/googleTrendsCsv";
import {
  getBigQueryAccessToken,
  fetchInternationalTopTerms,
  fetchUsTopTerms,
  BIGQUERY_SUPPORTED_COUNTRIES,
  type BigQueryTopTerm,
} from "@/lib/bigQueryTrends";
import TrendsLineChart from "@/components/admin/TrendsLineChart";

type TabKey = "csv" | "bigquery";

interface TrendCsvDoc {
  id: string;
  keyword: string;
  geo: string;
  timeframe: string;
  category: string;
  csvFileName: string;
  notes?: string;
  series: TrendsSeriesPoint[];
  createdAt?: { seconds: number };
  updatedAt?: { seconds: number };
}

interface TrendBqDoc {
  id: string;
  countryCode: string;
  countryLabel: string;
  refreshDate: string;
  fetchedAt: number;
  terms: BigQueryTopTerm[];
}

const csvSort = (a: TrendCsvDoc, b: TrendCsvDoc) =>
  (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0);

const bqSort = (a: TrendBqDoc, b: TrendBqDoc) => b.fetchedAt - a.fetchedAt;

export default function AdminTrendsPage() {
  const [tab, setTab] = useState<TabKey>("csv");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Google 트렌드</h1>
        <p className="text-gray-500 mt-1 text-sm">
          trends.google.com에서 받은 CSV 또는 BigQuery 공개 데이터셋에서 트렌드 데이터를 수집합니다.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <TabButton active={tab === "csv"} onClick={() => setTab("csv")} icon={<Upload size={14} />}>
          키워드 추이 (CSV)
        </TabButton>
        <TabButton active={tab === "bigquery"} onClick={() => setTab("bigquery")} icon={<Database size={14} />}>
          인기 검색어 (BigQuery)
        </TabButton>
      </div>

      {tab === "csv" ? <CsvTab /> : <BigQueryTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-primary-600 text-primary-700"
          : "border-transparent text-gray-500 hover:text-gray-700"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* ------------------------- CSV 탭 ------------------------- */

function CsvTab() {
  const { toast } = useToast();
  const { data: rows, setData: setRows, loading, error, refresh } =
    useFirestoreCollection<TrendCsvDoc>(COLLECTIONS.GOOGLE_TRENDS, csvSort);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedTrendsCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [form, setForm] = useState({
    keyword: "",
    geo: "",
    timeframe: "",
    category: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const summary = useMemo(
    () => (parsed ? summarizeSeries(parsed.series) : null),
    [parsed]
  );

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const result = parseGoogleTrendsCsv(text);
      setParsed(result);
      setFileName(file.name);
      const keywordGuess = result.keywordHeader.split(":")[0].trim();
      const geoGuess = (() => {
        const m = result.keywordHeader.match(/\(([^)]+)\)/);
        return m ? m[1].trim() : "";
      })();
      setForm((f) => ({
        ...f,
        keyword: f.keyword || keywordGuess,
        geo: f.geo || geoGuess,
        category: f.category || result.category,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "CSV 파싱 실패";
      toast(msg, "error");
      setParsed(null);
    }
  };

  const reset = () => {
    setParsed(null);
    setFileName("");
    setForm({ keyword: "", geo: "", timeframe: "", category: "", notes: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!parsed) {
      toast("CSV 파일을 먼저 업로드해 주세요.", "error");
      return;
    }
    if (!form.keyword.trim()) {
      toast("키워드를 입력해 주세요.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        keyword: form.keyword.trim(),
        geo: form.geo.trim(),
        timeframe: form.timeframe.trim(),
        category: form.category.trim() || parsed.category,
        notes: form.notes.trim(),
        csvFileName: fileName,
        timeUnit: parsed.timeUnit,
        series: parsed.series,
      };
      const id = await createDoc(COLLECTIONS.GOOGLE_TRENDS, payload);
      setRows((prev) => [
        { id, ...payload, updatedAt: { seconds: Math.floor(Date.now() / 1000) } } as TrendCsvDoc,
        ...prev,
      ]);
      toast("저장되었습니다.", "success");
      reset();
    } catch (e) {
      console.error(e);
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.GOOGLE_TRENDS, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
      toast("삭제에 실패했습니다.", "error");
    }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900">
        <div className="flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">사용 방법</p>
            <ol className="list-decimal list-inside mt-1 space-y-0.5 text-blue-800/90">
              <li>
                <a
                  href="https://trends.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline inline-flex items-center gap-0.5"
                >
                  trends.google.com <ExternalLink size={11} />
                </a>
                에서 키워드 검색 후 &ldquo;시간별 추이&rdquo; 그래프 옆 ↓ 다운로드 버튼으로 CSV 받기
              </li>
              <li>아래에 CSV 파일 업로드 → 미리보기 확인 → 메타정보 입력 후 저장</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">새 CSV 업로드</h2>

          <label className="block">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100"
            />
          </label>

          {parsed && summary && (
            <>
              <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-100">
                <p>파일: <span className="text-gray-700">{fileName}</span></p>
                <p>헤더: <span className="text-gray-700">{parsed.keywordHeader}</span></p>
                <p>시간단위: <span className="text-gray-700">{parsed.timeUnit}</span> · 데이터 포인트: <span className="text-gray-700">{parsed.series.length}</span></p>
                <p>최댓값: <span className="text-gray-700">{summary.max}</span> · 평균: <span className="text-gray-700">{summary.avg}</span> · 최근값: <span className="text-gray-700">{summary.latest}</span></p>
              </div>
              <TrendsLineChart series={parsed.series} ariaLabel={`${form.keyword} 시계열 미리보기`} />

              <div className="grid grid-cols-2 gap-3">
                <FormField label="키워드 *">
                  <input
                    value={form.keyword}
                    onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </FormField>
                <FormField label="지역 (예: KR, Worldwide)">
                  <input
                    value={form.geo}
                    onChange={(e) => setForm({ ...form, geo: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </FormField>
                <FormField label="기간 (예: today 12-m)">
                  <input
                    value={form.timeframe}
                    onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </FormField>
                <FormField label="카테고리">
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </FormField>
              </div>
              <FormField label="메모">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </FormField>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
                >
                  <Save size={14} />
                  {saving ? "저장중..." : "저장"}
                </button>
                <button
                  onClick={reset}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  초기화
                </button>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">등록된 CSV ({rows.length})</h2>
          {rows.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">등록된 CSV가 없습니다.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((row) => (
                <li key={row.id} className="py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{row.keyword}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {[row.geo || "?", row.timeframe || "?", row.category || "?"].join(" · ")}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {row.series.length}개 포인트 · {row.csvFileName}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2">
                    <TrendsLineChart series={row.series} height={140} ariaLabel={`${row.keyword} 추이`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

/* ------------------------- BigQuery 탭 ------------------------- */

function BigQueryTab() {
  const { toast } = useToast();
  const { data: cached, setData: setCached, loading, error, refresh } =
    useFirestoreCollection<TrendBqDoc>(COLLECTIONS.GOOGLE_TRENDS_TOP, bqSort);

  const [country, setCountry] = useState("KR");
  const [limit, setLimit] = useState(25);
  const [terms, setTerms] = useState<BigQueryTopTerm[] | null>(null);
  const [refreshDate, setRefreshDate] = useState("");
  const [running, setRunning] = useState(false);
  const [savingCache, setSavingCache] = useState(false);

  const countryLabel = useMemo(() => {
    const found = BIGQUERY_SUPPORTED_COUNTRIES.find((c) => c.code === country);
    return found?.label ?? country;
  }, [country]);

  const handleRun = async () => {
    setRunning(true);
    setTerms(null);
    setRefreshDate("");
    try {
      const token = await getBigQueryAccessToken();
      const result =
        country === "US"
          ? await fetchUsTopTerms(token, limit)
          : await fetchInternationalTopTerms(token, country, limit);
      setTerms(result);
      setRefreshDate(result[0]?.refreshDate ?? "");
      if (result.length === 0) {
        toast("결과가 비어있습니다. 다른 국가를 선택해 보세요.", "info");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "BigQuery 호출 실패";
      toast(msg, "error");
    } finally {
      setRunning(false);
    }
  };

  const handleSaveCache = async () => {
    if (!terms || terms.length === 0) return;
    setSavingCache(true);
    try {
      const docId = `${country}_${refreshDate || "unknown"}`;
      const payload: Omit<TrendBqDoc, "id"> = {
        countryCode: country,
        countryLabel,
        refreshDate,
        fetchedAt: Date.now(),
        terms,
      };
      await upsertDoc(COLLECTIONS.GOOGLE_TRENDS_TOP, docId, payload);
      setCached((prev) => {
        const next = prev.filter((c) => c.id !== docId);
        return [{ id: docId, ...payload }, ...next];
      });
      toast("캐시에 저장되었습니다.", "success");
    } catch (e) {
      console.error(e);
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSavingCache(false);
    }
  };

  const handleDeleteCache = async (id: string) => {
    if (!confirm("캐시를 삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.GOOGLE_TRENDS_TOP, id);
      setCached((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
      toast("삭제에 실패했습니다.", "error");
    }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">사전 작업 필요 (한 번만)</p>
            <ol className="list-decimal list-inside text-amber-800/90 space-y-0.5">
              <li>
                <a
                  href="https://console.cloud.google.com/apis/library/bigquery.googleapis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline inline-flex items-center gap-0.5"
                >
                  GCP 콘솔에서 BigQuery API 활성화 <ExternalLink size={11} />
                </a>
                {" "}(Firebase 프로젝트와 동일한 GCP 프로젝트 선택)
              </li>
              <li>아래 &ldquo;조회&rdquo; 버튼 클릭 → 팝업에서 BigQuery 권한 동의</li>
            </ol>
            <p className="text-xs text-amber-700/90 pt-1">
              BigQuery sandbox는 결제수단 없이 1TB/월 쿼리 무료. 본 쿼리는 수MB 수준입니다.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="국가">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[160px]"
            >
              {BIGQUERY_SUPPORTED_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.code})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="개수">
            <input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(100, Number(e.target.value) || 25)))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24"
            />
          </FormField>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {running ? "조회중..." : "조회"}
          </button>
          {terms && terms.length > 0 && (
            <button
              onClick={handleSaveCache}
              disabled={savingCache}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium disabled:opacity-50"
            >
              <Save size={14} />
              {savingCache ? "저장중..." : "Firestore 캐시 저장"}
            </button>
          )}
        </div>

        {terms && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500 mb-2">
              {countryLabel} · 기준일 {refreshDate || "?"} · {terms.length}개
            </p>
            {terms.length === 0 ? (
              <p className="text-sm text-gray-400">결과 없음</p>
            ) : (
              <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {terms.map((t) => (
                  <li key={`${t.rank}-${t.term}`} className="flex items-baseline gap-2 py-1 border-b border-gray-50">
                    <span className="text-xs text-gray-400 w-6 text-right tabular-nums">{t.rank}</span>
                    <span className="text-gray-900 flex-1">{t.term}</span>
                    {t.score != null && (
                      <span className="text-xs text-gray-400 tabular-nums">{t.score}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">캐시된 결과 ({cached.length})</h2>
        {cached.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">저장된 캐시가 없습니다.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {cached.map((c) => (
              <li key={c.id} className="py-3 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">
                      {c.countryLabel} ({c.countryCode}) · {c.refreshDate}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.terms.length}개 · 저장 {new Date(c.fetchedAt).toLocaleString("ko-KR")}
                    </p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {c.terms.slice(0, 10).map((t) => t.term).join(", ")}
                      {c.terms.length > 10 ? " …" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteCache(c.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                    title="캐시 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
