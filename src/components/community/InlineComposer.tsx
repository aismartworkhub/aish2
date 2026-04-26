"use client";

import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import LoginModal from "@/components/public/LoginModal";

export type InlineComposerSubmit = (data: {
  title: string;
  body: string;
  tags: string[];
}) => Promise<boolean>;

/**
 * X 스타일 인라인 컴포저.
 * - 평상시: 플레이스홀더 1줄 (Plus 아이콘)
 * - 클릭 시 펼쳐짐: 제목·본문·태그 + 등록/취소
 * - 비로그인 → LoginModal
 * - 등록 성공 시 자동 접힘·필드 초기화
 */
export default function InlineComposer({
  onSubmit,
  placeholder = "무엇을 나누고 싶으세요?",
}: {
  onSubmit: InlineComposerSubmit;
  placeholder?: string;
}) {
  const { user, profile } = useAuth();
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    setBody("");
    setTagInput("");
    setTags([]);
    setExpanded(false);
  };

  const tryExpand = () => {
    if (!user) {
      requireLogin(() => setExpanded(true), "글쓰기는 로그인 후 가능합니다.");
      return;
    }
    setExpanded(true);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim() || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit({
        title: title.trim(),
        body: body.trim(),
        tags,
      });
      if (ok) reset();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="border-b border-brand-border bg-white p-4">
        <div className="flex gap-3">
          {/* 아바타 */}
          {user && profile?.photoURL ? (
            <img
              src={profile.photoURL}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-bold text-white">
              {user ? (profile?.displayName ?? user.displayName ?? "U").charAt(0) : "?"}
            </div>
          )}
          <div className="flex-1">
            {!expanded ? (
              <button
                type="button"
                onClick={tryExpand}
                className={cn(
                  "flex w-full items-center justify-between rounded-full bg-gray-100 px-4 py-2.5 text-left text-sm text-gray-500",
                  "hover:bg-gray-200 transition-colors",
                )}
              >
                <span>{placeholder}</span>
                <Plus size={16} className="text-gray-400" />
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="제목"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  autoFocus
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="본문을 입력하세요..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">
                      #{t}
                      <button type="button" onClick={() => removeTag(t)} aria-label={`${t} 제거`}>
                        <X size={10} className="text-gray-400 hover:text-red-500" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="태그 + Enter"
                    className="flex-1 min-w-[140px] rounded-full border border-gray-200 px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!title.trim() || !body.trim() || submitting}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                      "bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50",
                    )}
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    {submitting ? "등록 중..." : "등록"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </>
  );
}
