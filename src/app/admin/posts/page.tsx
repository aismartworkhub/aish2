"use client";

import { useState } from "react";
import {
  Plus, Search, Edit, Trash2, Pin, Eye, FileText, X, Save, Link, Paperclip, ExternalLink, Image as ImageIcon, File, PlusCircle, HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTIONS, createDoc, upsertDoc, updateDocFields, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import LegacyMigrationBanner from "@/components/admin/LegacyMigrationBanner";
import { HtmlEditor } from "@/components/admin/HtmlEditor";
import { useToast } from "@/components/ui/Toast";
import DriveFileUploader from "@/components/admin/DriveFileUploader";
import type { DriveAttachment } from "@/types/firestore";

type BoardType = "NOTICE" | "RESOURCE" | string;

interface Post {
  id: string;
  title: string;
  boardType: BoardType;
  isPinned: boolean;
  views: number;
  date: string;
  author: string;
  content: string;
  googleLink?: string;
  notionLink?: string;
  slackLink?: string;
  attachments?: DriveAttachment[];
}

const DEFAULT_BOARD_TYPES: Record<string, string> = {
  NOTICE: "공지사항",
  RESOURCE: "자료실",
};

const MAX_ATTACHMENTS = 3;
const MAX_FILE_SIZE_MB = 10;

const emptyPost = (): Omit<Post, "id"> => ({
  title: "",
  boardType: "NOTICE",
  isPinned: false,
  views: 0,
  date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
  author: "관리자",
  content: "",
  googleLink: "",
  notionLink: "",
  slackLink: "",
  attachments: [],
});

function getAttachmentIcon(type: string) {
  switch (type) {
    case "drive": return <HardDrive size={14} className="text-blue-500" />;
    case "image": return <ImageIcon size={14} className="text-purple-500" />;
    case "link": return <Link size={14} className="text-blue-500" />;
    default: return <File size={14} className="text-gray-500" />;
  }
}

export default function AdminPostsPage() {
  const { toast } = useToast();
  const { data: posts, setData: setPosts, loading, error, refresh } = useFirestoreCollection<Post>(COLLECTIONS.POSTS);
  const [boardFilter, setBoardFilter] = useState<"ALL" | string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPost, setEditingPost] = useState<(Omit<Post, "id"> & { id?: string }) | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [customBoardMode, setCustomBoardMode] = useState(false);
  const [customBoardInput, setCustomBoardInput] = useState("");

  // 기존 게시물에서 사용된 커스텀 게시판 타입 수집
  const customBoardTypes = [...new Set(
    posts.map((p) => p.boardType).filter((t) => !(t in DEFAULT_BOARD_TYPES))
  )];
  const allBoardTypes: Record<string, string> = {
    ...DEFAULT_BOARD_TYPES,
    ...Object.fromEntries(customBoardTypes.map((t) => [t, t])),
  };

  const filtered = posts
    .filter((p) => boardFilter === "ALL" || p.boardType === boardFilter)
    .filter((p) => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const startCreate = () => {
    setEditingPost(emptyPost());
    setIsCreating(true);
  };

  const startEdit = (post: Post) => {
    setEditingPost({ ...post, attachments: post.attachments ? [...post.attachments] : [] });
    setIsCreating(false);
  };

  const savePost = async () => {
    if (!editingPost || !editingPost.title.trim()) return;
    setSaving(true);
    try {
      const cleaned = {
        ...editingPost,
        googleLink: editingPost.googleLink?.trim() || "",
        notionLink: editingPost.notionLink?.trim() || "",
        slackLink: editingPost.slackLink?.trim() || "",
        attachments: editingPost.attachments && editingPost.attachments.length > 0 ? editingPost.attachments : [],
      };
      if (isCreating) {
        const id = await createDoc(COLLECTIONS.POSTS, cleaned);
        setPosts((prev) => [{ id, ...cleaned } as Post, ...prev]);
      } else if (editingPost.id) {
        await upsertDoc(COLLECTIONS.POSTS, editingPost.id, cleaned);
        setPosts((prev) => prev.map((p) => p.id === editingPost.id ? { ...cleaned, id: editingPost.id } as Post : p));
      }
      setEditingPost(null);
    } catch (e) {
      console.error(e);
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.POSTS, id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (e) {
      console.error(e);
      toast("삭제에 실패했습니다.", "error");
    }
  };

  const togglePin = async (id: string) => {
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    const newPinned = !post.isPinned;
    try {
      await updateDocFields(COLLECTIONS.POSTS, id, { isPinned: newPinned });
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, isPinned: newPinned } : p));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((p) => p.id));
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`선택된 ${selectedIds.length}개 게시물을 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(selectedIds.map((id) => removeDoc(COLLECTIONS.POSTS, id)));
      setPosts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
      toast("삭제에 실패했습니다.", "error");
    }
  };



  // 첨부파일은 DriveFileUploader 컴포넌트에서 처리

  const hasResourceLinks = (post: Post) => post.googleLink || post.notionLink || post.slackLink;

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div>
      <LegacyMigrationBanner legacyName="게시판 관리" />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">게시판 관리</h1>
          <p className="text-gray-500 mt-1">공지사항과 자료실 게시물을 관리합니다.</p>
        </div>
        <button onClick={startCreate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
          <Plus size={18} />새 게시물 작성
        </button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-wrap gap-2">
          {[{ key: "ALL", label: "전체" }, ...Object.entries(allBoardTypes).map(([key, label]) => ({ key, label }))].map((tab) => (
            <button key={tab.key} onClick={() => setBoardFilter(tab.key)}
              className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                boardFilter === tab.key ? "bg-primary-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50")}>
              {tab.label}
            </button>
          ))}
          {selectedIds.length > 0 && (
            <button onClick={bulkDelete} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
              <Trash2 size={14} className="inline mr-1" />{selectedIds.length}개 삭제
            </button>
          )}
        </div>
        <div className="relative">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제목 검색..." className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-64" />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left">
                <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">구분</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">제목</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">첨부</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">작성자</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">작성일</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">조회</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-gray-400"><FileText size={32} className="mx-auto mb-2" /><p className="text-sm">게시물이 없습니다.</p></td></tr>
            ) : filtered.map((post) => (
              <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(post.id)} onChange={() => toggleSelect(post.id)} className="rounded border-gray-300" /></td>
                <td className="px-4 py-3">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                    post.boardType === "NOTICE" ? "bg-blue-100 text-blue-700"
                    : post.boardType === "RESOURCE" ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700")}>
                    {allBoardTypes[post.boardType] || post.boardType}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {post.isPinned && <Pin size={12} className="text-primary-500" />}
                    <span className="text-sm font-medium text-gray-900">{post.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {post.googleLink && <span title="Google Drive" className="inline-flex items-center justify-center w-6 h-6 rounded bg-red-50 text-red-500"><ExternalLink size={12} /></span>}
                    {post.notionLink && <span title="Notion" className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 text-gray-600"><FileText size={12} /></span>}
                    {post.slackLink && <span title="Slack" className="inline-flex items-center justify-center w-6 h-6 rounded bg-purple-50 text-purple-500"><Link size={12} /></span>}
                    {post.attachments && post.attachments.length > 0 && (
                      <span title={`첨부 ${post.attachments.length}개`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-xs font-medium">
                        <Paperclip size={12} />{post.attachments.length}
                      </span>
                    )}
                    {!hasResourceLinks(post) && (!post.attachments || post.attachments.length === 0) && <span className="text-xs text-gray-300">-</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{post.author}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{post.date}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-1 text-sm text-gray-500"><Eye size={14} />{post.views}</div></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => togglePin(post.id)} className={cn("p-1.5 rounded-lg transition-colors", post.isPinned ? "bg-primary-50 text-primary-600" : "text-gray-400 hover:text-primary-600 hover:bg-primary-50")}>
                      <Pin size={14} />
                    </button>
                    <button onClick={() => startEdit(post)} className="p-1.5 rounded-lg hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors"><Edit size={14} /></button>
                    <button onClick={() => deletePost(post.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{isCreating ? "새 게시물 작성" : "게시물 수정"}</h2>
              <button onClick={() => setEditingPost(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">제목</label>
                <input type="text" value={editingPost.title} onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">구분</label>
                  {customBoardMode ? (
                    <div className="flex gap-2">
                      <input type="text" value={customBoardInput} onChange={(e) => setCustomBoardInput(e.target.value)}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        placeholder="새 게시판 이름 (예: 활동보고)" autoFocus />
                      <button type="button" onClick={() => {
                        if (customBoardInput.trim()) {
                          setEditingPost({ ...editingPost, boardType: customBoardInput.trim() });
                          setCustomBoardMode(false);
                        }
                      }} className="px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">확인</button>
                      <button type="button" onClick={() => { setCustomBoardMode(false); setCustomBoardInput(""); }}
                        className="px-2 py-2 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select value={editingPost.boardType} onChange={(e) => setEditingPost({ ...editingPost, boardType: e.target.value as BoardType })}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none">
                        {Object.entries(allBoardTypes).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setCustomBoardMode(true)}
                        className="px-2 py-2 text-gray-400 hover:text-primary-600 transition-colors" title="새 게시판 추가">
                        <PlusCircle size={18} />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">작성자</label>
                  <input type="text" value={editingPost.author} onChange={(e) => setEditingPost({ ...editingPost, author: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <HtmlEditor
                  label="내용"
                  value={editingPost.content}
                  onChange={(v) => setEditingPost({ ...editingPost, content: v })}
                  rows={6}
                  placeholder="게시글 내용을 입력하세요 (HTML 사용 가능)"
                />
              </div>
              {editingPost.boardType === "RESOURCE" && (
                <div className="space-y-3 p-4 bg-green-50/50 rounded-xl border border-green-100">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><ExternalLink size={16} className="text-green-600" />자료실 외부 링크</h3>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Google Drive 링크</label>
                    <input type="url" value={editingPost.googleLink ?? ""} onChange={(e) => setEditingPost({ ...editingPost, googleLink: e.target.value })}
                      placeholder="https://drive.google.com/..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Notion 링크</label>
                    <input type="url" value={editingPost.notionLink ?? ""} onChange={(e) => setEditingPost({ ...editingPost, notionLink: e.target.value })}
                      placeholder="https://notion.so/..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Slack 링크</label>
                    <input type="url" value={editingPost.slackLink ?? ""} onChange={(e) => setEditingPost({ ...editingPost, slackLink: e.target.value })}
                      placeholder="https://slack.com/..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
                  </div>
                </div>
              )}
              <DriveFileUploader
                attachments={editingPost.attachments ?? []}
                onChange={(atts) => setEditingPost({ ...editingPost, attachments: atts })}
                maxFiles={MAX_ATTACHMENTS}
                maxFileSizeMB={MAX_FILE_SIZE_MB}
                allowLinks
              />
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editingPost.isPinned} onChange={(e) => setEditingPost({ ...editingPost, isPinned: e.target.checked })} className="rounded border-gray-300" />
                <label className="text-sm text-gray-700">상단 고정</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setEditingPost(null)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={savePost} disabled={!editingPost.title.trim() || saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50">
                <Save size={16} />{saving ? "저장중..." : isCreating ? "등록" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
