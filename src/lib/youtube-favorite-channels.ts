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
 * 입력 문자열에서 channelId 추출 (regex만 — API 호출 없음).
 * 호환을 위해 유지. 새 코드는 `parseChannelInput`을 권장.
 */
export function extractChannelId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(UC[A-Za-z0-9_-]{22})/);
  return match ? match[1] : null;
}

/**
 * 입력 문자열의 종류를 판별. 영상/핸들/사용자명은 후속 API 호출이 필요하다.
 *
 * 인식 우선순위:
 *  1) UC 채널 ID (URL 안의 것 포함) — API 0 단위
 *  2) /c/customUrl — 명시적으로 unsupported (search.list 100단위 비쌈)
 *  3) 영상 URL (watch?v=, youtu.be/, /shorts/, /embed/) — videos.list 1단위
 *  4) @handle (URL 또는 단독) — channels.list?forHandle 1단위
 *  5) /user/legacyName — channels.list?forUsername 1단위
 */
export type ChannelInputParse =
  | { kind: "channelId"; channelId: string }
  | { kind: "videoId"; videoId: string }
  | { kind: "handle"; handle: string }
  | { kind: "username"; username: string }
  | { kind: "unsupported"; reason: string }
  | { kind: "empty" };

const VIDEO_ID_RE = /[A-Za-z0-9_-]{11}/;
const HANDLE_RE = /^[A-Za-z0-9._-]{3,30}$/;
const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;

