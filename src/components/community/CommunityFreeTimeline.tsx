"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import LoginModal from "@/components/public/LoginModal";
import { useInfiniteContents } from "@/hooks/useInfiniteContents";
import { ContentCard } from "@/components/content";
import ContentDetailModal from "@/components/content/ContentDetailModal";
import InlineComposer from "@/components/community/InlineComposer";
import { createContent } from "@/lib/content-engine";
import { useToast } from "@/components/ui/Toast";
import type { Content } from "@/types/content";

/**
 * /community 자유게시판 탭의 X 스타일 타임라인.
 * - 인라인 컴포저 (상단)
 * - useInfiniteContents 무한 스크롤
 * - ContentCard variant="timeline"
 * - 클릭 시 ContentDetailModal — 댓글·좋아요·북마크는 모달에서 (Batch 2에서 인라인화)
 */
export default function CommunityFreeTimeline() {
  const { user, profile } = useAuth();
  const { showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Content | null>(null);

  const feed = useInfiniteContents({
    boardKey: "community-free",
    pageSize: 20,
  });

  const handleSubmit = useCallback(
    async (data: { title: string; body: string; tags: string[] }) => {
      if (!user) {
        requireLogin(() => undefined, "글쓰기는 로그인 후 가능합니다.");
        return false;
      }
      try {
        await createContent({
          boardKey: "community-free",
          title: data.title,
          body: data.body,
          tags: data.tags,
          authorUid: user.uid,
          authorName: profile?.displayName ?? user.displayName ?? "익명",
          authorPhotoURL: user.photoURL ?? undefined,
          isApproved: false, // 일반 회원 글은 승인 대기 (firestore rules의 isApproved=false 조건과 일치)
        });
        toast("등록되었습니다. 승인 후 공개됩니다.", "success");
        feed.refresh();
        return true;
      } catch (e) {
        toast(`등록 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
        return false;
      }
    },
    [user, profile, requireLogin, toast, feed],
  );

  return (
    <div className="card-base overflow-hidden">
      <div className="border-b border-brand-border p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-brand-dark uppercase tracking-tight">묻고 답하기</h2>
            <p className="mt-1 text-sm text-gray-500">궁금한 점을 질문하고 서로 답변을 나눠보세요.</p>
          </div>
        </div>
      </div>

      {/* 인라인 컴포저 */}
      <InlineComposer
        onSubmit={handleSubmit}
        placeholder="무엇을 나누고 싶으세요?"
      />

      {/* 무한 스크롤 타임라인 */}
      <div>
        {feed.loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : feed.error ? (
          <div className="py-16 text-center text-sm text-red-500">{feed.error}</div>
        ) : feed.items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            아직 게시물이 없습니다.{user ? " 첫 글을 작성해 보세요!" : ""}
            {!user && (
              <button
                type="button"
                onClick={() => requireLogin(() => undefined, "글쓰기는 로그인 후 가능합니다.")}
                className="ml-2 text-primary-600 underline"
              >
                로그인
              </button>
            )}
          </div>
        ) : (
          <>
            {feed.items
              .filter((c) => c.isApproved !== false || c.authorUid === user?.uid)
              .map((c) => (
                <ContentCard
                  key={c.id}
                  content={c}
                  variant="timeline"
                  onClick={(content) => setSelected(content)}
                />
              ))}
            <div ref={feed.sentinelRef} className="h-12" aria-hidden />
            {feed.loadingMore && (
              <div className="py-4 text-center text-xs text-gray-400">더 불러오는 중...</div>
            )}
            {!feed.hasMore && feed.items.length > 10 && (
              <div className="py-4 text-center text-xs text-gray-400">— 더 이상 글이 없습니다 —</div>
            )}
          </>
        )}
      </div>

      <ContentDetailModal
        content={selected}
        onClose={() => setSelected(null)}
        onSelectRelated={setSelected}
        galleryItems={feed.items}
        onNavigate={setSelected}
      />

      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </div>
  );
}
