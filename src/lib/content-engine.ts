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
  DocumentData,
  limit as firestoreLimit,
} from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS, invalidateCache } from "./firestore";
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

export async function createContent(data: ContentInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.CONTENTS), {
    ...data,
    views: 0,
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidateCache(COLLECTIONS.CONTENTS);
  return ref.id;
}

export async function updateContent(
  id: string,
  data: Partial<ContentInput>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.CONTENTS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  } as DocumentData);
  invalidateCache(COLLECTIONS.CONTENTS);
}

export async function deleteContent(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.CONTENTS, id));
  invalidateCache(COLLECTIONS.CONTENTS);
}

export async function incrementContentViews(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.CONTENTS, id), {
    views: increment(1),
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
  await updateDoc(doc(db, COLLECTIONS.CONTENTS, data.contentId), {
    commentCount: increment(1),
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

// ── URL → 미디어 타입 자동 감지 ──

export function detectMediaType(url: string): {
  mediaType: Content["mediaType"];
  thumbnailUrl?: string;
  embedUrl?: string;
} {
  if (!url) return { mediaType: "none" };

  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      mediaType: "youtube",
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
    };
  }

  const lower = url.toLowerCase();
  if (/\.gif(\?|$)/.test(lower)) return { mediaType: "gif" };
  if (/\.(jpe?g|png|webp|svg|bmp)(\?|$)/.test(lower))
    return { mediaType: "image" };
  if (/\.pdf(\?|$)/.test(lower)) return { mediaType: "pdf" };

  return { mediaType: "link" };
}
