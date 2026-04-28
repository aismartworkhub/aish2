"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { createContent, getBoards } from "@/lib/content-engine";
import { mergeBoardsByKey, getBoardsByGroupDefault } from "@/lib/board-defaults";
import type { BoardConfig } from "@/types/content";
import type { YoutubeVideoDetail } from "@/lib/youtube-search";

type Props = {
  video: YoutubeVideoDetail | null;
  /** AI 요약 (Phase 2에서 자동 채움). 태그는 영상 본래 tags를 그대로 사용. */
  initialSummary?: string;
  onClose: () => void;
  /** 발행 성공 시 호출 — 카드에 "발행됨" 배지 표시용 */
  onPublished?: (videoId: string) => void;
};

/**
 * YouTube 영상을 contents 컬렉션에 발행하는 모달.
 * - 보드 선택 (group=media 우선, community 보드도 노출). 기본 추천자료.
 * - 검토 정책 라디오 (검토 대기 / 즉시 공개)
 * - 제목·요약 편집 가능
 * - 태그는 영상 본래 tags 그대로 (편집 가능, 쉼표 구분)
 */
export default function YoutubePublishModal({
  video,
  initialSummary = "",
  onClose,
  onPublished,
}: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [boards, setBoards] = useState<BoardConfig[]>(() =>
    mergeBoardsByKey(getBoardsByGroupDefault("media"), []),
  );
  const [boardKey, setBoardKey] = useState<string>("media-resource");
  const [policy, setPolicy] = useState<"review" | "publish">("review");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 영상 변경 시 폼 초기화
  useEffect(() => {
    if (!video) return;
    setTitle(video.title);
    setSummary(initialSummary || video.description.slice(0, 500));
    const baseTags = (video.tags ?? []).slice(0, 10);
    setTagsInput(baseTags.join(", "));
    setPolicy("review");
  }, [video, initialSummary]);

  // 보드 목록 로드 (media + community 그룹 모두)
  useEffect(() => {
    let cancelled = false;
    getBoards()
      .then((list) => {
        if (cancelled) return;
        const merged = mergeBoardsByKey([
          ...getBoardsByGroupDefault("media"),
          ...getBoardsByGroupDefault("community"),
        ], list);
        setBoards(merged);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const groupedBoards = useMemo(() => {
    const media = boards.filter((b) => b.group === "media");
    const community = boards.filter((b) => b.group === "community");
    return { media, community };
  }, [boards]);

  if (!video) return null;

  const handleSubmit = async () => {
    if (!user) {
      toast("로그인이 필요합니다.", "error");
      return;
    }
    if (!title.trim()) {
      toast("제목을 입력하세요.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await createContent({
        boardKey,
        title: title.trim(),
        body: summary.trim(),
        mediaType: "youtube",
        mediaUrl: video.url,
        thumbnailUrl: video.thumbnailUrl,
        tags,
        isPinned: false,
        isApproved: policy === "publish",
        authorUid: user.uid,
        authorName: profile?.displayName ?? user.displayName ?? "관리자",
        authorPhotoURL: user.photoURL ?? undefined,
        // YouTube 메타 — X.com 스타일 헤더용
        channelTitle: video.channelTitle,
        channelId: video.channelId,
        channelUrl: video.channelId ? `https://www.youtube.com/channel/${video.channelId}` : undefined,
        publishedAtSource: video.publishedAt,
        viewCountSource: video.viewCount,
        likeCountSource: video.likeCount,
        durationSeconds: video.durationSeconds,
      });
      toast(
        policy === "publish" ? "공개 발행되었습니다." : "검토 대기로 등록되었습니다.",
        "success",
      );
      onPublished?.(video.videoId);
      onClose();
    } catch (e) {
      toast(`발행 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-bold text-gray-900">YouTube 영상 발행</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 (스크롤) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 영상 미리보기 */}
          <div className="flex gap-3">
            {video.thumbnailUrl && (
              <img src={video.thumbnailUrl} alt="" className="h-20 w-32 shrink-0 rounded object-cover" />
            )}
            <div className="min-w-0 flex-1 text-xs text-gray-500">
              <div className="line-clamp-2 text-sm font-semibold text-gray-900">{video.title}</div>
              <div className="mt-1">{video.channelTitle} · {video.viewCount.toLocaleString()}회</div>
            </div>
          </div>

          {/* 보드 선택 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">발행 보드</label>
            <select
              value={boardKey}
              onChange={(e) => setBoardKey(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <optgroup label="콘텐츠 (media)">
                {groupedBoards.media.map((b) => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </optgroup>
              <optgroup label="커뮤니티 (community)">
                {groupedBoards.community.map((b) => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 검토 정책 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">검토 정책</label>
            <div className="grid grid-cols-2 gap-2">
              <label className={cn(
                "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors",
                policy === "review" ? "border-amber-300 bg-amber-50" : "border-gray-200 hover:border-gray-300",
              )}>
                <input
                  type="radio"
                  name="policy"
                  value="review"
                  checked={policy === "review"}
                  onChange={() => setPolicy("review")}
                  className="mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-1 font-medium">
                    <ShieldAlert size={14} className="text-amber-500" />
                    검토 대기
                  </div>
                  <div className="text-xs text-gray-500">isApproved=false. /admin에서 검토 후 공개</div>
                </div>
              </label>
              <label className={cn(
                "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors",
                policy === "publish" ? "border-emerald-300 bg-emerald-50" : "border-gray-200 hover:border-gray-300",
              )}>
                <input
                  type="radio"
                  name="policy"
                  value="publish"
                  checked={policy === "publish"}
                  onChange={() => setPolicy("publish")}
                  className="mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-1 font-medium">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    즉시 공개
                  </div>
                  <div className="text-xs text-gray-500">isApproved=true. 신뢰 채널에만 권장</div>
                </div>
              </label>
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          {/* 요약 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              요약/본문 <span className="text-xs text-gray-400">({summary.length}자)</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="AI 요약 결과 또는 직접 작성"
            />
          </div>

          {/* 태그 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">태그 (쉼표 구분)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="LLM, 파인튜닝, 한국어"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "등록 중..." : policy === "publish" ? "즉시 공개" : "검토 대기로 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
