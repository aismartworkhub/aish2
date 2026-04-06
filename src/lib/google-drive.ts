import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";

/* ── Google Drive OAuth 토큰 취득 ── */

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * Google Drive 업로드용 OAuth 액세스 토큰을 취득한다.
 * 이미 로그인된 사용자에게 drive.file 스코프를 추가로 요청한다.
 */
export async function getDriveAccessToken(): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error("Google Drive 액세스 토큰을 가져올 수 없습니다.");
  }
  return credential.accessToken;
}

/* ── Google Drive API 호출 ── */

const DRIVE_API = "https://www.googleapis.com/";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
}

/**
 * AISH 공용 폴더를 찾거나 생성한다.
 */
export async function findOrCreateFolder(
  accessToken: string,
  folderName = "AISH 자료실"
): Promise<string> {
  // 기존 폴더 검색 — q 파라미터는 URLSearchParams로 안전하게 인코딩
  const searchUrl = new URL(`${DRIVE_API}drive/v3/files`);
  searchUrl.searchParams.set("q", `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  searchUrl.searchParams.set("fields", "files(id,name)");

  const searchRes = await fetch(searchUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files?.length > 0) return data.files[0].id;
  }

  // 폴더 생성
  const createRes = await fetch(`${DRIVE_API}drive/v3/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`폴더 생성 실패: ${err}`);
  }
  const folder = await createRes.json();
  return folder.id;
}

/**
 * 파일을 Google Drive에 업로드한다 (multipart upload).
 */
export async function uploadFileToDrive(
  accessToken: string,
  file: File,
  folderId: string
): Promise<DriveFile> {
  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", file);

  const res = await fetch(
    `${DRIVE_API}upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`업로드 실패: ${err}`);
  }

  return res.json();
}

/**
 * 파일을 "링크가 있는 모든 사용자 — 뷰어"로 공유 설정한다.
 */
export async function shareFilePublic(
  accessToken: string,
  fileId: string
): Promise<void> {
  const res = await fetch(
    `${DRIVE_API}drive/v3/files/${fileId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`공유 설정 실패: ${err}`);
  }
}

/* ── URL 헬퍼 ── */

export function driveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function formatFileSize(bytes: number | string): string {
  const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (isNaN(b) || b === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
