/**
 * 즐겨찾는 YouTube 검색 조건.
 * Firestore: siteSettings/youtube-search-presets = { presets: Preset[] }
 * 최대 10개. 관리자만 쓰기 (firestore.rules siteSettings 매처 적용).
 */

import { COLLECTIONS, getSingletonDoc, setSingletonDoc } from "./firestore";

export type YoutubeSearchPreset = {
  name: string;
  /** 검색 폼 상태 스냅샷 */
  opts: {
    categoryId: string;
    keywords: string;
    keywordMode: "or" | "and";
    minViews: number;
    minSubs: number;
    periodDays: number;
    order: "viewCount" | "date" | "relevance";
    duration: "any" | "short" | "medium" | "long";
    maxResults: 25 | 50;
  };
};

export const PRESETS_DOC_ID = "youtube-search-presets";
export const MAX_PRESETS = 10;

type PresetsDoc = { presets?: YoutubeSearchPreset[] };

export async function getPresets(): Promise<YoutubeSearchPreset[]> {
  const doc = await getSingletonDoc<PresetsDoc>(COLLECTIONS.SETTINGS, PRESETS_DOC_ID);
  return doc?.presets ?? [];
}

export async function savePresets(presets: YoutubeSearchPreset[]): Promise<void> {
  const trimmed = presets.slice(0, MAX_PRESETS);
  await setSingletonDoc(COLLECTIONS.SETTINGS, PRESETS_DOC_ID, { presets: trimmed });
}
