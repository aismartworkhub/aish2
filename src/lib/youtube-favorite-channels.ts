/**
 * 선호 YouTube 채널 관리.
 * Firestore: siteSettings/youtube-favorite-channels = { channels: FavoriteChannel[] }
 * 최대 30개. 관리자만 쓰기 (siteSettings 매처 적용).
 */

import { COLLECTIONS, getSingletonDoc, setSingletonDoc } from "./firestore";

export type FavoriteChannel = {
  /** YouTube channelId — "UC" + 22자 base64-like */
  channelId: string;
  channelTitle: string;
  /** ISO 8601 — 등록 시각 */
  addedAt: string;
};

export const MAX_FAVORITE_CHANNELS = 30;
export const DOC_ID = "youtube-favorite-channels";

type FavoriteChannelsDoc = { channels?: FavoriteChannel[] };

export async function getFavoriteChannels(): Promise<FavoriteChannel[]> {
  const doc = await getSingletonDoc<FavoriteChannelsDoc>(COLLECTIONS.SETTINGS, DOC_ID);
  return doc?.channels ?? [];
}

export async function saveFavoriteChannels(channels: FavoriteChannel[]): Promise<void> {
  const trimmed = channels.slice(0, MAX_FAVORITE_CHANNELS);
  await setSingletonDoc(COLLECTIONS.SETTINGS, DOC_ID, { channels: trimmed });
}

/** 중복 추가 방지 (channelId 매칭). 최신을 끝에 추가. */
export async function addFavoriteChannel(channel: FavoriteChannel): Promise<FavoriteChannel[]> {
  const current = await getFavoriteChannels();
  if (current.some((c) => c.channelId === channel.channelId)) return current;
  const next = [...current, channel].slice(0, MAX_FAVORITE_CHANNELS);
  await saveFavoriteChannels(next);
  return next;
}

export async function removeFavoriteChannel(channelId: string): Promise<FavoriteChannel[]> {
  const current = await getFavoriteChannels();
  const next = current.filter((c) => c.channelId !== channelId);
  await saveFavoriteChannels(next);
  return next;
}

/**
 * 입력 문자열에서 channelId 추출.
 * - "UC..." 직접 입력 → 그대로
 * - "https://www.youtube.com/channel/UC..." → 추출
 * - 그 외 (@handle 등) → null
 */
export function extractChannelId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(UC[A-Za-z0-9_-]{22})/);
  return match ? match[1] : null;
}
