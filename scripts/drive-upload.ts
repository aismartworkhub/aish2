/**
 * Google Drive 이미지 업로드 헬퍼 (cron 전용).
 *
 * 운영 셋업 (사용자 1회 작업):
 *   1. 개인 Drive에 'AISH_Thumbnails' 폴더 생성
 *   2. 폴더 우클릭 → 공유 → service account 이메일을 편집자로 추가
 *      (이메일은 FIREBASE_SERVICE_ACCOUNT_KEY JSON의 client_email 필드)
 *   3. 폴더 공유 모드: '링크가 있는 모든 사용자' (보기 전용)
 *   4. 폴더 URL에서 ID 추출 — 예: https://drive.google.com/drive/folders/{ID}
 *   5. GitHub Secret 추가: AISH_DRIVE_FOLDER_ID = {ID}
 *   6. cron 워크플로 env에 AISH_DRIVE_FOLDER_ID 매핑 (별 PR에서 처리)
 *
 * 미설정 시(폴더 ID 없음) — 호출자가 graceful 폴백(data URL 그대로 사용).
 */

import { google } from "googleapis";
import { Readable } from "stream";

let driveClientCache: ReturnType<typeof google.drive> | null = null;

function getDriveClient(serviceAccountJson: string) {
  if (driveClientCache) return driveClientCache;
  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  driveClientCache = google.drive({ version: "v3", auth });
  return driveClientCache;
}

/** data:image/png;base64,XXX → { mimeType, buffer } */
function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return {
    mimeType: m[1],
    buffer: Buffer.from(m[2], "base64"),
  };
}

export type DriveUploadResult =
  | { ok: true; url: string; fileId: string }
  | { ok: false; error: string };

/**
 * data URL 또는 raw Buffer를 Drive 폴더에 업로드 후 공개 URL 반환.
 * 폴더 ID·SA 키 미설정 시 즉시 graceful 실패 — 호출자가 data URL 그대로 사용.
 */
export async function uploadImageToDrive(opts: {
  dataUrl?: string;
  buffer?: Buffer;
  mimeType?: string;
  fileName: string;
  folderId?: string;
  serviceAccountJson?: string;
}): Promise<DriveUploadResult> {
  const folderId = opts.folderId ?? process.env.AISH_DRIVE_FOLDER_ID;
  const saJson = opts.serviceAccountJson ?? process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!folderId) return { ok: false, error: "AISH_DRIVE_FOLDER_ID 미설정" };
  if (!saJson) return { ok: false, error: "FIREBASE_SERVICE_ACCOUNT_KEY 미설정" };

  let buffer: Buffer | undefined = opts.buffer;
  let mimeType = opts.mimeType ?? "image/png";
  if (opts.dataUrl) {
    const parsed = parseDataUrl(opts.dataUrl);
    if (!parsed) return { ok: false, error: "data URL 파싱 실패" };
    buffer = parsed.buffer;
    mimeType = parsed.mimeType;
  }
  if (!buffer) return { ok: false, error: "업로드할 이미지가 없습니다" };

  try {
    const drive = getDriveClient(saJson);
    const res = await drive.files.create({
      requestBody: {
        name: opts.fileName,
        parents: [folderId],
        mimeType,
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id",
    });
    const fileId = res.data.id;
    if (!fileId) return { ok: false, error: "응답에 file id 없음" };

    // 공개 권한 부여 — 폴더가 이미 'anyone' 공유면 상속하지만 명시적으로 보강
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch { /* 폴더 권한 상속이면 충돌 무시 */ }

    // 공개 직접 링크 — Google Drive uc?export=view&id 보다 lh3.googleusercontent가 핫링크 안정
    const url = `https://lh3.googleusercontent.com/d/${fileId}`;
    return { ok: true, url, fileId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "업로드 실패" };
  }
}
