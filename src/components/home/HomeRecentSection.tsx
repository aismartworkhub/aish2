"use client";

import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useAuth } from "@/contexts/AuthContext";
import type { Content } from "@/types/content";
import RecentActivityFeed from "@/components/home/RecentActivityFeed";
import UnifiedFeedSection from "@/components/home/UnifiedFeedSection";

interface Props {
  /** 기존 RecentActivityFeed로 폴백할 때 사용할 최근 콘텐츠 */
  items: Content[];
}

/**
 * 홈 "최근 활동" 영역 — Feature Flag phase6에 따라 통합 피드 또는 기존 노출.
 *
 * 분기 규칙:
 *   - phase6.enabled === false → 기존 RecentActivityFeed (현행)
 *   - phase6.enabled && audienceLevel === "all" → 모두 통합 피드
 *   - phase6.enabled && audienceLevel === "admin" → 관리자만 통합 피드
 */
export default function HomeRecentSection({ items }: Props) {
  const ff = useFeatureFlags();
  const { profile } = useAuth();

  const phase6 = ff.phase6;
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const showUnified =
    phase6.enabled &&
    phase6.unifiedFeedHome !== false &&
    (phase6.audienceLevel === "all" || (phase6.audienceLevel === "admin" && isAdmin));

  if (showUnified) {
    return <UnifiedFeedSection phase6={phase6} />;
  }
  return <RecentActivityFeed items={items} />;
}
