/**
 * 통합 게시판 엔진 — Firestore CRUD 헬퍼
 * boards / contents / contentComments / reactions 4개 컬렉션을 다룬다.
 */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  increment,
  startAfter,
  DocumentData,
  type QueryDocumentSnapshot,
  type QueryConstraint,
  limit as firestoreLimit,
} from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS, invalidateCache } from "./firestore";
import { extractYouTubeVideoId } from "./youtube";
import { DEFAULT_BOARDS } from "./board-defaults";
import type {
  BoardConfig,
  Content,
  ContentInput,
  ContentComment,
  ContentCommentInput,
  Reaction,
  ReactionType,
} from "@/types/content";

// ── Board 관련 ──

export async function getBoards(): Promise<BoardConfig[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.BOARDS), orderBy("order", "asc")),
  );
  return snap.docs.map((d) => ({ ...d.data(), key: d.id } as BoardConfig));
}

/**
 * boardKey → BoardConfig 5분 메모리 캐시.
 * createContent/updateContent 시 group denormalize 용도.
 * Firestore boards가 비어있으면 DEFAULT_BOARDS 폴백.
 */
const BOARD_LOOKUP_TTL_MS = 5 * 60_000;
let boardLookupCache: { map: Map<string, BoardConfig>; expiresAt: number } | null = null;

async function getBoardByKey(boardKey: string): Promise<BoardConfig | null> {
  const now = Date.now();
  if (boardLookupCache && boardLookupCache.expiresAt > now) {
    return boardLookupCache.map.get(boardKey) ?? null;
  }
  try {
    const list = await getBoards();
    const map = new Map<string, BoardConfig>();
    for (const b of DEFAULT_BOARDS) map.set(b.key, b);
    for (const b of list) map.set(b.key, b);
    boardLookupCache = { map, expiresAt: now + BOARD_LOOKUP_TTL_MS };
    return map.get(boardKey) ?? null;
  } catch {
    const fallback = new Map<string, BoardConfig>();
    for (const b of DEFAULT_BOARDS) fallback.set(b.key, b);
    return fallback.get(boardKey) ?? null;
  }
}

export function invalidateBoardLookupCache(): void {
  boardLookupCache = null;
}

export async function getBoardsByGroup(
  group: BoardConfig["group"],
): Promise<BoardConfig[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.BOARDS),
      where("group", "==", group),
      orderBy("order", "asc"),
    ),
  );
  return snap.docs.map((d) => ({ ...d.data(), key: d.id } as BoardConfig));
}

export async function upsertBoard(
  key: string,
  data: Omit<BoardConfig, "key">,
): Promise<void> {
  const { setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, COLLECTIONS.BOARDS, key), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  invalidateCache(COLLECTIONS.BOARDS);
}

// ── 태그 카운트 ──

