"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Edit, Trash2, X, Save, Pin, Eye, Sparkles, Loader2, ImageIcon, RefreshCw, ExternalLink, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { getGeminiApiKey, recommendTagsForContent } from "@/lib/gemini";
import { extractOgImageWithAI } from "@/lib/og-image-ai";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { DEFAULT_BOARDS, mergeBoardsByKey } from "@/lib/board-defaults";
import {
  getBoards,
  getContents,
  createContent,
  updateContent,
  deleteContent,
  detectMediaType,
} from "@/lib/content-engine";
import type { BoardConfig, Content, ContentInput, MediaType } from "@/types/content";
import type { DriveAttachment } from "@/types/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import MediaPreview from "@/components/content/MediaPreview";
import DriveFileUploader from "@/components/admin/DriveFileUploader";
import { HtmlEditor } from "@/components/admin/HtmlEditor";
import { contentDisplayTitle } from "@/lib/content-display";

const MAX_CONTENT_ATTACHMENTS = 3;
const MAX_CONTENT_ATTACHMENT_MB = 10;

// 작성자 표시명은 수동 오버라이드 가능 (빈 값이면 로그인 admin 이름으로 자동 채움).
// authorUid는 항상 admin 본인 — 보안상 수동 입력 차단.
const EMPTY_CONTENT: Omit<ContentInput, "authorUid"> = {
  boardKey: "",
  title: "",
  titleKo: "",
  body: "",
  bodyKo: "",
  mediaType: "none",
  mediaUrl: "",
  thumbnailUrl: "",
  isShort: false,
  tags: [],
  isPinned: false,
  isApproved: true,
  question: "",
  answer: "",
  rating: 0,
  programTitle: "",
  googleLink: "",
  notionLink: "",
  slackLink: "",
  attachments: [],
  authorName: "",
};

export default function AdminContentsPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminContentsInner />
    </Suspense>
  );
}

