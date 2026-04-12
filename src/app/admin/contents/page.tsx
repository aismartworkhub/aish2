"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Search, Edit, Trash2, X, Save, Pin, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_BOARDS } from "@/lib/board-defaults";
import {
  getBoards,
  getContents,
  createContent,
  updateContent,
  deleteContent,
  detectMediaType,
} from "@/lib/content-engine";
import type { BoardConfig, Content, ContentInput, MediaType } from "@/types/content";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import MediaPreview from "@/components/content/MediaPreview";

const EMPTY_CONTENT: Omit<ContentInput, "authorUid" | "authorName"> = {
  boardKey: "",
  title: "",
  body: "",
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
};

export default function AdminContentsPage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [boards, setBoards] = useState<BoardConfig[]>(DEFAULT_BOARDS);
  const [selectedBoard, setSelectedBoard] = useState<string>("");
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editing, setEditing] = useState<(Omit<ContentInput, "authorUid" | "authorName"> & { id?: string }) | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    getBoards()
      .then((b) => {
        if (b.length > 0) setBoards(b);
      })
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
      body: c.body ?? "",
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
      const data: ContentInput = {
        ...editing,
        boardKey: selectedBoard,
        authorUid: user.uid,
        authorName: profile?.displayName ?? user.displayName ?? "관리자",
        authorPhotoURL: user.photoURL ?? undefined,
        title: isFaq ? (editing.question ?? "") : editing.title,
      };

      if (isCreating) {
        await createContent(data);
        toast("콘텐츠가 등록되었습니다.", "success");
      } else if (editing.id) {
        await updateContent(editing.id, data);
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
      await loadContents();
    } catch {
      toast("삭제 실패.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">통합 콘텐츠 관리</h1>
          <p className="mt-1 text-sm text-gray-500">콘텐츠·커뮤니티 게시판을 통합 관리합니다.</p>
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

      {/* 검색 */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="제목, 작성자, 태그 검색..."
          className={cn(
            "w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
          )}
        />
      </div>

      {/* 콘텐츠 목록 */}
      {loading ? (
        <AdminLoading />
      ) : error ? (
        <AdminError message={error} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              {searchQuery ? "검색 결과가 없습니다." : "등록된 콘텐츠가 없습니다. '새 콘텐츠' 버튼을 눌러 추가하세요."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">제목</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">작성자</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 hidden md:table-cell">조회</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 hidden md:table-cell">좋아요</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.isPinned && <Pin size={12} className="text-primary-500" />}
                        {c.thumbnailUrl && (
                          <div className="h-8 w-12 shrink-0 overflow-hidden rounded bg-gray-100">
                            <MediaPreview
                              mediaUrl={c.mediaUrl}
                              mediaType={c.mediaType}
                              thumbnailUrl={c.thumbnailUrl}
                              title={c.title}
                              className="h-full w-full"
                            />
                          </div>
                        )}
                        <span className="truncate font-medium text-gray-800">
                          {isFaq ? c.question || c.title : c.title}
                        </span>
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
                ))}
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
                    <label className="mb-1 block text-sm font-medium text-gray-700">본문</label>
                    <textarea
                      value={editing.body || ""}
                      onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                      rows={5}
                      className={cn(
                        "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none",
                        "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                      )}
                    />
                  </div>

                  {/* 콘텐츠 URL */}
                  {activeBoard?.group === "media" && (
                    <div className="space-y-3">
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
                    <div className="grid grid-cols-2 gap-4">
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
                    <label className="mb-1 block text-sm font-medium text-gray-700">태그</label>
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
