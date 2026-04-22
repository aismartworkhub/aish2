"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, RefreshCw, Save, Play, Settings2,
  History, CheckCircle, XCircle, Eye, Trash2, Clock,
  BarChart3, Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  COLLECTIONS,
  getSingletonDoc,
  setSingletonDoc,
  getCollection,
} from "@/lib/firestore";
import { collectAll } from "@/lib/ai-content-collector";
import type { CollectResult, ContentSource } from "@/lib/ai-content-collector";
import { curateItems } from "@/lib/ai-content-curator";
import type { CuratedItem } from "@/lib/ai-content-curator";
import { getExistingUrls, filterDuplicates, cleanupDuplicates } from "@/lib/ai-content-dedup";
import { createContentIfNew, deleteContent, getContents } from "@/lib/content-engine";
import type { Content } from "@/types/content";

// ── 타입 ──

interface BoardCollectionConfig {
  boardKey: string;
  label: string;
  enabled: boolean;
  maxItems: number;
  minQualityScore: number;
  sources: ContentSource[];
  requireReview: boolean;
}

interface AiCollectorConfig {
  youtubeApiKey: string;
  maxItemsPerRun: number;
  minQualityScore: number;
  boardConfigs: BoardCollectionConfig[];
  defaultRequireReview: boolean;
  lastRunAt?: string;
  lastRunResult?: {
    collected: number;
    unique: number;
    curated: number;
    inserted: number;
    failed: number;
  };
}

interface CollectionRun {
  id: string;
  runAt: string;
  trigger: "cron" | "manual";
  result: { collected: number; unique: number; curated: number; inserted: number; failed: number };
  boardBreakdown: Record<string, number>;
  duration: number;
}

const DEFAULT_BOARD_CONFIGS: BoardCollectionConfig[] = [
  {
    boardKey: "media-lecture",
    label: "강의 영상",
    enabled: true,
    maxItems: 5,
    minQualityScore: 7,
    sources: ["youtube"],
    requireReview: false,
  },
  {
    boardKey: "media-resource",
    label: "추천자료",
    enabled: true,
    maxItems: 5,
    minQualityScore: 7,
    sources: ["github", "reddit"],
    requireReview: false,
  },
];

const DEFAULT_CONFIG: AiCollectorConfig = {
  youtubeApiKey: "",
  maxItemsPerRun: 10,
  minQualityScore: 7,
  boardConfigs: DEFAULT_BOARD_CONFIGS,
  defaultRequireReview: false,
};

const ALL_SOURCES: { value: ContentSource; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "github", label: "GitHub" },
  { value: "reddit", label: "Reddit" },
  { value: "xcom", label: "X.com" },
  { value: "instagram", label: "Instagram" },
];

type TabKey = "dashboard" | "boards" | "history" | "review" | "stats";
const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "대시보드", icon: Sparkles },
  { key: "boards", label: "보드별 설정", icon: Settings2 },
  { key: "history", label: "수집 이력", icon: History },
  { key: "review", label: "검토 대기", icon: Eye },
  { key: "stats", label: "통계", icon: BarChart3 },
];

// ── 유틸 ──

const STAT_CARDS = [
  { key: "collected", label: "수집", color: "text-gray-900" },
  { key: "unique", label: "고유", color: "text-blue-600" },
  { key: "curated", label: "큐레이션", color: "text-purple-600" },
  { key: "inserted", label: "삽입", color: "text-green-600" },
  { key: "failed", label: "실패", color: "text-red-600" },
] as const;

// ── 메인 컴포넌트 ──

