/**
 * 레거시 컬렉션 → contents 컬렉션 일괄 마이그레이션
 * 관리자 도구에서 호출. 이미 존재하는 ID는 건너뛴다.
 */
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { COLLECTIONS } from "./firestore";
import {
  loadLegacyVideosAsContent,
  loadLegacyGalleryAsContent,
  loadLegacyResourcesAsContent,
  loadLegacyPostsAsContent,
  loadLegacyReviewsAsContent,
  loadLegacyFaqAsContent,
} from "./legacy-adapter";
import type { Content } from "@/types/content";

export interface MigrationResult {
  total: number;
  created: number;
  skipped: number;
  errors: number;
  details: string[];
}

async function migrateContents(items: Content[], label: string): Promise<MigrationResult> {
  const result: MigrationResult = { total: items.length, created: 0, skipped: 0, errors: 0, details: [] };

  for (const item of items) {
    try {
      const docRef = doc(db, COLLECTIONS.CONTENTS, item.id);
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        result.skipped++;
        continue;
      }

      const { id, ...data } = item;
      await setDoc(docRef, {
        ...data,
        views: data.views || 0,
        likeCount: data.likeCount || 0,
        commentCount: data.commentCount || 0,
        createdAt: data.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        _migratedFrom: label,
      });
      result.created++;
    } catch (e) {
      result.errors++;
      result.details.push(`${label}/${item.id}: ${e instanceof Error ? e.message : "오류"}`);
    }
  }

  result.details.unshift(`[${label}] 전체 ${result.total}건 → 생성 ${result.created}, 건너뜀 ${result.skipped}, 오류 ${result.errors}`);
  return result;
}

export async function runFullMigration(
  onProgress?: (msg: string) => void,
): Promise<MigrationResult> {
  if (!auth.currentUser) {
    throw new Error("로그인 상태가 아닙니다. 다시 로그인 후 시도해주세요.");
  }
  await auth.currentUser.getIdToken(true);

  const total: MigrationResult = { total: 0, created: 0, skipped: 0, errors: 0, details: [] };

  const merge = (r: MigrationResult) => {
    total.total += r.total;
    total.created += r.created;
    total.skipped += r.skipped;
    total.errors += r.errors;
    total.details.push(...r.details);
  };

  const steps: { label: string; load: () => Promise<Content[]> }[] = [
    { label: "videos", load: loadLegacyVideosAsContent },
    { label: "gallery", load: loadLegacyGalleryAsContent },
    { label: "resources", load: loadLegacyResourcesAsContent },
    { label: "posts-notice", load: () => loadLegacyPostsAsContent("NOTICE", "community-notice") },
    { label: "posts-free", load: () => loadLegacyPostsAsContent("FREE", "community-free") },
    { label: "posts-resource", load: () => loadLegacyPostsAsContent("RESOURCE", "media-resource") },
    { label: "reviews", load: loadLegacyReviewsAsContent },
    { label: "faq", load: loadLegacyFaqAsContent },
  ];

  for (const step of steps) {
    onProgress?.(`${step.label} 처리 중...`);
    try {
      const items = await step.load();
      const result = await migrateContents(items, step.label);
      merge(result);
    } catch (e) {
      total.errors++;
      total.details.push(`[${step.label}] 로드 실패: ${e instanceof Error ? e.message : "오류"}`);
    }
  }

  return total;
}
