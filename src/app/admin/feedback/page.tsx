"use client";

import { useMemo, useState } from "react";
import { Bug, Clock, CheckCircle, AlertCircle, Trash2, Copy, ExternalLink, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTIONS, updateDocFields, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { useToast } from "@/components/ui/Toast";
import { formatPrompt, type FeedbackReport, type FeedbackStatus } from "@/lib/feedback-engine";

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "신규",
  in_progress: "진행 중",
  closed: "완료",
};
const STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: "bg-rose-100 text-rose-700",
  in_progress: "bg-amber-100 text-amber-700",
  closed: "bg-emerald-100 text-emerald-700",
};
const STATUS_ICONS: Record<FeedbackStatus, React.ElementType> = {
  open: AlertCircle,
  in_progress: Clock,
  closed: CheckCircle,
};

export default function AdminFeedbackPage() {
  const { toast } = useToast();
  const { data: rawReports, loading, error, refresh } = useFirestoreCollection<FeedbackReport>(
    COLLECTIONS.FEEDBACK_REPORTS,
  );
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDom, setShowDom] = useState(false);

  const reports = useMemo(() => {
    return [...rawReports].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [rawReports]);

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return reports;
    return reports.filter((r) => r.status === statusFilter);
  }, [reports, statusFilter]);

  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId],
  );

  const updateStatus = async (id: string, status: FeedbackStatus) => {
    try {
      await updateDocFields(COLLECTIONS.FEEDBACK_REPORTS, id, { status });
      refresh();
      toast("상태 변경됨", "success");
    } catch {
      toast("상태 변경 실패", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 신고를 삭제할까요?")) return;
    try {
      await removeDoc(COLLECTIONS.FEEDBACK_REPORTS, id);
      if (selectedId === id) setSelectedId(null);
      refresh();
      toast("삭제됨", "success");
    } catch {
      toast("삭제 실패", "error");
    }
  };

  const copyPrompt = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(formatPrompt(selected));
      toast("Claude Code 프롬프트 복사됨", "success");
    } catch {
      toast("복사 실패", "error");
    }
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bug className="h-6 w-6 text-rose-500" />
            사용자 신고
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            사용자가 보낸 버그 신고·의견. 화면 캡쳐와 페이지 상태가 함께 저장됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          {(["ALL", "open", "in_progress", "closed"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition",
                statusFilter === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
              )}
            >
              {s === "ALL" ? "전체" : STATUS_LABELS[s]}
              <span className="ml-1.5 text-xs opacity-70">
                ({s === "ALL" ? reports.length : reports.filter((r) => r.status === s).length})
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* List */}
        <div className="space-y-2 max-h-[80vh] overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-400">
              신고된 항목이 없습니다.
            </div>
          )}
          {filtered.map((r) => {
            const Icon = STATUS_ICONS[r.status];
            const isActive = r.id === selectedId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => { setSelectedId(r.id ?? null); setShowDom(false); }}
                className={cn(
                  "w-full text-left rounded-lg border bg-white p-3 transition hover:border-rose-300",
                  isActive ? "border-rose-500 ring-2 ring-rose-100" : "border-gray-200",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[r.status])}>
                    <Icon className="h-3 w-3" />
                    {STATUS_LABELS[r.status]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : ""}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 line-clamp-2">{r.message}</p>
                <p className="mt-1 text-xs text-gray-500 truncate">
                  {r.context?.pathname ?? "?"}{r.reporterEmail ? ` · ${r.reporterEmail}` : ""}
                </p>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div className="min-w-0 rounded-lg border bg-white p-4 lg:p-6 min-h-[400px]">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              왼쪽에서 신고를 선택하세요.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header actions */}
              <div className="flex flex-wrap items-center gap-2 border-b pb-3">
                <select
                  value={selected.status}
                  onChange={(e) => selected.id && updateStatus(selected.id, e.target.value as FeedbackStatus)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-rose-400 focus:outline-none"
                >
                  <option value="open">신규</option>
                  <option value="in_progress">진행 중</option>
                  <option value="closed">완료</option>
                </select>
                <button
                  type="button"
                  onClick={copyPrompt}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  <Copy className="h-4 w-4" />
                  Claude Code 프롬프트 복사
                </button>
                <a
                  href={selected.context?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  해당 페이지 열기
                </a>
                <div className="ml-auto" />
                <button
                  type="button"
                  onClick={() => selected.id && handleDelete(selected.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                  삭제
                </button>
              </div>

              {/* Message */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">메시지</h3>
                <p className="whitespace-pre-wrap text-sm text-gray-900">{selected.message}</p>
              </section>

              {/* Metadata */}
              <section className="grid grid-cols-2 gap-3 text-sm">
                <Meta label="URL" value={selected.context?.url} />
                <Meta label="라우트 파일" value={selected.context?.routeFile} mono />
                <Meta label="보고자" value={selected.reporterEmail ?? "(비로그인)"} />
                <Meta label="시각" value={selected.createdAt ? new Date(selected.createdAt).toLocaleString("ko-KR") : "-"} />
                <Meta label="뷰포트" value={`${selected.context?.viewport?.w}×${selected.context?.viewport?.h}`} />
                <Meta label="언어" value={selected.context?.language} />
              </section>

              {/* Screenshot */}
              {selected.screenshotDataUrl && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">화면 캡쳐</h3>
                  <img
                    src={selected.screenshotDataUrl}
                    alt="신고 시점 화면"
                    className="rounded-lg border max-w-full"
                  />
                </section>
              )}

              {/* Console errors */}
              {selected.context?.consoleErrors?.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">최근 콘솔 에러</h3>
                  <ul className="space-y-1 text-xs font-mono">
                    {selected.context.consoleErrors.map((e, i) => (
                      <li key={i} className="rounded bg-rose-50 p-2 text-rose-900">
                        <div>{e.message}</div>
                        {e.source && <div className="text-rose-600/70">{e.source}:{e.line}:{e.col}</div>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Network errors */}
              {selected.context?.networkErrors?.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">최근 네트워크 실패</h3>
                  <ul className="space-y-1 text-xs font-mono">
                    {selected.context.networkErrors.map((n, i) => (
                      <li key={i} className="rounded bg-amber-50 p-2 text-amber-900">
                        {n.method} {n.url} → {n.status ?? "FAIL"} {n.statusText ?? ""}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* DOM snapshot — collapsed */}
              {selected.domSnapshot && (
                <section>
                  <button
                    type="button"
                    onClick={() => setShowDom((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-900"
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    DOM 스냅샷 {showDom ? "숨기기" : "보기"} ({Math.round(selected.domSnapshot.length / 1024)}KB)
                  </button>
                  {showDom && (
                    <pre className="mt-2 max-h-96 max-w-full overflow-auto whitespace-pre-wrap break-all rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                      {selected.domSnapshot}
                    </pre>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={cn("text-sm text-gray-900 break-all", mono && "font-mono text-xs")}>
        {value || "-"}
      </div>
    </div>
  );
}
