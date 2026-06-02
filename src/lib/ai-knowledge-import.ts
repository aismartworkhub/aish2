/**
 * AI 지식 가져오기 — 공개 구글 드라이브 폴더 / 유튜브 채널의 텍스트를
 * 상담사 배경지식(siteSettings/ai-knowledge)으로 흡수한다.
 *
 * - 드라이브: 전체 공개 폴더 + 브라우저 API 키로 구글문서/텍스트를 export (OAuth 불필요).
 *   gallery/page.tsx 의 공개 폴더 목록 패턴과 동일 계열.
 * - 유튜브: 기존 listChannelVideos 재사용 (siteSettings/ai-collector.youtubeApiKey).
 */
import { listChannelVideos } from "@/lib/youtube-search";
import { getSingletonDoc, COLLECTIONS } from "@/lib/firestore";
import { KNOWLEDGE_MAX_CHARS } from "@/lib/ai-counselor-context";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const YT_API = "https://www.googleapis.com/youtube/v3";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const DRIVE_FILE_LIMIT = 50;
const YT_VIDEO_LIMIT = 25;
const YT_DESC_MAX = 500;

/** 길이 상한 적용. */
function cap(text: string): string {
  return text.length > KNOWLEDGE_MAX_CHARS ? `${text.slice(0, KNOWLEDGE_MAX_CHARS)}\n…(이하 생략)` : text;
}

/** 브라우저 Google API 키 (siteSettings/integrations.googleApi.apiKey). admin 전용 읽기. */
async function getGoogleApiKey(): Promise<string> {
  const doc = await getSingletonDoc<{ googleApi?: { apiKey?: string } }>(COLLECTIONS.SETTINGS, "integrations");
  return doc?.googleApi?.apiKey?.trim() ?? "";
}

/** 유튜브 Data API 키 (siteSettings/ai-collector.youtubeApiKey). */
async function getYoutubeApiKey(): Promise<string> {
  const doc = await getSingletonDoc<{ youtubeApiKey?: string }>(COLLECTIONS.SETTINGS, "ai-collector");
  return doc?.youtubeApiKey?.trim() ?? "";
}

/**
 * 공개 드라이브 폴더의 구글문서·텍스트 파일을 텍스트로 합쳐 반환한다.
 * @throws API 키 미설정 / 폴더 접근 실패
 */
export async function importDriveFolderText(folderId: string): Promise<{ text: string; fileCount: number }> {
  const id = folderId.trim();
  if (!id) throw new Error("드라이브 폴더 ID를 입력해 주세요.");
  const apiKey = await getGoogleApiKey();
  if (!apiKey) throw new Error("Google API 키가 없습니다. '외부 연동' 탭에서 등록해 주세요.");

  const listParams = new URLSearchParams({
    q: `'${id}' in parents and (mimeType='${GOOGLE_DOC_MIME}' or mimeType='text/plain') and trashed=false`,
    fields: "files(id,name,mimeType)",
    key: apiKey,
    pageSize: String(DRIVE_FILE_LIMIT),
  });
  const res = await fetch(`${DRIVE_API}/files?${listParams.toString()}`);
  if (!res.ok) throw new Error(`드라이브 목록 실패 (${res.status}). 폴더가 '링크 있는 모두 보기'로 공개됐는지, API 키를 확인하세요.`);
  const data = (await res.json()) as { files?: { id: string; name: string; mimeType: string }[] };
  const files = data.files ?? [];
  if (files.length === 0) throw new Error("폴더에 구글문서·텍스트 파일이 없습니다.");

  const parts: string[] = [];
  for (const f of files) {
    try {
      const url =
        f.mimeType === GOOGLE_DOC_MIME
          ? `${DRIVE_API}/files/${f.id}/export?mimeType=text/plain&key=${apiKey}`
          : `${DRIVE_API}/files/${f.id}?alt=media&key=${apiKey}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const t = (await r.text()).trim();
      if (t) parts.push(`# ${f.name}\n${t}`);
    } catch {
      /* 파일 단위 실패는 건너뜀 */
    }
  }
  if (parts.length === 0) throw new Error("문서 본문을 가져오지 못했습니다. 파일 공개 설정을 확인하세요.");
  return { text: cap(parts.join("\n\n")), fileCount: parts.length };
}

/** 입력(채널ID/URL/@핸들)에서 채널 ID(UC...)를 해석한다. */
async function resolveChannelId(apiKey: string, input: string): Promise<string> {
  const raw = input.trim();
  const uc = raw.match(/UC[0-9A-Za-z_-]{22}/);
  if (uc) return uc[0];
  const handle = raw.match(/@([0-9A-Za-z_.-]+)/);
  if (handle) {
    const params = new URLSearchParams({ part: "id", forHandle: `@${handle[1]}`, key: apiKey });
    const r = await fetch(`${YT_API}/channels?${params.toString()}`);
    if (r.ok) {
      const d = (await r.json()) as { items?: { id?: string }[] };
      const found = d.items?.[0]?.id;
      if (found) return found;
    }
  }
  throw new Error("채널을 찾지 못했습니다. 채널 ID(UC…) 또는 @핸들을 입력해 주세요.");
}

/**
 * 유튜브 채널의 최신 영상 제목·설명을 텍스트로 합쳐 반환한다.
 * @throws API 키 미설정 / 채널 해석 실패
 */
export async function importYoutubeChannelText(channelInput: string): Promise<{ text: string; videoCount: number }> {
  if (!channelInput.trim()) throw new Error("유튜브 채널 ID 또는 @핸들을 입력해 주세요.");
  const apiKey = await getYoutubeApiKey();
  if (!apiKey) throw new Error("유튜브 API 키가 없습니다. 'AI 수집' 탭에서 등록해 주세요.");

  const channelId = await resolveChannelId(apiKey, channelInput);
  const { items } = await listChannelVideos(apiKey, channelId, { maxResults: YT_VIDEO_LIMIT, order: "date" });
  if (items.length === 0) throw new Error("채널에서 영상을 찾지 못했습니다.");

  const parts = items.map((v) => {
    const desc = v.description?.trim() ? `\n${v.description.trim().slice(0, YT_DESC_MAX)}` : "";
    return `- ${v.title}${desc}`;
  });
  return { text: cap(parts.join("\n\n")), videoCount: items.length };
}