export function parseChannelInput(rawInput: string): ChannelInputParse {
  const input = rawInput.trim();
  if (!input) return { kind: "empty" };

  // 1) UC 채널 ID — URL 안에 들어있어도 우선 추출
  const ucMatch = input.match(/(UC[A-Za-z0-9_-]{22})/);
  if (ucMatch) return { kind: "channelId", channelId: ucMatch[1] };

  // URL 인지 확인 (도메인 기반 휴리스틱)
  const isUrl = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(input);

  if (isUrl) {
    // 2) /c/customUrl — 미지원
    const cUrlMatch = input.match(/\/c\/([^/?#]+)/i);
    if (cUrlMatch) {
      return {
        kind: "unsupported",
        reason: "/c/ 형식 URL은 자동 인식이 비쌉니다. 해당 채널의 아무 영상 URL을 대신 붙여넣어 주세요.",
      };
    }

    // 3) 영상 URL
    //    - youtu.be/{id}
    //    - youtube.com/watch?v={id}
    //    - youtube.com/shorts/{id}
    //    - youtube.com/embed/{id}
    //    - youtube.com/live/{id}
    const youtuBe = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/i);
    if (youtuBe) return { kind: "videoId", videoId: youtuBe[1] };

    const watchV = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (watchV) return { kind: "videoId", videoId: watchV[1] };

    const pathVid = input.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/i);
    if (pathVid) return { kind: "videoId", videoId: pathVid[1] };

    // 4) @handle URL
    const handleUrl = input.match(/youtube\.com\/@([A-Za-z0-9._-]{3,30})/i);
    if (handleUrl) return { kind: "handle", handle: `@${handleUrl[1]}` };

    // 5) /user/legacyName
    const userUrl = input.match(/youtube\.com\/user\/([A-Za-z0-9_]{3,30})/i);
    if (userUrl) return { kind: "username", username: userUrl[1] };

    return {
      kind: "unsupported",
      reason: "URL에서 채널을 인식할 수 없습니다. 채널의 아무 영상 URL을 붙여넣어 보세요.",
    };
  }

  // URL이 아닌 경우
  // 4') @handle 단독 입력
  if (input.startsWith("@")) {
    const handle = input.slice(1);
    if (HANDLE_RE.test(handle)) return { kind: "handle", handle: input };
    return { kind: "unsupported", reason: "@핸들 형식이 올바르지 않습니다." };
  }

  // 영상 ID 단독 (11자) — UC가 아니므로 정확히 11자만 매칭 시도
  if (input.length === 11 && VIDEO_ID_RE.test(input)) {
    return { kind: "videoId", videoId: input };
  }

  // 마지막으로 username 시도
  if (USERNAME_RE.test(input)) {
    return { kind: "username", username: input };
  }

  return {
    kind: "unsupported",
    reason: "입력을 인식할 수 없습니다. 채널 ID, 채널 URL, 영상 URL, 또는 @핸들을 붙여넣어 주세요.",
  };
}

/* ── API resolver ────────────────────────────────────────────── */

export type ResolvedChannel = {
  channelId: string;
  channelTitle: string;
  /** 자동 인식 결과 안내용 — 어떤 입력 형태로 찾았는지 */
  source: "channelId" | "videoId" | "handle" | "username";
  /** 호출 비용 (단위) */
  quotaUsed: number;
};

const YT_API = "https://www.googleapis.com/youtube/v3";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`YouTube API 호출 실패 (HTTP ${res.status}) ${txt.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/**
 * `parseChannelInput` 결과를 받아 실제 channelId+title을 결정한다.
 * - kind === "channelId" → channels.list로 title만 검증 (1단위)
 * - kind === "videoId" → videos.list?part=snippet → snippet.channelId/Title (1단위)
 * - kind === "handle" → channels.list?forHandle (1단위)
 * - kind === "username" → channels.list?forUsername (1단위, 레거시)
 *
 * 실패 시 throw.
 */
export async function resolveChannelFromInput(
  apiKey: string,
  parsed: ChannelInputParse,
): Promise<ResolvedChannel> {
  if (parsed.kind === "empty") throw new Error("입력이 비어있습니다.");
  if (parsed.kind === "unsupported") throw new Error(parsed.reason);

  if (parsed.kind === "channelId") {
    const sp = new URLSearchParams({ part: "snippet", id: parsed.channelId, key: apiKey });
    const data = await fetchJson<{ items?: { snippet?: { title?: string } }[] }>(
      `${YT_API}/channels?${sp.toString()}`,
    );
    const title = data.items?.[0]?.snippet?.title;
    if (!title) throw new Error("존재하지 않는 채널 ID입니다.");
    return { channelId: parsed.channelId, channelTitle: title, source: "channelId", quotaUsed: 1 };
  }

  if (parsed.kind === "videoId") {
    const sp = new URLSearchParams({ part: "snippet", id: parsed.videoId, key: apiKey });
    const data = await fetchJson<{
      items?: { snippet?: { channelId?: string; channelTitle?: string } }[];
    }>(`${YT_API}/videos?${sp.toString()}`);
    const snip = data.items?.[0]?.snippet;
    if (!snip?.channelId || !snip.channelTitle) {
      throw new Error("영상에서 채널을 찾을 수 없습니다. 비공개·삭제된 영상일 수 있습니다.");
    }
    return {
      channelId: snip.channelId,
      channelTitle: snip.channelTitle,
      source: "videoId",
      quotaUsed: 1,
    };
  }

  if (parsed.kind === "handle") {
    const sp = new URLSearchParams({ part: "snippet", forHandle: parsed.handle, key: apiKey });
    const data = await fetchJson<{ items?: { id?: string; snippet?: { title?: string } }[] }>(
      `${YT_API}/channels?${sp.toString()}`,
    );
    const item = data.items?.[0];
    if (!item?.id || !item.snippet?.title) {
      throw new Error(`핸들 ${parsed.handle}을(를) 가진 채널을 찾을 수 없습니다.`);
    }
    return { channelId: item.id, channelTitle: item.snippet.title, source: "handle", quotaUsed: 1 };
  }

  // username (legacy)
  const sp = new URLSearchParams({ part: "snippet", forUsername: parsed.username, key: apiKey });
  const data = await fetchJson<{ items?: { id?: string; snippet?: { title?: string } }[] }>(
    `${YT_API}/channels?${sp.toString()}`,
  );
  const item = data.items?.[0];
  if (!item?.id || !item.snippet?.title) {
    throw new Error(`사용자명 "${parsed.username}"을(를) 가진 채널을 찾을 수 없습니다.`);
  }
  return { channelId: item.id, channelTitle: item.snippet.title, source: "username", quotaUsed: 1 };
}