/** 태그 → Firestore 문서 ID. 빈/위험한 값은 null. */
function tagToDocId(tag: string): string | null {
  const t = tag.toLowerCase().trim().replace(/\//g, "_");
  if (!t || t === "." || t === "..") return null;
  return t.length > 1500 ? t.slice(0, 1500) : t;
}

/**
 * 태그 사용 횟수 increment/decrement.
 * - delta=+1: 콘텐츠 등록·태그 추가
 * - delta=-1: 콘텐츠 삭제·태그 제거
 * - 실패해도 본 작업(create/update/delete)은 막지 않음 — best-effort
 */
async function adjustTagCounts(tags: string[], delta: 1 | -1): Promise<void> {
  if (!tags || tags.length === 0) return;
  const { setDoc } = await import("firebase/firestore");
  const tasks = tags
    .map((t) => ({ id: tagToDocId(t), original: t }))
    .filter((x): x is { id: string; original: string } => x.id !== null);
  await Promise.all(
    tasks.map(async ({ id, original }) => {
      try {
        await setDoc(
          doc(db, COLLECTIONS.TAG_COUNTS, id),
          {
            tag: original,
            count: increment(delta),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch {
        // 카운트 실패는 무시
      }
    }),
  );
}

/** 콘텐츠의 태그 변경 diff를 계산하여 tagCounts에 반영. */
async function applyTagDiff(
  oldTags: string[] | undefined,
  newTags: string[] | undefined,
): Promise<void> {
  const oldSet = new Set((oldTags ?? []).map((t) => t.toLowerCase().trim()));
  const newSet = new Set((newTags ?? []).map((t) => t.toLowerCase().trim()));
  const added: string[] = [];
  const removed: string[] = [];
  for (const t of newSet) if (!oldSet.has(t)) added.push(t);
  for (const t of oldSet) if (!newSet.has(t)) removed.push(t);
  await Promise.all([
    added.length ? adjustTagCounts(added, 1) : Promise.resolve(),
    removed.length ? adjustTagCounts(removed, -1) : Promise.resolve(),
  ]);
}

/**
 * 관련 콘텐츠: 같은 보드 + 태그 array-contains-any. 현재 글은 제외.
 * 태그가 없으면 같은 보드의 최신 글을 폴백으로 반환.
 */
export async function getRelatedContents(opts: {
  excludeId: string;
  boardKey: string;
  tags?: string[];
  limit?: number;
}): Promise<Content[]> {
  const max = opts.limit ?? 4;
  const usableTags = (opts.tags ?? []).slice(0, 10);
  const constraints: QueryConstraint[] = [where("boardKey", "==", opts.boardKey)];
  if (usableTags.length > 0) {
    constraints.push(where("tags", "array-contains-any", usableTags));
  }
  constraints.push(orderBy("createdAt", "desc"));
  // exclude는 클라이언트 필터 (Firestore != 쿼리 + orderBy 제약 회피)
  constraints.push(firestoreLimit(max + 1));
  const q = query(collection(db, COLLECTIONS.CONTENTS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => d.id !== opts.excludeId)
    .slice(0, max)
    .map((d) => ({ id: d.id, ...d.data() } as Content));
}

/** 인기 태그 top N (count desc). 동적 칩·발견 UX용. */
export async function getPopularTags(opts?: { limit?: number }): Promise<{ tag: string; count: number }[]> {
  const max = opts?.limit ?? 10;
  const q = query(
    collection(db, COLLECTIONS.TAG_COUNTS),
    orderBy("count", "desc"),
    firestoreLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data() as { tag?: string; count?: number };
      return { tag: data.tag ?? d.id, count: data.count ?? 0 };
    })
    .filter((x) => x.count > 0);
}

// ── 검색·발견 인프라 ──

/**
 * 제목·본문·태그에서 검색 토큰 추출. Firestore array-contains-any 검색 인프라.
 * - 한글·영문·숫자만 보존, 공백·구두점으로 분리
 * - 길이 < 2 토큰 제거
 * - 최대 30개 (array-contains-any 제약)
 */
export function buildSearchTerms(input: {
  title?: string;
  titleKo?: string;
  body?: string;
  bodyKo?: string;
  tags?: string[];
}): string[] {
  const text = [
    input.title,
    input.titleKo,
    (input.body ?? "").slice(0, 200),
    (input.bodyKo ?? "").slice(0, 200),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tokens = text.split(/[^가-힣a-z0-9]+/i).filter((t) => t.length >= 2);
  for (const tag of input.tags ?? []) {
    const t = tag.toLowerCase().trim();
    if (t.length >= 2) tokens.push(t);
  }
  return [...new Set(tokens)].slice(0, 30);
}

/**
 * 발견 피드용 cursor 페이징.
 * 30초 캐시 우회 — 검색·필터와 무한 스크롤이 결합되므로 별도 함수.
 *
 * 제약:
 * - tags 와 searchTerms 는 둘 다 array-contains-any 라 동시 사용 불가 (Firestore 제약)
 * - 한 쿼리에 하나만 사용 — 우선순위: tags > searchTerms
 * - boardKey + group 동시 지정 시에는 boardKey가 더 강하므로 group은 무시됨
 */
export type ContentsPage = {
  items: Content[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
};

export async function getContentsPaginated(opts: {
  boardKey?: string;
  /** 다중 보드 IN 쿼리 (단일 boardKey보다 우선). Firestore 제약상 최대 30개. */
  boardKeys?: string[];
  group?: BoardConfig["group"];
  tags?: string[];
  searchTerms?: string[];
  lastDoc?: QueryDocumentSnapshot;
  limit?: number;
}): Promise<ContentsPage> {
  const constraints: QueryConstraint[] = [];

  if (opts.boardKeys && opts.boardKeys.length > 0) {
    constraints.push(where("boardKey", "in", opts.boardKeys.slice(0, 30)));
  } else if (opts.boardKey) {
    constraints.push(where("boardKey", "==", opts.boardKey));
  } else if (opts.group) {
    constraints.push(where("group", "==", opts.group));
  }

  if (opts.tags && opts.tags.length > 0) {
    constraints.push(where("tags", "array-contains-any", opts.tags.slice(0, 30)));
  } else if (opts.searchTerms && opts.searchTerms.length > 0) {
    constraints.push(where("searchTerms", "array-contains-any", opts.searchTerms.slice(0, 30)));
  }

  constraints.push(orderBy("createdAt", "desc"));
  if (opts.lastDoc) constraints.push(startAfter(opts.lastDoc));

  const pageSize = opts.limit ?? 24;
  constraints.push(firestoreLimit(pageSize + 1));

  const q = query(collection(db, COLLECTIONS.CONTENTS), ...constraints);
  const snap = await getDocs(q);

  const hasMore = snap.docs.length > pageSize;
  const pageDocs = snap.docs.slice(0, pageSize);
  const items = pageDocs.map((d) => ({ id: d.id, ...d.data() } as Content));
  const lastSnap = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

  return { items, lastDoc: lastSnap, hasMore };
}

// ── Content 관련 ──

export async function getContents(
  boardKey: string,
  options?: { maxItems?: number },
): Promise<Content[]> {
  const q = options?.maxItems
    ? query(
        collection(db, COLLECTIONS.CONTENTS),
        where("boardKey", "==", boardKey),
        orderBy("isPinned", "desc"),
        orderBy("createdAt", "desc"),
        firestoreLimit(options.maxItems),
      )
    : query(
        collection(db, COLLECTIONS.CONTENTS),
        where("boardKey", "==", boardKey),
        orderBy("isPinned", "desc"),
        orderBy("createdAt", "desc"),
      );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Content));
}

export async function getContentById(id: string): Promise<Content | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.CONTENTS, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Content;
}

/**
 * 콘텐츠 ID 배열을 받아 일괄 조회. Firestore "in" 쿼리는 30개까지만 가능하므로
 * 청크 분할 후 Promise.all로 병렬 조회. 결과는 입력 순서대로 정렬.
 */
export async function getContentsByIds(ids: string[]): Promise<Content[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 30) {
    chunks.push(unique.slice(i, i + 30));
  }
  const lookup = new Map<string, Content>();
  await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(collection(db, COLLECTIONS.CONTENTS), where("__name__", "in", chunk));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        lookup.set(d.id, { id: d.id, ...d.data() } as Content);
      }
    }),
  );
  return ids.map((id) => lookup.get(id)).filter((c): c is Content => c !== undefined);
}

