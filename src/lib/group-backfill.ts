/**
 * `contents` 컬렉션의 `group` 필드 백필 도구.
 *
 * 배경:
 *   /media 등 공개 페이지의 "전체" 탭은 `where("group", "==", "media")`로 조회한다.
 *   레거시 마이그레이션 당시 `BOARD_MAP`(정적 DEFAULT_BOARDS)에 없는 boardKey가
 *   섞여 있었으면 group 필드가 부착되지 않아 "전체"에서 누락된다.
 *
 *   본 모듈은 contents 컬렉션 전체를 스캔하여:
 *   - 각 doc의 boardKey로 board lookup (Firestore boards + DEFAULT_BOARDS 폴백)
 *   - group이 누락 / board.group과 다르면 update
 *
 * idempotent — 다시 실행해도 안전.
 */

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { COLLECTIONS, invalidateCache } from "./firestore";
import { getBoards } from "./content-engine";
import { DEFAULT_BOARDS } from "./board-defaults";
import type { BoardConfig } from "@/types/content";

export interface BackfillDiagnosis {
  total: number;
  /** group 필드가 정확한 doc */
  ok: number;
  /** group 필드가 누락된 doc */
  missing: number;
  /** group 값이 boardKey의 board.group과 다른 doc */
  mismatched: number;
  /** boardKey가 없거나 boards에서 찾을 수 없어 group을 추론 불가 */
  unknownBoard: number;
  /** 보드별 카운트 (group 누락 + 불일치 합산) — 어떤 보드에 문제가 몰려있는지 진단용 */
  problemsByBoardKey: Record<string, number>;
}

export interface BackfillRunResult {
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
  details: string[];
}

type ContentRow = {
  id: string;
  boardKey?: string;
  group?: string;
};

async function loadBoardMap(): Promise<Map<string, BoardConfig>> {
  const map = new Map<string, BoardConfig>();
  for (const b of DEFAULT_BOARDS) map.set(b.key, b);
  try {
    const list = await getBoards();
    for (const b of list) map.set(b.key, b);
  } catch {
    /* Firestore boards 조회 실패 시 DEFAULT_BOARDS만 사용 */
  }
  return map;
}

async function loadContentRows(): Promise<ContentRow[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.CONTENTS));
  return snap.docs.map((d) => {
    const data = d.data() as { boardKey?: string; group?: string };
    return { id: d.id, boardKey: data.boardKey, group: data.group };
  });
}

/**
 * 백필 없이 진단만 수행. (현재 상태 카운트)
 */
export async function diagnoseGroupBackfill(): Promise<BackfillDiagnosis> {
  const [boardMap, rows] = await Promise.all([loadBoardMap(), loadContentRows()]);

  const result: BackfillDiagnosis = {
    total: rows.length,
    ok: 0,
    missing: 0,
    mismatched: 0,
    unknownBoard: 0,
    problemsByBoardKey: {},
  };

  for (const row of rows) {
    if (!row.boardKey) {
      result.unknownBoard++;
      continue;
    }
    const board = boardMap.get(row.boardKey);
    if (!board) {
      result.unknownBoard++;
      continue;
    }
    const expected = board.group;
    if (!expected) {
      // 보드에 group이 정의 안 되어 있으면 어떻게 할지 모호 — skip 카운트 무시
      result.ok++;
      continue;
    }
    if (!row.group) {
      result.missing++;
      result.problemsByBoardKey[row.boardKey] =
        (result.problemsByBoardKey[row.boardKey] ?? 0) + 1;
    } else if (row.group !== expected) {
      result.mismatched++;
      result.problemsByBoardKey[row.boardKey] =
        (result.problemsByBoardKey[row.boardKey] ?? 0) + 1;
    } else {
      result.ok++;
    }
  }

  return result;
}

/**
 * 진단 + 백필. 실제로 Firestore에 update를 발생시킨다.
 * @param onProgress 진행 로그 콜백 (옵션)
 */
export async function runGroupBackfill(
  onProgress?: (msg: string) => void,
): Promise<BackfillRunResult> {
  const result: BackfillRunResult = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  onProgress?.("보드 정의 로드 중...");
  const boardMap = await loadBoardMap();

  onProgress?.("contents 컬렉션 스캔 중...");
  const rows = await loadContentRows();
  result.scanned = rows.length;
  onProgress?.(`총 ${rows.length}건 스캔 완료. 백필 시작.`);

  for (const row of rows) {
    if (!row.boardKey) {
      result.skipped++;
      continue;
    }
    const board = boardMap.get(row.boardKey);
    if (!board || !board.group) {
      result.skipped++;
      continue;
    }
    if (row.group === board.group) {
      result.skipped++;
      continue;
    }
    try {
      await updateDoc(doc(db, COLLECTIONS.CONTENTS, row.id), {
        group: board.group,
        updatedAt: serverTimestamp(),
      });
      result.updated++;
    } catch (e) {
      result.errors++;
      result.details.push(
        `${row.id} (${row.boardKey}): ${e instanceof Error ? e.message : "오류"}`,
      );
    }
  }

  if (result.updated > 0) invalidateCache(COLLECTIONS.CONTENTS);

  onProgress?.(
    `완료 — 업데이트 ${result.updated}건 / 스킵 ${result.skipped}건 / 오류 ${result.errors}건`,
  );
  return result;
}
