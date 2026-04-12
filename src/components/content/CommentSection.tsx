"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, Trash2, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getCommentsByContent, createComment, deleteComment } from "@/lib/content-engine";
import type { ContentComment } from "@/types/content";

type Props = {
  contentId: string;
};

function timeLabel(dateVal: unknown): string {
  if (!dateVal) return "";
  const d =
    typeof dateVal === "string"
      ? new Date(dateVal)
      : (dateVal as { toDate?: () => Date }).toDate?.() ?? new Date();
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}일 전`;
  return d.toLocaleDateString("ko-KR");
}

function CommentItem({
  comment,
  isReply,
  onDelete,
  onReply,
  canDelete,
}: {
  comment: ContentComment;
  isReply?: boolean;
  onDelete: (id: string) => void;
  onReply: (id: string) => void;
  canDelete: boolean;
}) {
  return (
    <div className={cn("flex gap-2.5 py-2.5", isReply && "ml-8")}>
      {isReply && <CornerDownRight size={14} className="mt-1 shrink-0 text-gray-300" />}
      {comment.authorPhotoURL ? (
        <img
          src={comment.authorPhotoURL}
          alt={comment.authorName}
          className="h-7 w-7 shrink-0 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-500">
          {comment.authorName[0]}
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">{comment.authorName}</span>
          <span className="text-[11px] text-gray-400" suppressHydrationWarning>{timeLabel(comment.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">{comment.body}</p>
        <div className="mt-1 flex gap-3">
          {!isReply && (
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              className="text-[11px] text-gray-400 hover:text-gray-600"
            >
              답글
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="text-[11px] text-gray-400 hover:text-red-500"
              aria-label="댓글 삭제"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommentSection({ contentId }: Props) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const data = await getCommentsByContent(contentId);
    setComments(data);
  }, [contentId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!user || !text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createComment({
        contentId,
        parentId: replyTo,
        authorUid: user.uid,
        authorName: profile?.displayName ?? user.displayName ?? "사용자",
        authorPhotoURL: user.photoURL ?? null,
        body: text.trim(),
      });
      setText("");
      setReplyTo(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    await deleteComment(commentId, contentId);
    await load();
  };

  const rootComments = comments.filter((c) => !c.parentId);
  const replies = (parentId: string) => comments.filter((c) => c.parentId === parentId);

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold text-gray-700">
        댓글 {comments.length > 0 && <span className="text-primary-500">{comments.length}</span>}
      </h4>

      <div className="divide-y divide-gray-100">
        {rootComments.map((c) => (
          <div key={c.id}>
            <CommentItem
              comment={c}
              onDelete={handleDelete}
              onReply={setReplyTo}
              canDelete={isAdmin || c.authorUid === user?.uid}
            />
            {replies(c.id).map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                isReply
                onDelete={handleDelete}
                onReply={setReplyTo}
                canDelete={isAdmin || r.authorUid === user?.uid}
              />
            ))}
          </div>
        ))}
      </div>

      {user ? (
        <div className="mt-3">
          {replyTo && (
            <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
              <CornerDownRight size={12} />
              <span>답글 작성 중</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                취소
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="댓글을 입력하세요..."
              className={cn(
                "flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className={cn(
                "flex items-center gap-1 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white",
                "transition-colors hover:bg-primary-600",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              aria-label="댓글 등록"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-center text-xs text-gray-400">
          로그인 후 댓글을 작성할 수 있습니다.
        </p>
      )}
    </div>
  );
}