/**
 * mediaUrl 일괄 매칭으로 이미 등록된 콘텐츠를 찾는다.
 * YouTube 발행 화면의 "이미 있음" 배지용. Firestore "in" 30개 제약 → 청크 분할.
 */
export async function findContentsByMediaUrls(urls: string[]): Promise<Content[]> {
  if (urls.length === 0) return [];
  const unique = [...new Set(urls.filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 30) {
    chunks.push(unique.slice(i, i + 30));
  }
  const matched: Content[] = [];
  await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(collection(db, COLLECTIONS.CONTENTS), where("mediaUrl", "in", chunk));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        matched.push({ id: d.id, ...d.data() } as Content);
      }
    }),
  );
  return matched;
}

/** 사용자 본인 작성 콘텐츠 (authorUid 매칭, 최신순). 마이 대시보드 "내 글" 탭. */
export async function getMyContents(uid: string, max = 50): Promise<Content[]> {
  const q = query(
    collection(db, COLLECTIONS.CONTENTS),
    where("authorUid", "==", uid),
    orderBy("createdAt", "desc"),
    firestoreLimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Content));
}

/** 사용자 리액션(like/bookmark) → 해당 콘텐츠 일괄 조회. 마이 대시보드용. */
export async function getMyReactedContents(
  uid: string,
  type: ReactionType,
  max = 50,
): Promise<Content[]> {
  const q = query(
    collection(db, COLLECTIONS.REACTIONS),
    where("userId", "==", uid),
    where("type", "==", type),
    orderBy("createdAt", "desc"),
    firestoreLimit(max),
  );
  const snap = await getDocs(q);
  const contentIds = snap.docs.map((d) => (d.data() as Reaction).contentId).filter(Boolean);
  return getContentsByIds(contentIds);
}