export default function AdminAiContentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [config, setConfig] = useState<AiCollectorConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [collectProgress, setCollectProgress] = useState("");

  const [runs, setRuns] = useState<CollectionRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const [pendingItems, setPendingItems] = useState<Content[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const [boardCounts, setBoardCounts] = useState<Record<string, number>>({});

  // ── 설정 로드 ──

  useEffect(() => {
    (async () => {
      try {
        const doc = await getSingletonDoc<AiCollectorConfig>(COLLECTIONS.SETTINGS, "ai-collector");
        if (doc) {
          setConfig({
            ...DEFAULT_CONFIG,
            ...doc,
            boardConfigs: doc.boardConfigs?.length ? doc.boardConfigs : DEFAULT_BOARD_CONFIGS,
          });
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  // ── 보드별 콘텐츠 수 로드 ──

  const loadBoardCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    for (const bc of config.boardConfigs) {
      try {
        const items = await getContents(bc.boardKey);
        const aiItems = items.filter((c) => c.authorUid === "ai-collector");
        counts[bc.boardKey] = aiItems.length;
      } catch { counts[bc.boardKey] = 0; }
    }
    setBoardCounts(counts);
  }, [config.boardConfigs]);

  useEffect(() => {
    if (!loading) loadBoardCounts();
  }, [loading, loadBoardCounts]);

  // ── 이력 로드 ──

  const loadHistory = useCallback(async () => {
    setRunsLoading(true);
    try {
      const data = await getCollection<CollectionRun>(COLLECTIONS.AI_COLLECTOR_HISTORY);
      data.sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime());
      setRuns(data.slice(0, 30));
    } catch { /* empty */ }
    setRunsLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  // ── 검토 대기 로드 ──

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const all: Content[] = [];
      for (const bc of config.boardConfigs) {
        const items = await getContents(bc.boardKey);
        all.push(...items.filter((c) => c.authorUid === "ai-collector" && c.isApproved === false));
      }
      all.sort((a, b) => {
        const ta = typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() : 0;
        const tb = typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      setPendingItems(all);
    } catch { /* empty */ }
    setPendingLoading(false);
  }, [config.boardConfigs]);

  useEffect(() => {
    if (tab === "review") loadPending();
  }, [tab, loadPending]);

  // ── 설정 저장 ──

  const handleSave = async () => {
    setSaving(true);
    try {
      await setSingletonDoc(COLLECTIONS.SETTINGS, "ai-collector", {
        youtubeApiKey: config.youtubeApiKey,
        maxItemsPerRun: config.maxItemsPerRun,
        minQualityScore: config.minQualityScore,
        boardConfigs: config.boardConfigs,
        defaultRequireReview: config.defaultRequireReview,
      });
      toast("설정 저장 완료", "success");
    } catch (e) {
      toast(`저장 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
    }
    setSaving(false);
  };

  // ── 즉시 수집 ──

  const handleCollect = async () => {
    if (!user) return;
    setCollecting(true);
    setCollectProgress("소스에서 수집 중...");
    const startTime = Date.now();

    try {
      const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";
      const result: CollectResult = await collectAll({
        youtubeApiKey: config.youtubeApiKey,
        maxPerSource: Math.ceil(config.maxItemsPerRun / 3),
      });
      setCollectProgress(`${result.items.length}건 수집 완료. 중복 확인 중...`);

      const existingUrls = await getExistingUrls();
      const unique = filterDuplicates(result.items, existingUrls);
      setCollectProgress(`${unique.length}건 고유. Gemini 큐레이션 중...`);

      let curated: CuratedItem[];
      if (geminiKey) {
        curated = await curateItems(unique, geminiKey, config.minQualityScore);
      } else {
        curated = unique.map((item) => ({
          title: item.title,
          body: item.description || item.title,
          boardKey: item.source === "youtube" ? "media-lecture" : "media-resource",
          mediaType: (item.source === "youtube" ? "youtube" : "link") as "youtube" | "link",
          mediaUrl: item.url,
          thumbnailUrl: item.thumbnailUrl,
          tags: ["AI"],
          qualityScore: 5,
          source: item.source,
          publishedAt: item.publishedAt,
        }));
      }

      curated = curated.filter((c) => c.boardKey !== "community-free");
      curated.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());

      const boardBreakdown: Record<string, number> = {};
      const enabledBoards = new Set(config.boardConfigs.filter((b) => b.enabled).map((b) => b.boardKey));
      const toInsert = curated
        .filter((c) => enabledBoards.has(c.boardKey))
        .slice(0, config.maxItemsPerRun);
      setCollectProgress(`${toInsert.length}건 큐레이션 완료. 저장 중...`);

      let inserted = 0;
      let skipped = 0;
      for (const item of toInsert) {
        const bc = config.boardConfigs.find((b) => b.boardKey === item.boardKey);
        const boardMax = bc?.maxItems ?? 5;
        const currentCount = boardBreakdown[item.boardKey] ?? 0;
        if (currentCount >= boardMax) { skipped++; continue; }

        const shouldReview = bc?.requireReview ?? config.defaultRequireReview;
        const docId = await createContentIfNew({
          boardKey: item.boardKey,
          title: item.title,
          body: item.body,
          mediaType: item.mediaType,
          mediaUrl: item.mediaUrl,
          thumbnailUrl: item.thumbnailUrl,
          tags: item.tags,
          authorUid: "ai-collector",
          authorName: "AI 큐레이터",
          isPinned: false,
          isApproved: !shouldReview,
        });
        if (docId) {
          inserted++;
          boardBreakdown[item.boardKey] = (boardBreakdown[item.boardKey] ?? 0) + 1;
        } else {
          skipped++;
        }
      }

      const runResult = {
        collected: result.items.length,
        unique: unique.length,
        curated: curated.length,
        inserted,
        failed: toInsert.length - inserted - skipped,
      };

      await setSingletonDoc(COLLECTIONS.SETTINGS, "ai-collector", {
        ...config,
        lastRunAt: new Date().toISOString(),
        lastRunResult: runResult,
      });

      const { createDoc } = await import("@/lib/firestore");
      await createDoc(COLLECTIONS.AI_COLLECTOR_HISTORY, {
        runAt: new Date().toISOString(),
        trigger: "manual" as const,
        result: runResult,
        boardBreakdown,
        duration: Date.now() - startTime,
      });

      setConfig((prev) => ({ ...prev, lastRunAt: new Date().toISOString(), lastRunResult: runResult }));
      setCollectProgress("");
      toast(`수집 완료: ${inserted}건 삽입, ${skipped}건 스킵`, "success");
      loadBoardCounts();
    } catch (e) {
      toast(`수집 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
      setCollectProgress("");
    }
    setCollecting(false);
  };

  // ── 검토: 승인/반려 ──

  const handleApprove = async (id: string) => {
    try {
      const { updateDocFields } = await import("@/lib/firestore");
      await updateDocFields(COLLECTIONS.CONTENTS, id, { isApproved: true });
      setPendingItems((prev) => prev.filter((p) => p.id !== id));
      toast("승인 완료", "success");
    } catch { toast("승인 실패", "error"); }
  };

  const handleReject = async (id: string) => {
    try {
      await deleteContent(id);
      setPendingItems((prev) => prev.filter((p) => p.id !== id));
      toast("반려(삭제) 완료", "success");
    } catch { toast("반려 실패", "error"); }
  };

  // ── 보드 설정 업데이트 헬퍼 ──

  const updateBoard = (boardKey: string, patch: Partial<BoardCollectionConfig>) => {
    setConfig((prev) => ({
      ...prev,
      boardConfigs: prev.boardConfigs.map((b) =>
        b.boardKey === boardKey ? { ...b, ...patch } : b,
      ),
    }));
  };

  const toggleSource = (boardKey: string, source: ContentSource) => {
    setConfig((prev) => ({
      ...prev,
      boardConfigs: prev.boardConfigs.map((b) => {
        if (b.boardKey !== boardKey) return b;
        const has = b.sources.includes(source);
        return { ...b, sources: has ? b.sources.filter((s) => s !== source) : [...b.sources, source] };
      }),
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw size={24} className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={22} className="text-purple-500" />
            AI 콘텐츠 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">자동 수집 콘텐츠를 보드별로 관리합니다</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white",
            "bg-primary-500 hover:bg-primary-600 disabled:opacity-50",
          )}
        >
          <Save size={16} />
          {saving ? "저장 중..." : "설정 저장"}
        </button>
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  tab === t.key
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700",
                )}
              >
                <Icon size={16} />
                {t.label}
                {t.key === "review" && pendingItems.length > 0 && (
                  <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white font-bold">{pendingItems.length}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 탭 내용 */}
      {tab === "dashboard" && (
        <DashboardTab
          config={config}
          setConfig={setConfig}
          boardCounts={boardCounts}
          collecting={collecting}
          collectProgress={collectProgress}
          onCollect={handleCollect}
          onCleanup={async () => {
            try {
              const result = await cleanupDuplicates();
              const removed = typeof result === "number" ? result : result.removed;
              toast(removed > 0 ? `중복 ${removed}건 정리 완료` : "중복 없음", removed > 0 ? "success" : "info");
            } catch { toast("정리 실패", "error"); }
          }}
        />
      )}
      {tab === "boards" && (
        <BoardsTab
          boardConfigs={config.boardConfigs}
          defaultRequireReview={config.defaultRequireReview}
          onUpdateBoard={updateBoard}
          onToggleSource={toggleSource}
          onToggleDefaultReview={(v) => setConfig((prev) => ({ ...prev, defaultRequireReview: v }))}
        />
      )}
      {tab === "history" && <HistoryTab runs={runs} loading={runsLoading} />}
      {tab === "review" && (
        <ReviewTab items={pendingItems} loading={pendingLoading} onApprove={handleApprove} onReject={handleReject} />
      )}
      {tab === "stats" && <StatsTab runs={runs} runsLoaded={!runsLoading} onLoadRuns={loadHistory} />}
    </div>
  );
}

// ── 대시보드 탭 ──

function DashboardTab({
  config, setConfig, boardCounts, collecting, collectProgress, onCollect, onCleanup,
}: {
  config: AiCollectorConfig;
  setConfig: React.Dispatch<React.SetStateAction<AiCollectorConfig>>;
  boardCounts: Record<string, number>;
  collecting: boolean;
  collectProgress: string;
  onCollect: () => void;
  onCleanup: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* 기본 설정 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4">기본 설정</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">YouTube API Key</label>
            <input
              type="password"
              value={config.youtubeApiKey}
              onChange={(e) => setConfig((p) => ({ ...p, youtubeApiKey: e.target.value }))}
              placeholder="AIza..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">회차당 최대 건수</label>
            <input
              type="number"
              min={1}
              max={50}
              value={config.maxItemsPerRun}
              onChange={(e) => setConfig((p) => ({ ...p, maxItemsPerRun: Number(e.target.value) || 10 }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">최소 품질 점수</label>
            <input
              type="number"
              min={1}
              max={10}
              value={config.minQualityScore}
              onChange={(e) => setConfig((p) => ({ ...p, minQualityScore: Number(e.target.value) || 7 }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <p className="text-xs text-gray-400 mt-1">Gemini 점수 1~10</p>
          </div>
        </div>
      </div>

      {/* 즉시 수집 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-2">즉시 수집</h3>
        <p className="text-sm text-gray-500 mb-4">브라우저에서 YouTube, GitHub 수집이 가능합니다. Reddit/X.com/Instagram은 CORS 제한으로 건너뛸 수 있습니다.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onCollect}
            disabled={collecting}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white",
              "bg-purple-500 hover:bg-purple-600 disabled:opacity-50",
            )}
          >
            {collecting ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
            {collecting ? "수집중..." : "즉시 수집 실행"}
          </button>
          <button
            type="button"
            onClick={onCleanup}
            disabled={collecting}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <Trash2 size={16} />
            중복 정리
          </button>
          {collectProgress && <span className="text-sm text-purple-600 animate-pulse">{collectProgress}</span>}
        </div>
      </div>

      {/* 보드별 현황 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4">보드별 AI 콘텐츠 현황</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {config.boardConfigs.map((bc) => (
            <div key={bc.boardKey} className={cn("p-4 rounded-lg border", bc.enabled ? "border-purple-100 bg-purple-50/50" : "border-gray-100 bg-gray-50 opacity-60")}>
              <p className="text-sm font-medium text-gray-700">{bc.label}</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{boardCounts[bc.boardKey] ?? 0}<span className="text-sm font-normal text-gray-400">건</span></p>
              <p className="text-xs text-gray-400 mt-1">{bc.enabled ? `최대 ${bc.maxItems}건/회` : "비활성"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 최근 수집 결과 */}
      {config.lastRunAt && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">최근 수집 결과</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {STAT_CARDS.map((s) => (
              <div key={s.key} className="text-center p-3 rounded-lg bg-gray-50">
                <p className={cn("text-2xl font-bold", s.color)}>{config.lastRunResult?.[s.key] ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">마지막 실행: {new Date(config.lastRunAt).toLocaleString("ko-KR")}</p>
        </div>
      )}

      {/* 자동 수집 안내 */}
      <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">자동 수집 안내</p>
        <p>매일 자정(KST) GitHub Actions 크론이 자동 실행됩니다. 크론은 GitHub Secrets의 API 키를 사용하며, 이 페이지의 보드별 설정은 다음 크론 실행부터 반영됩니다.</p>
      </div>
    </div>
  );
}

// ── 보드별 설정 탭 ──

function BoardsTab({
  boardConfigs, defaultRequireReview, onUpdateBoard, onToggleSource, onToggleDefaultReview,
}: {
  boardConfigs: BoardCollectionConfig[];
  defaultRequireReview: boolean;
  onUpdateBoard: (boardKey: string, patch: Partial<BoardCollectionConfig>) => void;
  onToggleSource: (boardKey: string, source: ContentSource) => void;
  onToggleDefaultReview: (v: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      {/* 글로벌 옵션 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={defaultRequireReview}
            onChange={(e) => onToggleDefaultReview(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500/20"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">기본 검토 필수</span>
            <p className="text-xs text-gray-500">활성화하면 수집된 콘텐츠가 자동 공개되지 않고 검토 대기열에 들어갑니다</p>
          </div>
        </label>
      </div>

      {/* 보드별 카드 */}
      {boardConfigs.map((bc) => (
        <div key={bc.boardKey} className={cn("bg-white rounded-xl border shadow-sm p-6 transition-opacity", bc.enabled ? "border-gray-100" : "border-gray-100 opacity-60")}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={bc.enabled}
                  onChange={(e) => onUpdateBoard(bc.boardKey, { enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:bg-purple-500 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
              </label>
              <div>
                <h4 className="text-sm font-bold text-gray-900">{bc.label}</h4>
                <p className="text-xs text-gray-400">{bc.boardKey}</p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={bc.requireReview}
                onChange={(e) => onUpdateBoard(bc.boardKey, { requireReview: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-gray-300 text-purple-500 focus:ring-purple-500/20"
              />
              검토 필수
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">최대 수집 건수</label>
              <input
                type="number"
                min={1}
                max={20}
                value={bc.maxItems}
                onChange={(e) => onUpdateBoard(bc.boardKey, { maxItems: Number(e.target.value) || 5 })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">최소 품질 점수</label>
              <input
                type="number"
                min={1}
                max={10}
                value={bc.minQualityScore}
                onChange={(e) => onUpdateBoard(bc.boardKey, { minQualityScore: Number(e.target.value) || 7 })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">수집 소스</label>
              <div className="flex flex-wrap gap-2">
                {ALL_SOURCES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => onToggleSource(bc.boardKey, s.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                      bc.sources.includes(s.value)
                        ? "bg-purple-50 border-purple-200 text-purple-700"
                        : "bg-gray-50 border-gray-200 text-gray-400",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 수집 이력 탭 ──

function HistoryTab({ runs, loading }: { runs: CollectionRun[]; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-12"><RefreshCw size={24} className="animate-spin text-gray-400" /></div>;
  if (runs.length === 0) return <div className="text-center py-12 text-sm text-gray-400">수집 이력이 없습니다</div>;

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <div key={run.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-900">{new Date(run.runAt).toLocaleString("ko-KR")}</span>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                run.trigger === "cron" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600",
              )}>
                {run.trigger === "cron" ? "자동" : "수동"}
              </span>
            </div>
            <span className="text-xs text-gray-400">{(run.duration / 1000).toFixed(1)}초</span>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {STAT_CARDS.map((s) => (
              <div key={s.key} className="text-center">
                <p className={cn("text-lg font-bold", s.color)}>{run.result[s.key] ?? 0}</p>
                <p className="text-[10px] text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
          {run.boardBreakdown && Object.keys(run.boardBreakdown).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-50 flex gap-3">
              {Object.entries(run.boardBreakdown).map(([key, count]) => (
                <span key={key} className="text-xs text-gray-500">{key}: <span className="font-medium text-gray-700">{count}건</span></span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 검토 대기 탭 (미리보기 + 수정 후 승인) ──

function ReviewTab({
  items, loading, onApprove, onReject,
}: {
  items: Content[];
  loading: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const startEdit = (item: Content) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditBody(item.body ?? "");
    setEditTags(item.tags?.join(", ") ?? "");
  };

  const cancelEdit = () => setEditingId(null);

  const saveAndApprove = async (id: string) => {
    setEditSaving(true);
    try {
      const { updateDocFields } = await import("@/lib/firestore");
      await updateDocFields(COLLECTIONS.CONTENTS, id, {
        title: editTitle,
        body: editBody,
        tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
        isApproved: true,
      });
      setEditingId(null);
      onApprove(id);
    } catch {
      toast("저장 실패", "error");
    }
    setEditSaving(false);
  };

  if (loading) return <div className="flex justify-center py-12"><RefreshCw size={24} className="animate-spin text-gray-400" /></div>;
  if (items.length === 0) return <div className="text-center py-12 text-sm text-gray-400">검토 대기 중인 콘텐츠가 없습니다</div>;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="bg-white rounded-xl border border-amber-100 shadow-sm p-5">
          {editingId === item.id ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Edit3 size={14} className="text-purple-500" />
                <span className="text-xs font-medium text-purple-600">수정 후 승인</span>
                <span className="text-xs text-gray-400">{item.boardKey}</span>
              </div>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                placeholder="제목"
              />
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-y"
                placeholder="본문"
              />
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                placeholder="태그 (콤마 구분)"
              />
              {item.mediaUrl && (
                <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                  {item.mediaUrl}
                </a>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">취소</button>
                <button
                  onClick={() => saveAndApprove(item.id)}
                  disabled={editSaving}
                  className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
                >
                  <CheckCircle size={14} />
                  {editSaving ? "저장 중..." : "수정 후 승인"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">검토 대기</span>
                  <span className="text-xs text-gray-400">{item.boardKey}</span>
                </div>
                <h4 className="text-sm font-bold text-gray-900 truncate">{item.title}</h4>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.body}</p>
                {item.mediaUrl && (
                  <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                    {item.mediaUrl.length > 60 ? item.mediaUrl.slice(0, 60) + "..." : item.mediaUrl}
                  </a>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {item.tags.map((t) => <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">#{t}</span>)}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(item)} className="flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100">
                  <Edit3 size={14} />수정
                </button>
                <button onClick={() => onApprove(item.id)} className="flex items-center gap-1 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
                  <CheckCircle size={14} />승인
                </button>
                <button onClick={() => onReject(item.id)} className="flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
                  <XCircle size={14} />반려
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 통계 탭 ──

type StatPeriod = "week" | "month" | "all";

function StatsTab({ runs, runsLoaded, onLoadRuns }: { runs: CollectionRun[]; runsLoaded: boolean; onLoadRuns: () => void }) {
  const [period, setPeriod] = useState<StatPeriod>("month");

  useEffect(() => {
    if (!runsLoaded) onLoadRuns();
  }, [runsLoaded, onLoadRuns]);

  const now = Date.now();
  const periodMs: Record<StatPeriod, number> = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    all: Infinity,
  };

  const filtered = runs.filter((r) => now - new Date(r.runAt).getTime() < periodMs[period]);

  const totals = filtered.reduce(
    (acc, r) => ({
      collected: acc.collected + (r.result.collected ?? 0),
      unique: acc.unique + (r.result.unique ?? 0),
      curated: acc.curated + (r.result.curated ?? 0),
      inserted: acc.inserted + (r.result.inserted ?? 0),
      failed: acc.failed + (r.result.failed ?? 0),
    }),
    { collected: 0, unique: 0, curated: 0, inserted: 0, failed: 0 },
  );

  const boardTotals: Record<string, number> = {};
  for (const r of filtered) {
    if (!r.boardBreakdown) continue;
    for (const [key, count] of Object.entries(r.boardBreakdown)) {
      boardTotals[key] = (boardTotals[key] ?? 0) + count;
    }
  }

  const avgDuration = filtered.length > 0
    ? (filtered.reduce((sum, r) => sum + (r.duration ?? 0), 0) / filtered.length / 1000).toFixed(1)
    : "0";

  const successRate = totals.collected > 0
    ? ((totals.inserted / totals.collected) * 100).toFixed(1)
    : "0";

  if (!runsLoaded) return <div className="flex justify-center py-12"><RefreshCw size={24} className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6">
      {/* 기간 선택 */}
      <div className="flex gap-2">
        {([["week", "최근 1주"], ["month", "최근 1개월"], ["all", "전체"]] as [StatPeriod, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              period === key ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-gray-900">{filtered.length}</p>
          <p className="text-xs text-gray-500 mt-1">총 실행 횟수</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-green-600">{totals.inserted}</p>
          <p className="text-xs text-gray-500 mt-1">삽입된 콘텐츠</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-purple-600">{successRate}%</p>
          <p className="text-xs text-gray-500 mt-1">수집→삽입 비율</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-blue-600">{avgDuration}초</p>
          <p className="text-xs text-gray-500 mt-1">평균 실행 시간</p>
        </div>
      </div>

      {/* 누적 통계 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4">수집 파이프라인 통계</h3>
        <div className="grid grid-cols-5 gap-4">
          {STAT_CARDS.map((s) => (
            <div key={s.key} className="text-center">
              <p className={cn("text-2xl font-bold", s.color)}>{totals[s.key]}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        {totals.collected > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <div className="flex items-center gap-2 h-6">
              {STAT_CARDS.map((s) => {
                const val = totals[s.key];
                const pct = (val / totals.collected) * 100;
                if (pct <= 0) return null;
                return (
                  <div
                    key={s.key}
                    className={cn("h-full rounded-full", {
                      "bg-gray-300": s.key === "collected",
                      "bg-blue-400": s.key === "unique",
                      "bg-purple-400": s.key === "curated",
                      "bg-green-400": s.key === "inserted",
                      "bg-red-400": s.key === "failed",
                    })}
                    style={{ width: `${pct}%`, minWidth: pct > 0 ? 8 : 0 }}
                    title={`${s.label}: ${val} (${pct.toFixed(0)}%)`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 보드별 누적 */}
      {Object.keys(boardTotals).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">보드별 누적 삽입</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(boardTotals)
              .sort(([, a], [, b]) => b - a)
              .map(([key, count]) => (
                <div key={key} className="p-4 rounded-lg border border-purple-100 bg-purple-50/50 text-center">
                  <p className="text-xs text-gray-500 mb-1">{key}</p>
                  <p className="text-2xl font-bold text-purple-600">{count}<span className="text-sm font-normal text-gray-400">건</span></p>
                </div>
              ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">선택한 기간에 수집 이력이 없습니다</div>
      )}
    </div>
  );
}
