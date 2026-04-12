"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Trash2, GripVertical, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_BOARDS } from "@/lib/board-defaults";
import { getBoards, upsertBoard, createContent } from "@/lib/content-engine";
import { removeDoc, COLLECTIONS } from "@/lib/firestore";
import { runFullMigration, type MigrationResult } from "@/lib/migration";
import { useAuth } from "@/contexts/AuthContext";
import type { BoardConfig, BoardGroup, BoardLayout, BoardWriteRole, ContentInput } from "@/types/content";

const SAMPLE_CONTENTS: ContentInput[] = [
  {
    boardKey: "media-lecture",
    title: "Python 기초 강의 - 변수와 자료형",
    body: "파이썬 프로그래밍의 기초를 배우는 강의입니다.",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube.com/watch?v=kWiCuklohdY",
    thumbnailUrl: "https://img.youtube.com/vi/kWiCuklohdY/hqdefault.jpg",
    authorUid: "",
    authorName: "AISH",
    tags: ["Python", "기초"],
  },
  {
    boardKey: "media-lecture",
    title: "AI 입문 - 머신러닝 이해하기",
    body: "인공지능과 머신러닝의 기본 개념을 알아봅니다.",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube.com/watch?v=aircAruvnKk",
    thumbnailUrl: "https://img.youtube.com/vi/aircAruvnKk/hqdefault.jpg",
    authorUid: "",
    authorName: "AISH",
    tags: ["AI", "머신러닝"],
  },
  {
    boardKey: "media-workathon",
    title: "제5회 스마트워크톤 하이라이트",
    body: "2025년 스마트워크톤 현장 영상입니다.",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    authorUid: "",
    authorName: "AISH",
    tags: ["워크톤", "2025"],
  },
  {
    boardKey: "media-promo",
    title: "AISH 소개 영상",
    body: "AI Smartwork Hub를 소개합니다.",
    mediaType: "youtube",
    mediaUrl: "https://www.youtube.com/watch?v=JGwWNGJdvx8",
    thumbnailUrl: "https://img.youtube.com/vi/JGwWNGJdvx8/hqdefault.jpg",
    authorUid: "",
    authorName: "AISH",
    tags: ["소개", "AISH"],
  },
  {
    boardKey: "media-resource",
    title: "[샘플] 프레젠테이션 가이드 (PDF)",
    body: "발표자료 작성을 위한 PDF 가이드입니다.",
    mediaType: "pdf",
    mediaUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    thumbnailUrl: "",
    authorUid: "",
    authorName: "AISH",
    tags: ["PDF", "가이드"],
  },
  {
    boardKey: "media-resource",
    title: "[샘플] 데이터 분석 보고서 (PPT/Link)",
    body: "Google Slides로 작성된 데이터 분석 보고서입니다.",
    mediaType: "link",
    mediaUrl: "https://docs.google.com/presentation/d/1BPmqNSk5GPbP1jgB0lYekQPUi3HNqk8PH7BAQF5eXGE/edit",
    thumbnailUrl: "",
    authorUid: "",
    authorName: "AISH",
    tags: ["PPT", "데이터분석"],
  },
  {
    boardKey: "media-resource",
    title: "[샘플] AI 교육 커리큘럼 (DOC/Link)",
    body: "Google Docs로 작성된 교육 커리큘럼입니다.",
    mediaType: "link",
    mediaUrl: "https://docs.google.com/document/d/1BPmqNSk5GPbP1jgB0lYekQPUi3HNqk8PH7BAQF5eXGE/edit",
    thumbnailUrl: "",
    authorUid: "",
    authorName: "AISH",
    tags: ["DOC", "커리큘럼"],
  },
  {
    boardKey: "media-gallery",
    title: "[샘플] AI 교육 현장 사진",
    body: "교육 현장에서 촬영한 사진입니다.",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800",
    thumbnailUrl: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400",
    authorUid: "",
    authorName: "AISH",
    tags: ["교육", "현장"],
  },
  {
    boardKey: "media-gallery",
    title: "[샘플] 팀 협업 워크숍",
    body: "팀 협업 워크숍 사진입니다.",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800",
    thumbnailUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400",
    authorUid: "",
    authorName: "AISH",
    tags: ["워크숍", "협업"],
  },
];

const GROUP_LABELS: Record<BoardGroup, string> = {
  media: "미디어",
  community: "커뮤니티",
};

const LAYOUT_LABELS: Record<BoardLayout, string> = {
  grid: "그리드 (카드)",
  list: "리스트 (행)",
  faq: "FAQ (아코디언)",
};