export async function createContent(data: ContentInput): Promise<string> {
  const board = await getBoardByKey(data.boardKey);
  const searchTerms = buildSearchTerms({
    title: data.title,
    titleKo: data.titleKo,
    body: data.body,
    bodyKo: data.bodyKo,
    tags: data.tags,
  });
  const ref = await addDoc(collection(db, COLLECTIONS.CONTENTS), {
    ...data,
    ...(board?.group ? { group: board.group } : {}),
    searchTerms,
    views: 0,
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidateCache(COLLECTIONS.CONTENTS);
  // 태그 카운트 +1 (best-effort, 실패해도 본 작업 영향 없음)
  void adjustTagCounts(data.tags ?? [], 1);
  return ref.id;
}

/**
 * mediaUrl 기준으로 중복이 없을 때만 삽입한다.
 * 이미 존재하면 null을 반환한다.
 */
export async function createContentIfNew(
  data: ContentInput,
): Promise<string | null> {
  if (data.mediaUrl) {
    const existing = await getDocs(
      query(
        collection(db, COLLECTIONS.CONTENTS),
        where("mediaUrl", "==", data.mediaUrl),
        firestoreLimit(1),
      ),
    );
    if (!existing.empty) return null;
  }
  return createContent(data);
}

export async function updateContent(
  id: string,
  data: Partial<ContentInput>,
): Promise<void> {
  // boardKey 변경 시 group 재동기화. 검색 필드 또는 태그 변경 시 searchTerms 재계산.
  const extra: { group?: BoardConfig["group"]; searchTerms?: string[] } = {};
  if (data.boardKey) {
    const board = await getBoardByKey(data.boardKey);
    if (board?.group) extra.group = board.group;
  }
  const searchFieldsTouched =
    data.title !== undefined ||
    data.titleKo !== undefined ||
    data.body !== undefined ||
    data.bodyKo !== undefined ||
    data.tags !== undefined;
  let prevTags: string[] | undefined;
  if (searchFieldsTouched) {
    const existing = await getDoc(doc(db, COLLECTIONS.CONTENTS, id));
    const prev = (existing.exists() ? existing.data() : {}) as Partial<Content>;
    prevTags = prev.tags;
    extra.searchTerms = buildSearchTerms({
      title: data.title ?? prev.title,
      titleKo: data.titleKo ?? prev.titleKo,
      body: data.body ?? prev.body,
      bodyKo: data.bodyKo ?? prev.bodyKo,
      tags: data.tags ?? prev.tags,
    });
  }
  await updateDoc(doc(db, COLLECTIONS.CONTENTS, id), {
    ...data,
    ...extra,
    updatedAt: serverTimestamp(),
  } as DocumentData);
  invalidateCache(COLLECTIONS.CONTENTS);
  // 태그 변경 시 diff 반영 (best-effort)
  if (data.tags !== undefined) {
    void applyTagDiff(prevTags, data.tags);
  }
}

export async function deleteContent(id: string): Promise<void> {
  // 삭제 전 태그 읽어 카운트 −1 (best-effort)
  let oldTags: string[] | undefined;
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.CONTENTS, id));
    oldTags = snap.exists() ? (snap.data() as Partial<Content>).tags : undefined;
  } catch {
    oldTags = undefined;
  }
  await deleteDoc(doc(db, COLLECTIONS.CONTENTS, id));
  if (oldTags && oldTags.length > 0) {
    void adjustTagCounts(oldTags, -1);
  }
  invalidateCache(COLLECTIONS.CONTENTS);
}

export async function incrementContentViews(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.CONTENTS, id), {
    views: increment(1),
  });
}

export async function incrementContentDownloads(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.CONTENTS, id), {
    downloadCount: increment(1),
  });
}

// ── Comment 관련 ──

export async function getCommentsByContent(
  contentId: string,
): Promise<ContentComment[]> {
  const q = query(
    collection(db, COLLECTIONS.CONTENT_COMMENTS),
    where("contentId", "==", contentId),
    orderBy("createdAt", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContentComment));
}

export async function createComment(
  data: ContentCommentInput,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.CONTENT_COMMENTS), {
    ...data,
    createdAt: serverTimestamp(),
  });
  // 활동순 정렬 — 댓글 추가 시 부모 콘텐츠의 lastActivityAt 갱신 (통합 피드에서 상단 이동)
  await updateDoc(doc(db, COLLECTIONS.CONTENTS, data.contentId), {
    commentCount: increment(1),
    lastActivityAt: serverTimestamp(),
  });
  invalidateCache(COLLECTIONS.CONTENT_COMMENTS);
  invalidateCache(COLLECTIONS.CONTENTS);
  return ref.id;
}

