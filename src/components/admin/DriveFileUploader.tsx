"use client";

import { useState, useRef } from "react";
import {
  Upload, X, Link, FileText, Image as ImageIcon, HardDrive, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getDriveAccessToken,
  findOrCreateFolder,
  uploadFileToDrive,
  shareFilePublic,
  driveDownloadUrl,
  driveViewUrl,
  formatFileSize,
} from "@/lib/google-drive";
import type { DriveAttachment } from "@/types/firestore";

interface DriveFileUploaderProps {
  attachments: DriveAttachment[];
  onChange: (attachments: DriveAttachment[]) => void;
  maxFiles?: number;
  maxFileSizeMB?: number;
  allowLinks?: boolean;
}

function getAttachmentIcon(type: string) {
  if (type === "drive") return <HardDrive size={14} className="text-blue-500" />;
  if (type === "image") return <ImageIcon size={14} className="text-purple-500" />;
  if (type === "link") return <ExternalLink size={14} className="text-blue-500" />;
  return <FileText size={14} className="text-gray-500" />;
}

export default function DriveFileUploader({
  attachments,
  onChange,
  maxFiles = 3,
  maxFileSizeMB = 10,
  allowLinks = false,
}: DriveFileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<string | null>(null);

  const maxFileBytes = maxFileSizeMB * 1024 * 1024;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newAtts: DriveAttachment[] = [];

    setUploading(true);
    try {
      // OAuth 토큰 (세션 내 캐싱)
      if (!tokenRef.current) {
        tokenRef.current = await getDriveAccessToken();
      }
      const token = tokenRef.current;
      const folderId = await findOrCreateFolder(token);

      for (const file of files) {
        if (attachments.length + newAtts.length >= maxFiles) break;
        if (file.size > maxFileBytes) continue;

        const driveFile = await uploadFileToDrive(token, file, folderId);
        await shareFilePublic(token, driveFile.id);

        newAtts.push({
          name: driveFile.name,
          url: driveDownloadUrl(driveFile.id),
          size: formatFileSize(driveFile.size || "0"),
          type: "drive",
          driveFileId: driveFile.id,
          driveDownloadUrl: driveDownloadUrl(driveFile.id),
          driveViewUrl: driveViewUrl(driveFile.id),
        });
      }

      if (newAtts.length > 0) {
        onChange([...attachments, ...newAtts]);
      }
    } catch (err) {
      tokenRef.current = null;
      const msg = err instanceof Error ? err.message : "업로드 실패";
      if (msg.includes("popup") || msg.includes("cancelled")) {
        alert("Google 로그인 팝업이 차단되었거나 취소되었습니다.\n팝업 차단을 해제한 후 다시 시도해 주세요.");
      } else if (msg.includes("403") || msg.includes("insufficient")) {
        alert("Google Drive API가 활성화되지 않았습니다.\nGoogle Cloud Console에서 Drive API를 활성화해 주세요.");
      } else {
        alert(`업로드 실패: ${msg}`);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddLink = () => {
    if (!linkUrl.trim() || attachments.length >= maxFiles) return;
    onChange([
      ...attachments,
      { name: linkName.trim() || linkUrl.trim(), url: linkUrl.trim(), size: "-", type: "link" },
    ]);
    setLinkName("");
    setLinkUrl("");
  };

  const handleRemove = (index: number) => {
    const updated = [...attachments];
    updated.splice(index, 1);
    onChange(updated);
  };

  return (
    <div className="space-y-3 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <HardDrive size={16} className="text-gray-500" />
          첨부파일 (Google Drive)
        </h3>
        <span className="text-xs text-gray-400">
          {attachments.length}/{maxFiles} (최대 {maxFileSizeMB}MB/파일)
        </span>
      </div>

      {/* 기존 첨부파일 목록 */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att, idx) => (
            <div key={idx} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                {getAttachmentIcon(att.type)}
                <span className="text-sm text-gray-700 truncate">{att.name}</span>
                {att.size !== "-" && <span className="text-xs text-gray-400 shrink-0">{att.size}</span>}
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase shrink-0",
                  att.type === "drive" ? "bg-blue-50 text-blue-600" :
                  att.type === "image" ? "bg-purple-50 text-purple-600" :
                  att.type === "link" ? "bg-blue-50 text-blue-600" :
                  "bg-gray-100 text-gray-500"
                )}>
                  {att.type}
                </span>
              </div>
              <button onClick={() => handleRemove(idx)}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-2">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 업로드/링크 입력 */}
      {attachments.length < maxFiles && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} accept="*/*" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Upload size={14} />
              {uploading ? "업로드 중..." : "파일 업로드"}
            </button>
          </div>

          {allowLinks && (
            <div className="flex gap-2">
              <input type="text" value={linkName} onChange={(e) => setLinkName(e.target.value)}
                placeholder="링크 이름" className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
              <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..." className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
              <button type="button" onClick={handleAddLink} disabled={!linkUrl.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40">
                <Link size={14} />추가
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