const WRITE_ROLE_LABELS: Record<BoardWriteRole, string> = {
  admin: "관리자만",
  member: "회원 이상",
};

export default function AdminBoardsPage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [boards, setBoards] = useState<BoardConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<BoardConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationLog, setMigrationLog] = useState<string[]>([]);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    getBoards()
      .then((b) => setBoards(b.length > 0 ? b : DEFAULT_BOARDS))
      .catch(() => setBoards(DEFAULT_BOARDS))
      .finally(() => setLoading(false));
  }, []);

  const handleSeedSamples = async () => {
    if (!user) { toast("로그인이 필요합니다.", "error"); return; }
    if (!confirm("샘플 콘텐츠 9건을 추가합니다. 진행하시겠습니까?")) return;
    setSeeding(true);
    try {
      let created = 0;
      for (const s of SAMPLE_CONTENTS) {
        await createContent({
          ...s,
          authorUid: user.uid,
          authorName: profile?.displayName ?? user.displayName ?? "관리자",
        });
        created++;
      }
      toast(`샘플 데이터 ${created}건 추가 완료`, "success");
    } catch (e) {
      toast(`샘플 추가 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
    } finally {
      setSeeding(false);
    }
  };

  const handleMigration = async () => {
    if (!confirm("기존 데이터를 통합 콘텐츠(contents)로 마이그레이션합니다.\n이미 이전된 항목은 건너뜁니다. 진행하시겠습니까?")) return;
    setMigrating(true);
    setMigrationLog([]);
    setMigrationResult(null);
    try {
      const result = await runFullMigration((msg) => {
        setMigrationLog((prev) => [...prev, msg]);
      });
      setMigrationResult(result);
      toast(`마이그레이션 완료: ${result.created}건 생성, ${result.skipped}건 건너뜀`, "success");
    } catch {
      toast("마이그레이션 실패.", "error");
    } finally {
      setMigrating(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (!confirm("기본 게시판 설정을 Firestore에 저장하시겠습니까? 기존 설정은 유지됩니다.")) return;
    setSaving(true);
    try {
      for (const b of DEFAULT_BOARDS) {
        const existing = boards.find((eb) => eb.key === b.key);
        if (!existing) {
          const { key, ...rest } = b;
          await upsertBoard(key, rest);
        }
      }
      const refreshed = await getBoards();
      setBoards(refreshed.length > 0 ? refreshed : DEFAULT_BOARDS);
      toast("기본 게시판이 저장되었습니다.", "success");
    } catch {
      toast("저장 실패.", "error");
    } finally {
      setSaving(false);
    }
  };

  const startCreate = () => {
    setEditing({
      key: "",
      label: "",
      group: "community",
      layout: "list",
      writeRole: "admin",
      allowComments: true,
      allowLikes: true,
      allowBookmarks: true,
      requireApproval: false,
      icon: "",
      order: boards.length + 1,
      isActive: true,
    });
    setIsCreating(true);
  };

  const startEdit = (b: BoardConfig) => {
    setEditing({ ...b });
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.key.trim() || !editing.label.trim()) {
      toast("키와 라벨을 입력해주세요.", "error");
      return;
    }

    setSaving(true);
    try {
      const { key, ...rest } = editing;
      await upsertBoard(key, rest);
      const refreshed = await getBoards();
      setBoards(refreshed.length > 0 ? refreshed : DEFAULT_BOARDS);
      setEditing(null);
      toast(isCreating ? "게시판이 추가되었습니다." : "게시판 설정이 저장되었습니다.", "success");
    } catch {
      toast("저장 실패.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`'${key}' 게시판을 삭제하시겠습니까? 해당 게시판의 콘텐츠는 삭제되지 않습니다.`)) return;
    try {
      await removeDoc(COLLECTIONS.BOARDS, key);
      setBoards((prev) => prev.filter((b) => b.key !== key));
      toast("삭제되었습니다.", "success");
    } catch {
      toast("삭제 실패.", "error");
    }
  };

  const mediaBoards = boards.filter((b) => b.group === "media");
  const communityBoards = boards.filter((b) => b.group === "community");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">게시판 설정</h1>
          <p className="mt-1 text-sm text-gray-500">미디어·커뮤니티 게시판의 구조를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleMigration}
            disabled={migrating || saving}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-700",
              "hover:bg-orange-100 disabled:opacity-50",
            )}
          >
            <RefreshCw size={14} className={cn(migrating && "animate-spin")} />
            {migrating ? "마이그레이션 중..." : "데이터 마이그레이션"}
          </button>
          <button
            onClick={handleSeedSamples}
            disabled={seeding || saving}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700",
              "hover:bg-blue-100 disabled:opacity-50",
            )}
          >
            {seeding ? "추가 중..." : "샘플 데이터"}
          </button>
          <button
            onClick={handleSeedDefaults}
            disabled={saving}
            className={cn(
              "rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600",
              "hover:bg-gray-50 disabled:opacity-50",
            )}
          >
            기본값 저장
          </button>
          <button
            onClick={startCreate}
            className={cn(
              "flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white",
              "hover:bg-primary-600",
            )}
          >
            <Plus size={16} /> 게시판 추가
          </button>
        </div>
      </div>

      {/* 마이그레이션 결과 */}
      {migrationResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="text-sm font-semibold text-green-800">
            마이그레이션 결과: {migrationResult.created}건 생성 / {migrationResult.skipped}건 건너뜀 / {migrationResult.errors}건 오류
          </h3>
          <div className="mt-2 max-h-40 overflow-y-auto text-xs text-green-700 space-y-0.5">
            {migrationResult.details.map((d, i) => (
              <p key={i}>{d}</p>
            ))}
          </div>
        </div>
      )}
      {migrating && migrationLog.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700">
          {migrationLog.map((m, i) => <p key={i}>{m}</p>)}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">로딩 중...</div>
      ) : (
        <div className="space-y-8">
          {[
            { label: "미디어", boards: mediaBoards },
            { label: "커뮤니티", boards: communityBoards },
          ].map(({ label, boards: groupBoards }) => (
            <section key={label}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">{label}</h2>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                {groupBoards.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">등록된 게시판이 없습니다.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {groupBoards.map((b) => (
                      <div key={b.key} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                        <GripVertical size={16} className="shrink-0 text-gray-300" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{b.label}</span>
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{b.key}</span>
                            {!b.isActive && (
                              <span className="rounded bg-yellow-50 px-1.5 py-0.5 text-[10px] text-yellow-600">비활성</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex gap-3 text-xs text-gray-400">
                            <span>{LAYOUT_LABELS[b.layout]}</span>
                            <span>{WRITE_ROLE_LABELS[b.writeRole]}</span>
                            {b.allowComments && <span>댓글</span>}
                            {b.allowLikes && <span>좋아요</span>}
                            {b.requireApproval && <span>승인필요</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => startEdit(b)}
                          className="rounded px-3 py-1 text-xs text-primary-500 hover:bg-primary-50"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(b.key)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          aria-label="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* 편집 모달 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-20">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {isCreating ? "게시판 추가" : "게시판 설정 수정"}
              </h2>
              <button onClick={() => setEditing(null)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="닫기">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">키 (영문) *</label>
                  <input
                    value={editing.key}
                    onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                    disabled={!isCreating}
                    placeholder="media-custom"
                    className={cn(
                      "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                      !isCreating && "bg-gray-50 text-gray-500",
                    )}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">라벨 (표시명) *</label>
                  <input
                    value={editing.label}
                    onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                    placeholder="새 게시판"
                    className={cn(
                      "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">그룹</label>
                  <select
                    value={editing.group}
                    onChange={(e) => setEditing({ ...editing, group: e.target.value as BoardGroup })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    {Object.entries(GROUP_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">레이아웃</label>
                  <select
                    value={editing.layout}
                    onChange={(e) => setEditing({ ...editing, layout: e.target.value as BoardLayout })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    {Object.entries(LAYOUT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">작성 권한</label>
                  <select
                    value={editing.writeRole}
                    onChange={(e) => setEditing({ ...editing, writeRole: e.target.value as BoardWriteRole })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    {Object.entries(WRITE_ROLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">순서</label>
                <input
                  type="number"
                  value={editing.order}
                  onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })}
                  className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-4">
                {(["allowComments", "allowLikes", "allowBookmarks", "requireApproval", "isActive"] as const).map((field) => (
                  <label key={field} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editing[field] as boolean}
                      onChange={(e) => setEditing({ ...editing, [field]: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      {{ allowComments: "댓글", allowLikes: "좋아요", allowBookmarks: "북마크", requireApproval: "승인 필요", isActive: "활성화" }[field]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2 text-sm font-medium text-white",
                  "hover:bg-primary-600 disabled:opacity-50",
                )}
              >
                <Save size={14} />
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