function AdminContentsInner() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const initialBoardKey = searchParams.get("boardKey") || "";
  const [boards, setBoards] = useState<BoardConfig[]>(DEFAULT_BOARDS);
  const [selectedBoard, setSelectedBoard] = useState<string>(initialBoardKey);
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editing, setEditing] = useState<(Omit<ContentInput, "authorUid"> & { id?: string }) | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagRecLoading, setTagRecLoading] = useState(false);
  const [ogExtracting, setOgExtracting] = useState(false);
  // Phase B — 일괄 선택 + 일괄 삭제
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // 썸네일 일괄 백필 — 누락 og:image를 Gemini URL Context로 추출 (현재 보드만)
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{
    total: number; done: number; success: number; failed: number;
    current?: string;
    errors: { title: string; error: string }[];
  } | null>(null);

  useEffect(() => {
    getBoards()
      .then((b) => setBoards(mergeBoardsByKey(DEFAULT_BOARDS, b)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedBoard && boards.length > 0) {
      setSelectedBoard(boards[0].key);
    }
  }, [boards, selectedBoard]);

  const loadContents = useCallback(async () => {
    if (!selectedBoard) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getContents(selectedBoard);
      setContents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [selectedBoard]);

  useEffect(() => {
    loadContents();
  }, [loadContents]);

  const activeBoard = useMemo(
    () => boards.find((b) => b.key === selectedBoard),
    [boards, selectedBoard],
  );

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return contents;
    const q = searchQuery.toLowerCase();
    return contents.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.titleKo?.toLowerCase().includes(q) ?? false) ||
        (c.body?.toLowerCase().includes(q) ?? false) ||
        (c.bodyKo?.toLowerCase().includes(q) ?? false) ||
        c.authorName.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [contents, searchQuery]);

  const isFaq = activeBoard?.layout === "faq";

  const startCreate = () => {
    setEditing({ ...EMPTY_CONTENT, boardKey: selectedBoard });
    setIsCreating(true);
    setTagInput("");
  };

  const startEdit = (c: Content) => {
    setEditing({
      id: c.id,
      boardKey: c.boardKey,
      title: c.title,
      titleKo: c.titleKo ?? "",
      body: c.body ?? "",
      bodyKo: c.bodyKo ?? "",
      mediaType: c.mediaType ?? "none",
      mediaUrl: c.mediaUrl ?? "",
      thumbnailUrl: c.thumbnailUrl ?? "",
      isShort: c.isShort ?? false,
      tags: c.tags ?? [],
      isPinned: c.isPinned ?? false,
      isApproved: c.isApproved ?? true,
      question: c.question ?? "",
      answer: c.answer ?? "",
      rating: c.rating ?? 0,
      programTitle: c.programTitle ?? "",
      googleLink: c.googleLink ?? "",
      notionLink: c.notionLink ?? "",
      slackLink: c.slackLink ?? "",
      attachments: c.attachments ?? [],
      authorName: c.authorName ?? "",
    });
    setIsCreating(false);
    setTagInput("");
  };

  const handleMediaUrlChange = (url: string) => {
    if (!editing) return;
    const detected = detectMediaType(url);
    setEditing({
      ...editing,
      mediaUrl: url,
      mediaType: detected.mediaType,
      thumbnailUrl: detected.thumbnailUrl || editing.thumbnailUrl || "",
    });
  };

  const handleAddTag = () => {
    if (!editing || !tagInput.trim()) return;
    const tag = tagInput.trim();
    if (!editing.tags?.includes(tag)) {
      setEditing({ ...editing, tags: [...(editing.tags || []), tag] });
    }
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    if (!editing) return;
    setEditing({ ...editing, tags: editing.tags?.filter((t) => t !== tag) });
  };

  const handleRecommendTags = async () => {
    if (!editing) return;
    const titleSrc = isFaq ? editing.question : editing.title;
    if (!titleSrc?.trim()) {
      toast("제목 또는 질문을 먼저 입력해주세요.", "error");
      return;
    }
    setTagRecLoading(true);
    try {
      const apiKey = await getGeminiApiKey();
      if (!apiKey) {
        toast("Gemini API 키가 설정되지 않았습니다. /admin/settings에서 등록하세요.", "error");
        return;
      }
      const recommended = await recommendTagsForContent(apiKey, {
        title: titleSrc,
        body: editing.body || editing.bodyKo || editing.answer,
      });
      if (recommended.length === 0) {
        toast("추천 태그를 생성하지 못했습니다.", "info");
        return;
      }
      const existing = new Set((editing.tags ?? []).map((t) => t.toLowerCase()));
      const merged = [...(editing.tags ?? [])];
      let added = 0;
      for (const t of recommended) {
        const trimmed = t.trim();
        if (!trimmed) continue;
        if (existing.has(trimmed.toLowerCase())) continue;
        merged.push(trimmed);
        existing.add(trimmed.toLowerCase());
        added++;
      }
      setEditing({ ...editing, tags: merged });
      toast(added > 0 ? `${added}개의 태그를 추가했습니다.` : "이미 모든 추천 태그가 등록되어 있습니다.", added > 0 ? "success" : "info");
    } catch (e) {
      toast(`AI 태그 추천 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
    } finally {
      setTagRecLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editing || !user) return;
    if (!isFaq && !editing.title.trim()) {
      toast("제목을 입력해주세요.", "error");
      return;
    }
    if (isFaq && !editing.question?.trim()) {
      toast("질문을 입력해주세요.", "error");
      return;
    }

    setSaving(true);
    try {
      const { id: editingId, ...editingRest } = editing;
      const manualAuthor = editingRest.authorName?.trim();
      const data: ContentInput = {
        ...editingRest,
        boardKey: selectedBoard,
        authorUid: user.uid,
        // 수동 입력값 우선 — 외부 출처 글의 작성자 표시명을 admin이 명시
        authorName: manualAuthor || profile?.displayName || user.displayName || "관리자",
        authorPhotoURL: user.photoURL ?? undefined,
        title: isFaq ? (editing.question ?? "") : editing.title,
      };

      if (isCreating) {
        await createContent(data);
        toast("콘텐츠가 등록되었습니다.", "success");
      } else if (editingId) {
        await updateContent(editingId, data);
        toast("콘텐츠가 수정되었습니다.", "success");
      }
      setEditing(null);
      await loadContents();
    } catch {
      toast("저장 실패. 다시 시도해주세요.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deleteContent(id);
      toast("삭제되었습니다.", "success");
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      await loadContents();
    } catch {
      toast("삭제 실패.", "error");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((c) => c.id));
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`선택된 ${selectedIds.length}건을 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;
    try {
      await Promise.all(selectedIds.map((id) => deleteContent(id)));
      toast(`${selectedIds.length}건이 삭제되었습니다.`, "success");
      setSelectedIds([]);
      await loadContents();
    } catch {
      toast("일부 삭제에 실패했습니다.", "error");
      await loadContents();
    }
  };

  // 보드 변경 시 선택 초기화 — 다른 보드의 ID가 남아있지 않도록
  useEffect(() => { setSelectedIds([]); }, [selectedBoard]);

  // 현재 보드의 외부 링크 글 중 thumbnailUrl 누락분 — 백필 후보
  const backfillCandidates = useMemo(
    () => contents.filter((c) => !c.thumbnailUrl && c.mediaUrl && c.mediaType === "link"),
    [contents],
  );

  /**
   * 누락 썸네일 일괄 백필 — Gemini URL Context로 og:image 재추출 후 Firestore 업데이트.
   * 순차 처리(0.4초 간격)로 burst 방지. 실패는 모아서 상세 표시.
   */
  const runBackfill = async () => {
    if (backfilling || backfillCandidates.length === 0) return;
    if (!confirm(
      `현재 보드의 ${backfillCandidates.length}건에 og:image 추출을 시도합니다.\n` +
      `Gemini API 호출 ${backfillCandidates.length}회 (일 한도 1500회). 계속할까요?`
    )) return;

    let success = 0;
    let failed = 0;
    const errors: { title: string; error: string }[] = [];

    setBackfilling(true);
    setBackfillResult({ total: backfillCandidates.length, done: 0, success: 0, failed: 0, errors: [] });

    for (let i = 0; i < backfillCandidates.length; i++) {
      const c = backfillCandidates[i];
      setBackfillResult({ total: backfillCandidates.length, done: i, success, failed, errors: [...errors], current: c.title });
      try {
        const r = await extractOgImageWithAI(c.mediaUrl!);
        if (r.ok) {
          await updateContent(c.id, { thumbnailUrl: r.ogImage });
          success++;
        } else {
          failed++;
          errors.push({ title: c.title, error: r.error });
        }
      } catch (e) {
        failed++;
        errors.push({ title: c.title, error: e instanceof Error ? e.message : "unknown" });
      }
      // burst 방지 — Gemini RPM 한도 보호
      await new Promise((res) => setTimeout(res, 400));
    }

    setBackfillResult({ total: backfillCandidates.length, done: backfillCandidates.length, success, failed, errors });
    setBackfilling(false);
    await loadContents();
    toast(`백필 완료 — 성공 ${success} / 실패 ${failed}`, success > 0 ? "success" : "info");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">통합 콘텐츠 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            보드의 <strong>그룹(group)</strong>으로 공개 노출 위치가 결정됩니다. <code className="rounded bg-gray-100 px-1 text-xs">media</code> → <code className="rounded bg-gray-100 px-1 text-xs">/media</code>, <code className="rounded bg-gray-100 px-1 text-xs">community</code> → <code className="rounded bg-gray-100 px-1 text-xs">/community</code>. 그룹 변경은 <a href="/admin/boards" className="text-primary-600 underline">/admin/boards</a>에서.
          </p>
        </div>
        <button
          onClick={startCreate}
          className={cn(
            "flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white",
            "transition-colors hover:bg-primary-600",
          )}
        >
          <Plus size={16} /> 새 콘텐츠
        </button>
      </div>

      {/* 게시판 선택 탭 */}
      <div className="flex flex-wrap gap-2 rounded-lg bg-gray-50 p-2">
        {boards.map((b) => (
          <button
            key={b.key}
            onClick={() => { setSelectedBoard(b.key); setEditing(null); }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              selectedBoard === b.key
                ? "bg-white text-primary-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            {b.label}
            {selectedBoard === b.key && contents.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-400">({contents.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* 활성 보드 공개 노출 위치 안내 */}
      {activeBoard && (
        <div className={cn(
          "flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm",
          activeBoard.group === "media"
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : activeBoard.group === "community"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700",
        )}>
          <div>
            <span className="font-medium">{activeBoard.label}</span>
            <span className="ml-2 text-xs opacity-70">key: <code className="rounded bg-white/60 px-1">{activeBoard.key}</code> · group: <code className="rounded bg-white/60 px-1">{activeBoard.group ?? "(미설정)"}</code></span>
          </div>
          <div className="text-xs">
            {activeBoard.group === "media" ? (
              <>공개 노출: <a href="/media" target="_blank" rel="noopener noreferrer" className="underline font-medium">/media</a></>
            ) : activeBoard.group === "community" ? (
              <>공개 노출: <a href="/community" target="_blank" rel="noopener noreferrer" className="underline font-medium">/community</a></>
            ) : (
              <>⚠ 공개 미연결 — group을 media/community로 설정해야 노출됩니다</>
            )}
          </div>
        </div>
      )}

      {/* 썸네일 일괄 백필 — og:image 누락 외부 링크 재추출 */}
      {!backfilling && !backfillResult && backfillCandidates.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            이 보드에 <strong>썸네일 누락 외부 링크 {backfillCandidates.length}건</strong> 발견. og:image 일괄 추출을 시도할 수 있습니다.
          </p>
          <button
            onClick={runBackfill}
            className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
          >
            <RefreshCw size={13} /> 일괄 백필
          </button>
        </div>
      )}

      {/* 백필 진행 — 진행 중 */}
      {backfilling && backfillResult && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <Loader2 size={14} className="animate-spin shrink-0" />
            <span className="font-medium">{backfillResult.done}/{backfillResult.total} 처리 중</span>
            {backfillResult.current && (
              <span className="truncate text-xs text-blue-600">— {backfillResult.current}</span>
            )}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${(backfillResult.done / Math.max(1, backfillResult.total)) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-blue-600">
            성공 {backfillResult.success} · 실패 {backfillResult.failed}
          </p>
        </div>
      )}

      {/* 백필 결과 — 완료 후 */}
      {!backfilling && backfillResult && backfillResult.done === backfillResult.total && backfillResult.total > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              백필 완료 — 성공 <span className="text-emerald-600">{backfillResult.success}</span> · 실패 <span className="text-rose-500">{backfillResult.failed}</span>
            </p>
            <button onClick={() => setBackfillResult(null)} className="text-gray-400 transition-colors hover:text-gray-600" aria-label="닫기">
              <X size={14} />
            </button>
          </div>
          {backfillResult.errors.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-gray-500">실패 상세 ({backfillResult.errors.length})</summary>
              <ul className="mt-1.5 space-y-1 text-gray-600">
                {backfillResult.errors.slice(0, 20).map((e, i) => (
                  <li key={i} className="truncate">• {e.title}: <span className="text-rose-500">{e.error}</span></li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* 검색 */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="제목, 한글 제목·설명, 작성자, 태그 검색..."
          className={cn(
            "w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
          )}
        />
      </div>

      {/* 일괄 작업 바 — 1건 이상 선택 시 노출 */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5">
          <p className="text-sm text-rose-800">
            <strong>{selectedIds.length}건</strong> 선택됨
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds([])} className="text-xs text-rose-600 hover:underline">선택 해제</button>
            <button onClick={bulkDelete} className="flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-700">
              <Trash2 size={13} /> 일괄 삭제
            </button>
          </div>
        </div>
      )}

      {/* 콘텐츠 목록 */}
      {loading ? (
        <AdminLoading />
      ) : error ? (
        <AdminError message={error} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              {searchQuery ? "검색 결과가 없습니다." : "등록된 콘텐츠가 없습니다. '새 콘텐츠' 버튼을 눌러 추가하세요."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                      onChange={toggleSelectAll}
                      aria-label="전체 선택"
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell w-24">구분</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">제목</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">작성자</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 hidden md:table-cell">조회</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 hidden md:table-cell">좋아요</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => {
                  const groupChip = c.group === "media"
                    ? { label: "미디어", cls: "bg-blue-100 text-blue-700" }
                    : c.group === "community"
                    ? { label: "커뮤니티", cls: "bg-emerald-100 text-emerald-700" }
                    : { label: "기타", cls: "bg-gray-100 text-gray-600" };
                  const extraCount =
                    (c.attachments?.length ?? 0) +
                    (c.googleLink ? 1 : 0) +
                    (c.notionLink ? 1 : 0) +
                    (c.slackLink ? 1 : 0);
                  const checked = selectedIds.includes(c.id);
                  return (
                    <tr key={c.id} className={cn(
                      "transition-colors",
                      checked ? "bg-primary-50/40" : "hover:bg-gray-50",
                    )}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(c.id)}
                          aria-label="선택"
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", groupChip.cls)}>
                          {groupChip.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {c.isPinned && <Pin size={12} className="text-primary-500" />}
                          {c.thumbnailUrl && (
                            <div className="h-8 w-12 shrink-0 overflow-hidden rounded bg-gray-100">
                              <MediaPreview
                                mediaUrl={c.mediaUrl}
                                mediaType={c.mediaType}
                                thumbnailUrl={c.thumbnailUrl}
                                title={contentDisplayTitle(c)}
                                className="h-full w-full"
                              />
                            </div>
                          )}
                          <span className="truncate font-medium text-gray-800">
                            {isFaq ? c.question || c.title : contentDisplayTitle(c)}
                          </span>
                          {extraCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700" title="외부 자료/첨부 있음">
                              <Paperclip size={10} />{extraCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{c.authorName}</td>
                      <td className="px-4 py-3 text-center text-gray-500 hidden md:table-cell">
                        <span className="flex items-center justify-center gap-1"><Eye size={12} />{c.views}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 hidden md:table-cell">{c.likeCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(c)}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-500"
                            aria-label="수정"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                            aria-label="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 편집 모달 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-20">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {isCreating ? "새 콘텐츠 등록" : "콘텐츠 수정"}
                <span className="ml-2 text-sm font-normal text-gray-400">({activeBoard?.label})</span>
              </h2>
              <button onClick={() => setEditing(null)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="닫기">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* FAQ일 때 */}
              {isFaq ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">질문 *</label>
                    <input
                      value={editing.question || ""}
                      onChange={(e) => setEditing({ ...editing, question: e.target.value })}
                      className={cn(
                        "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
                        "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                      )}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">답변 *</label>
                    <textarea
                      value={editing.answer || ""}
                      onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
                      rows={6}
                      className={cn(
                        "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none",
                        "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                      )}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* 일반 콘텐츠 */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">제목 *</label>
                    <p className="mb-1 text-xs text-gray-500">영문·원본 제목(메타·출처용). 유튜브 수집 시 그대로 둬도 됩니다.</p>
                    <input
                      value={editing.title}
                      onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                      className={cn(
                        "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
                        "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                      )}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">표시용 한글 제목 (선택)</label>
                    <p className="mb-1 text-xs text-gray-500">비우면 위 제목이 그대로 노출됩니다. 방문자에게 보일 한글 제목을 넣으세요.</p>
                    <input
                      value={editing.titleKo || ""}
                      onChange={(e) => setEditing({ ...editing, titleKo: e.target.value })}
                      className={cn(
                        "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
                        "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                      )}
                    />
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-gray-500">원문 설명(영문 등). 표시용 한글 설명을 쓰면 상세에서는 한글이 먼저 보입니다. HTML 태그 사용 가능.</p>
                    <HtmlEditor
                      label="본문"
                      value={editing.body || ""}
                      onChange={(v) => setEditing({ ...editing, body: v })}
                      rows={5}
                      placeholder="본문 내용을 입력하세요 (HTML 사용 가능)"
                    />
                  </div>
                  <div>
                    <HtmlEditor
                      label="표시용 한글 설명 (선택)"
                      value={editing.bodyKo || ""}
                      onChange={(v) => setEditing({ ...editing, bodyKo: v })}
                      rows={4}
                      placeholder="요약·번역·한글 안내 (HTML 사용 가능)"
                    />
                  </div>

                  {/* 콘텐츠 URL */}
                  {activeBoard?.group === "media" && (
                    <div className="space-y-3">
                      {/* media-resource(교육자료) 보드는 Google Drive 직접 업로드 지원 */}
                      {selectedBoard === "media-resource" && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-blue-700">
                              📁 Google Drive에 직접 업로드 — 파일 선택 시 mediaUrl·썸네일이 자동 채워집니다
                            </p>
                          </div>
                          <DriveFileUploader
                            attachments={
                              editing.mediaUrl && /drive\.google\.com|googleusercontent\.com/.test(editing.mediaUrl)
                                ? [{
                                    name: editing.title || "업로드 파일",
                                    url: editing.mediaUrl,
                                    size: "",
                                    type: editing.mediaType === "pdf" ? "drive" : "drive",
                                    driveDownloadUrl: editing.mediaUrl,
                                  } as DriveAttachment]
                                : []
                            }
                            onChange={(atts) => {
                              if (atts.length === 0) {
                                setEditing({ ...editing, mediaUrl: "", thumbnailUrl: "", mediaType: "none" });
                                return;
                              }
                              const a = atts[0];
                              const url = a.driveDownloadUrl || a.driveViewUrl || a.url;
                              const isPdf = /\.pdf(\?|$)/i.test(a.name) || a.type === "drive";
                              setEditing({
                                ...editing,
                                mediaUrl: url,
                                mediaType: isPdf ? "pdf" : "link",
                                title: editing.title || a.name,
                              });
                            }}
                            maxFiles={1}
                            allowLinks={false}
                          />
                        </div>
                      )}
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">콘텐츠 URL</label>
                        <input
                          value={editing.mediaUrl || ""}
                          onChange={(e) => handleMediaUrlChange(e.target.value)}
                          placeholder="YouTube, 이미지, PDF 링크 등"
                          className={cn(
                            "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
                            "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                          )}
                        />
                        {editing.mediaType && editing.mediaType !== "none" && (
                          <p className="mt-1 text-xs text-gray-400">
                            자동 감지: {editing.mediaType}
                            {editing.thumbnailUrl && " · 썸네일 자동 생성됨"}
                          </p>
                        )}
                        {/* AI og:image 추출 — http(s) 외부 URL이고 YouTube 아닐 때만 노출 */}
                        {editing.mediaUrl
                          && /^https?:\/\//.test(editing.mediaUrl)
                          && !extractYouTubeVideoId(editing.mediaUrl) && (
                          <button
                            type="button"
                            disabled={ogExtracting}
                            onClick={async () => {
                              const url = editing.mediaUrl;
                              if (!url) return;
                              setOgExtracting(true);
                              const r = await extractOgImageWithAI(url);
                              setOgExtracting(false);
                              if (r.ok) {
                                setEditing({ ...editing, thumbnailUrl: r.ogImage });
                                toast("AI로 메타 이미지를 가져왔습니다", "success");
                              } else {
                                toast(`추출 실패: ${r.error}`, "error");
                              }
                            }}
                            className={cn(
                              "mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                              "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100",
                              "disabled:cursor-not-allowed disabled:opacity-50",
                            )}
                          >
                            {ogExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                            {ogExtracting ? "AI 추출 중..." : "AI 메타 이미지 추출"}
                          </button>
                        )}
                        {editing.mediaUrl && /drive\.google\.com|googleusercontent\.com|docs\.google\.com/.test(editing.mediaUrl) && (
                          <div className="mt-1 space-y-1 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                            <p className="font-medium">⚠ Google 파일 공유 설정 필수</p>
                            <p>비회원도 볼 수 있으려면 Google Drive에서 해당 파일의 공유 설정을 <strong>&quot;링크가 있는 모든 사용자&quot;</strong>로 변경해야 합니다.</p>
                            <p className="text-amber-600">파일 우클릭 → 공유 → 일반 액세스 → &quot;링크가 있는 모든 사용자&quot;</p>
                          </div>
                        )}
                      </div>
                      {editing.thumbnailUrl && (
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                          <p className="mb-1 text-[11px] text-gray-400">썸네일 미리보기</p>
                          <div className="h-24 w-40 overflow-hidden rounded bg-white">
                            <MediaPreview
                              mediaUrl={editing.mediaUrl}
                              mediaType={editing.mediaType as MediaType}
                              thumbnailUrl={editing.thumbnailUrl}
                              title="미리보기"
                              className="h-full w-full"
                            />
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">썸네일 URL (선택)</label>
                        <p className="mb-1 text-xs text-gray-500">
                          영어 텍스트 썸네일 대신 한글 안내 이미지(공개 URL)를 넣을 수 있습니다. 비우면 유튜브 기본 썸네일을 사용합니다.
                        </p>
                        <input
                          value={editing.thumbnailUrl || ""}
                          onChange={(e) => setEditing({ ...editing, thumbnailUrl: e.target.value })}
                          placeholder="자동 감지된 썸네일을 덮어쓰려면 입력"
                          className={cn(
                            "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
                            "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                          )}
                        />
                      </div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editing.isShort ?? false}
                          onChange={(e) => setEditing({ ...editing, isShort: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Short (세로 영상)</span>
                      </label>
                    </div>
                  )}

                  {/* 수강후기 */}
                  {selectedBoard === "community-review" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">프로그램명</label>
                        <input
                          value={editing.programTitle || ""}
                          onChange={(e) => setEditing({ ...editing, programTitle: e.target.value })}
                          className={cn(
                            "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
                            "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                          )}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">평점</label>
                        <select
                          value={editing.rating || 5}
                          onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })}
                          className={cn(
                            "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
                            "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                          )}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>{"★".repeat(n)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* 태그 */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">태그</label>
                      <button
                        type="button"
                        onClick={handleRecommendTags}
                        disabled={tagRecLoading}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                          "border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100",
                          "disabled:opacity-50",
                        )}
                        title="제목·본문 기반으로 Gemini가 추천하는 태그를 추가합니다"
                      >
                        {tagRecLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        AI 태그 추천
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                        placeholder="태그 입력 후 Enter"
                        className={cn(
                          "flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm",
                          "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                        )}
                      />
                    </div>
                    {editing.tags && editing.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {editing.tags.map((t) => (
                          <span key={t} className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                            #{t}
                            <button type="button" onClick={() => handleRemoveTag(t)} className="text-gray-400 hover:text-red-500" aria-label="태그 삭제">
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 외부 자료 링크 — Google Drive · Notion · Slack (선택) */}
                  <details className="rounded-xl border border-gray-100 p-3 group">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-gray-700">
                      <ExternalLink size={14} className="text-gray-500" />
                      외부 자료 링크
                      <span className="text-xs font-normal text-gray-400">— Drive · Notion · Slack (선택)</span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Google Drive 링크</label>
                        <input
                          type="url"
                          value={editing.googleLink ?? ""}
                          onChange={(e) => setEditing({ ...editing, googleLink: e.target.value })}
                          placeholder="https://drive.google.com/..."
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Notion 링크</label>
                        <input
                          type="url"
                          value={editing.notionLink ?? ""}
                          onChange={(e) => setEditing({ ...editing, notionLink: e.target.value })}
                          placeholder="https://notion.so/..."
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Slack 링크</label>
                        <input
                          type="url"
                          value={editing.slackLink ?? ""}
                          onChange={(e) => setEditing({ ...editing, slackLink: e.target.value })}
                          placeholder="https://slack.com/..."
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                    </div>
                  </details>

                  {/* 다중 첨부 — Drive 직접 업로드 또는 외부 링크 (최대 3개) */}
                  <details className="rounded-xl border border-gray-100 p-3 group" open={Boolean(editing.attachments && editing.attachments.length > 0)}>
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-gray-700">
                      <Paperclip size={14} className="text-gray-500" />
                      첨부 파일
                      <span className="text-xs font-normal text-gray-400">— 최대 {MAX_CONTENT_ATTACHMENTS}개 · {MAX_CONTENT_ATTACHMENT_MB}MB</span>
                      {editing.attachments && editing.attachments.length > 0 && (
                        <span className="ml-1 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
                          {editing.attachments.length}
                        </span>
                      )}
                    </summary>
                    <div className="mt-3">
                      <DriveFileUploader
                        attachments={editing.attachments ?? []}
                        onChange={(atts) => setEditing({ ...editing, attachments: atts })}
                        maxFiles={MAX_CONTENT_ATTACHMENTS}
                        maxFileSizeMB={MAX_CONTENT_ATTACHMENT_MB}
                        allowLinks
                      />
                    </div>
                  </details>

                  {/* 작성자 표시명 — 외부 출처 글에 원작자를 노출하고 싶을 때만 입력. 비우면 로그인 admin 이름. */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">작성자 표시명 (선택)</label>
                    <p className="mb-1 text-xs text-gray-500">
                      비우면 현재 로그인한 admin의 이름이 자동 표시됩니다. 외부 출처(YouTuber·블로거 등)를 원작자로 명시하려면 입력하세요.
                    </p>
                    <input
                      value={editing.authorName ?? ""}
                      onChange={(e) => setEditing({ ...editing, authorName: e.target.value })}
                      placeholder={profile?.displayName || user?.displayName || "관리자"}
                      className={cn(
                        "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
                        "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                      )}
                    />
                  </div>

                  {/* 옵션 */}
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editing.isPinned ?? false}
                        onChange={(e) => setEditing({ ...editing, isPinned: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">상단 고정</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editing.isApproved ?? true}
                        onChange={(e) => setEditing({ ...editing, isApproved: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">공개 승인</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2 text-sm font-medium text-white",
                  "transition-colors hover:bg-primary-600 disabled:opacity-50",
                )}
              >
                <Save size={14} />
                {saving ? "저장 중..." : isCreating ? "등록" : "수정"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
