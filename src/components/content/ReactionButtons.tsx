"use client";

import { useState, useEffect, useCallback } from "react";
import { Heart, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleReaction, getUserReactions } from "@/lib/content-engine";
import { useAuth } from "@/contexts/AuthContext";
import type { BoardConfig } from "@/types/content";

type Props = {
  contentId: string;
  initialLikes: number;
  board?: BoardConfig;
};

export default function ReactionButtons({ contentId, initialLikes, board }: Props) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikes);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserReactions(contentId, user.uid).then((r) => {
      setLiked(r.liked);
      setBookmarked(r.bookmarked);
    });
  }, [contentId, user]);

  const handleToggle = useCallback(
    async (type: "like" | "bookmark") => {
      if (!user || busy) return;
      setBusy(true);
      try {
        const isNowActive = await toggleReaction(contentId, user.uid, type);
        if (type === "like") {
          setLiked(isNowActive);
          setLikeCount((c) => (isNowActive ? c + 1 : c - 1));
        } else {
          setBookmarked(isNowActive);
        }
      } finally {
        setBusy(false);
      }
    },
    [contentId, user, busy],
  );

  const showLike = board?.allowLikes !== false;
  const showBookmark = board?.allowBookmarks !== false;

  return (
    <div className="flex items-center gap-4">
      {showLike && (
        <button
          type="button"
          onClick={() => handleToggle("like")}
          disabled={!user || busy}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
            liked
              ? "bg-red-50 text-red-500"
              : "text-gray-500 hover:bg-gray-100",
            !user && "cursor-not-allowed opacity-50",
          )}
          aria-label="좋아요"
        >
          <Heart size={16} className={cn(liked && "fill-red-500")} />
          <span>{likeCount}</span>
        </button>
      )}
      {showBookmark && (
        <button
          type="button"
          onClick={() => handleToggle("bookmark")}
          disabled={!user || busy}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
            bookmarked
              ? "bg-primary-50 text-primary-500"
              : "text-gray-500 hover:bg-gray-100",
            !user && "cursor-not-allowed opacity-50",
          )}
          aria-label="북마크"
        >
          <Bookmark size={16} className={cn(bookmarked && "fill-primary-500")} />
        </button>
      )}
    </div>
  );
}