export async function deleteComment(
  commentId: string,
  contentId: string,
): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.CONTENT_COMMENTS, commentId));
  // 삭제는 lastActivityAt 갱신 안 함 (마지막 진짜 활동 시각 유지)
  await updateDoc(doc(db, COLLECTIONS.CONTENTS, contentId), {
    commentCount: increment(-1),
  });
  invalidateCache(COLLECTIONS.CONTENT_COMMENTS);
  invalidateCache(COLLECTIONS.CONTENTS);
}

// ── Reaction 관련 ──

const reactionDocId = (contentId: string, userId: string, type: ReactionType) =>
  `${contentId}_${userId}_${type}`;

export async function toggleReaction(
  contentId: string,
  userId: string,
  type: ReactionType,
): Promise<boolean> {
  const id = reactionDocId(contentId, userId, type);
  const ref = doc(db, COLLECTIONS.REACTIONS, id);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await deleteDoc(ref);
    if (type === "like") {
      await updateDoc(doc(db, COLLECTIONS.CONTENTS, contentId), {
        likeCount: increment(-1),
      });
    }
    invalidateCache(COLLECTIONS.REACTIONS);
    invalidateCache(COLLECTIONS.CONTENTS);
    return false;
  }

  const { setDoc } = await import("firebase/firestore");
  const reaction: Omit<Reaction, "id"> = {
    contentId,
    userId,
    type,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, reaction);
  if (type === "like") {
    await updateDoc(doc(db, COLLECTIONS.CONTENTS, contentId), {
      likeCount: increment(1),
    });
  }
  invalidateCache(COLLECTIONS.REACTIONS);
  invalidateCache(COLLECTIONS.CONTENTS);
  return true;
}

export async function getUserReactions(
  contentId: string,
  userId: string,
): Promise<{ liked: boolean; bookmarked: boolean }> {
  const likeSnap = await getDoc(
    doc(db, COLLECTIONS.REACTIONS, reactionDocId(contentId, userId, "like")),
  );
  const bmSnap = await getDoc(
    doc(db, COLLECTIONS.REACTIONS, reactionDocId(contentId, userId, "bookmark")),
  );
  return { liked: likeSnap.exists(), bookmarked: bmSnap.exists() };
}

// ── URL → 콘텐츠 유형 자동 감지 ──

const IMAGE_EXT = /\.(jpe?g|png|webp|svg|bmp)(\?|$)/;
const GIF_EXT = /\.gif(\?|$)/;
const PDF_EXT = /\.pdf(\?|$)/;
const DOC_EXT = /\.(docx?|pptx?|xlsx?|hwp|hwpx)(\?|$)/;

export function detectMediaType(url: string): {
  mediaType: Content["mediaType"];
  thumbnailUrl?: string;
  embedUrl?: string;
} {
  if (!url) return { mediaType: "none" };

  // YouTube (watch, embed, shorts, live, youtu.be 모두 지원)
  const videoId = extractYouTubeVideoId(url);
  if (videoId) {
    return {
      mediaType: "youtube",
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
    };
  }

  // Google Drive 링크 → 이미지로 처리 + 썸네일 자동 생성
  const driveFileId = extractDriveFileId(url);
  if (driveFileId) {
    return {
      mediaType: "image",
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w800`,
    };
  }

  // googleusercontent 직접 링크
  const gucMatch = url.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (gucMatch) {
    return {
      mediaType: "image",
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${gucMatch[1]}&sz=w800`,
    };
  }

  const lower = url.toLowerCase();
  if (GIF_EXT.test(lower)) return { mediaType: "gif" };
  if (IMAGE_EXT.test(lower)) return { mediaType: "image" };
  if (PDF_EXT.test(lower)) return { mediaType: "pdf" };
  if (DOC_EXT.test(lower)) return { mediaType: "link" };

  return { mediaType: "link" };
}

/** Google Drive 공유 URL에서 파일 ID 추출 */
function extractDriveFileId(url: string): string | null {
  const m1 = url.match(/drive\.google\.com\/(?:drive\/[^/]+\/)?file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/drive\.google\.com\/open\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  const m3 = url.match(/drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (m3) return m3[1];
  const m4 = url.match(/drive\.google\.com\/thumbnail\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (m4) return m4[1];
  return null;
}
