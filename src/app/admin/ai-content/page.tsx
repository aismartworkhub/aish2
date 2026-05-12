"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, RefreshCw, Save, Play, Settings2,
  History, CheckCircle, XCircle, Eye, Trash2, Clock,
  BarChart3, Edit3, Search, Loader2, KeyRound,
} from "lucide-react";
import { verifyYoutubeApiKey } from "@/lib/youtube-search";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  COLLECTIONS,
  getSingletonDoc,
  setSingletonDoc,
  upsertDoc,
  getCollection,
} from "@/lib/firestore";
import { collectByCategory } from "@/lib/ai-content-collector";
import type { CollectResult, ContentSource } from "@/lib/ai-content-collector";
import { curateItems } from "@/lib/ai-content-curator";
import type { CuratedItem } from "@/lib/ai-content-curator";
import { ALL_CATEGORIES, CATEGORY_BOARD_HINTS, CATEGORY_LABELS, categoryOfBoard } from "@/lib/ai-content-categories";
import type { AiCategory } from "@/lib/ai-content-categories";
import { getExistingUrls, filterDuplicates, cleanupDuplicates } from "@/lib/ai-content-dedup";
import { createContentIfNew, deleteContent, getContents } from "@/lib/content-engine";
import { extractOgImageWithAI } from "@/lib/og-image-ai";
import type { Content } from "@/types/content";
import YoutubeAdvancedSearch from "@/components/admin/YoutubeAdvancedSearch";
import YoutubeSearchHistoryChips from "@/components/admin/YoutubeSearchHistoryChips";
import YoutubeSearchSnapshotsList from "@/components/admin/YoutubeSearchSnapshotsList";
import type { SearchOptsSnapshot } from "@/lib/youtube-search-history";

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

/** 카테고리별 운영 설정 — Phase 3.5 */
interface CategorySettings {
  enabled: boolean;
  /** true면 isApproved=true로 즉시 공개 (defaultRequireReview 우선 적용) */
  autoPublish: boolean;
  maxPerRun: number;
  lastRunAt?: string;
}

interface AiCollectorConfig {
  youtubeApiKey: string;
  maxItemsPerRun: number;
  minQualityScore: number;
  boardConfigs: BoardCollectionConfig[];
  defaultRequireReview: boolean;
  /** 카테고리별 ON/OFF·자동공개·1회 최대 건수. Map 형태(객체)로 보관. */
  categorySettings?: Partial<Record<AiCategory, CategorySettings>>;
  lastRunAt?: string;
  lastRunResult?: {
    collected: number;
    unique: number;
    curated: number;
    inserted: number;
    failed: number;
  };
}

const DEFAULT_CATEGORY_SETTINGS: Record<AiCategory, CategorySettings> = {
  video: { enabled: true, autoPublish: false, maxPerRun: 5 },
  article: { enabled: true, autoPublish: false, maxPerRun: 5 },
  resource: { enabled: true, autoPublish: false, maxPerRun: 5 },
};

function resolveCategorySettings(config: AiCollectorConfig, cat: AiCategory): CategorySettings {
  return config.categorySettings?.[cat] ?? DEFAULT_CATEGORY_SETTINGS[cat];
}

interface CollectionRun {
  id: string;
  runAt: string;
  trigger: "cron" | "manual";
  /** Phase 1+에서 추가됨. 옛 데이터는 undefined → "기타"로 분류 */
  category?: AiCategory;
  result: { collected: number; unique: number; curated: number; inserted: number; failed: number };
  boardBreakdown: Record<string, number>;
  duration: number;
}

/** 마스킹 — UI에 노출되는 placeholder (실제 키는 Firestore에만 존재) */
const MASKED_API_KEY = "••••••••";

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
  // 안전 우선: 기본값 true → AI 수집 콘텐츠가 검토 후 공개. 운영자는 admin UI에서 끌 수 있음.
  defaultRequireReview: true,
};

const ALL_SOURCES: { value: ContentSource; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "github", label: "GitHub" },
  { value: "reddit", label: "Reddit" },
  { value: "xcom", label: "X.com" },
  { value: "instagram", label: "Instagram" },
];

type TabKey = "dashboard" | "boards" | "history" | "review" | "stats" | "search";
const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "대시보드", icon: Sparkles },
  { key: "boards", label: "보드별 설정", icon: Settings2 },
  { key: "history", label: "수집 이력", icon: History },
  { key: "review", label: "검토 대기", icon: Eye },
  { key: "stats", label: "통계", icon: BarChart3 },
  { key: "search", label: "고급 검색", icon: Search },
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
  const [pendingSearchApply, setPendingSearchApply] = useState<SearchOptsSnapshot | null>(null);
  const [config, setConfig] = useState<AiCollectorConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingKey, setVerifyingKey] = useState(false);
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
            // 보안 — 화면에선 마스킹 표시, 저장 시 마스킹 그대로면 기존 값 유지 (handleSave 분기)
            youtubeApiKey: doc.youtubeApiKey ? MASKED_API_KEY : "",
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

  /**
   * 마스킹 보호 — youtubeApiKey가 마스킹 placeholder이면 필드 자체를 제외하여
   * upsertDoc(merge) 시 Firestore의 기존 키 값이 보존됨.
   */
  const stripMaskedApiKey = <T extends { youtubeApiKey?: string }>(data: T): T => {
    if (data.youtubeApiKey === MASKED_API_KEY) {
      const { youtubeApiKey: _omit, ...rest } = data;
      void _omit;
      return rest as T;
    }
    return data;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = stripMaskedApiKey({
        youtubeApiKey: config.youtubeApiKey,
        maxItemsPerRun: config.maxItemsPerRun,
        minQualityScore: config.minQualityScore,
        boardConfigs: config.boardConfigs,
        defaultRequireReview: config.defaultRequireReview,
      });
      await upsertDoc(COLLECTIONS.SETTINGS, "ai-collector", payload);
      toast("설정 저장 완료", "success");
    } catch (e) {
      toast(`저장 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
    }
    setSaving(false);
  };

  // ── 즉시 수집 ──

  /**
   * 단일 카테고리 수집·큐레이션·저장 1 cycle.
   * 카테고리에 매핑된 소스만 fetch하고, 그 카테고리의 boardHints만 Gemini에 전달 →
   * 보드 분류 정확도 ↑. 결과는 카테고리별 history run 1건으로 저장됨.
   */
  const runCategory = async (category: AiCategory): Promise<{ inserted: number; skipped: number; disabled?: boolean }> => {
    const cs = resolveCategorySettings(config, category);
    if (!cs.enabled) {
      return { inserted: 0, skipped: 0, disabled: true };
    }

    const startTime = Date.now();
    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";
    const hints = CATEGORY_BOARD_HINTS[category];
    const categoryBoardKeys = new Set(hints.map((h) => h.boardKey));

    setCollectProgress(`[${CATEGORY_LABELS[category]}] 소스에서 수집 중...`);
    const result: CollectResult = await collectByCategory(category, {
      youtubeApiKey: config.youtubeApiKey,
      maxPerSource: cs.maxPerRun,
    });

    setCollectProgress(`[${CATEGORY_LABELS[category]}] ${result.items.length}건. 중복 확인 중...`);
    const existingUrls = await getExistingUrls();
    const unique = filterDuplicates(result.items, existingUrls);

    setCollectProgress(`[${CATEGORY_LABELS[category]}] ${unique.length}건 고유. Gemini 큐레이션 중...`);
    let curated: CuratedItem[];
    if (geminiKey && unique.length > 0) {
      curated = await curateItems(unique, geminiKey, config.minQualityScore, hints);
    } else {
      curated = unique.map((item) => ({
        title: item.title,
        body: item.description || item.title,
        boardKey: hints[0]?.boardKey ?? "media-resource",
        mediaType: (item.source === "youtube" ? "youtube" : "link") as "youtube" | "link",
        mediaUrl: item.url,
        thumbnailUrl: item.thumbnailUrl,
        tags: ["AI"],
        qualityScore: 5,
        source: item.source,
        publishedAt: item.publishedAt,
      }));
    }

    // 안전망 — 큐레이터가 hints 외 보드를 반환했을 경우 카테고리 보드만 통과
    curated = curated.filter((c) => categoryBoardKeys.has(c.boardKey));
    curated.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());

    const boardBreakdown: Record<string, number> = {};
    const enabledBoards = new Set(config.boardConfigs.filter((b) => b.enabled).map((b) => b.boardKey));
    const toInsert = curated
      .filter((c) => enabledBoards.has(c.boardKey))
      .slice(0, cs.maxPerRun);

    setCollectProgress(`[${CATEGORY_LABELS[category]}] ${toInsert.length}건 저장 중...`);
    let inserted = 0;
    let skipped = 0;
    for (const item of toInsert) {
      const bc = config.boardConfigs.find((b) => b.boardKey === item.boardKey);
      const boardMax = bc?.maxItems ?? 5;
      const currentCount = boardBreakdown[item.boardKey] ?? 0;
      if (currentCount >= boardMax) { skipped++; continue; }

      // 카테고리 autoPublish가 true면 검토 우회. 그 외는 보드 requireReview > 글로벌 default 순.
      const shouldReview = cs.autoPublish ? false : (bc?.requireReview ?? config.defaultRequireReview);
      // 썸네일 fallback 체인 — Phase 4-A
      // 1) 원본 thumbnailUrl 우선
      // 2) 외부 링크면 og:image (Gemini URL Context)
      // 3) 그래도 없으면 AI 이미지 생성 (Gemini 2.5 Flash Image, base64 data URL)
      let thumbnailUrl = item.thumbnailUrl;
      if (!thumbnailUrl && item.mediaUrl && /^https?:\/\//.test(item.mediaUrl)) {
        try {
          const og = await extractOgImageWithAI(item.mediaUrl);
          if (og.ok) thumbnailUrl = og.ogImage;
        } catch { /* graceful */ }
      }
      if (!thumbnailUrl && geminiKey) {
        try {
          const { generateThumbnailImage } = await import("@/lib/gemini-image");
          const gen = await generateThumbnailImage({
            apiKey: geminiKey,
            title: item.titleKo || item.title,
            body: item.bodyKo || item.body,
            tags: item.tags,
            category: CATEGORY_LABELS[category],
          });
          if (gen.ok) thumbnailUrl = gen.dataUrl;
        } catch { /* graceful — 카테고리 fallback이 채워줌 */ }
      }
      const docId = await createContentIfNew({
        boardKey: item.boardKey,
        title: item.title,
        titleKo: item.titleKo,
        body: item.body,
        bodyKo: item.bodyKo,
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl,
        thumbnailUrl,
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

    const { createDoc } = await import("@/lib/firestore");
    await createDoc(COLLECTIONS.AI_COLLECTOR_HISTORY, {
      runAt: new Date().toISOString(),
      trigger: "manual" as const,
      category, // Phase 2 통계·검토 필터링 기반
      result: runResult,
      boardBreakdown,
      duration: Date.now() - startTime,
    });

    return { inserted, skipped };
  };

  /**
   * "전체 수집" — 3 카테고리 순차 실행. Phase 2 UI에서 카테고리 단독 실행 버튼은
   * runCategory 직접 호출, 이 handler는 호환을 위해 단일 진입점으로 유지.
   */
  const handleCollect = async () => {
    if (!user) return;
    setCollecting(true);
    setCollectProgress("소스에서 수집 중...");

    try {
      let totalInserted = 0;
      let totalSkipped = 0;
      for (const cat of ALL_CATEGORIES) {
        try {
          const { inserted, skipped } = await runCategory(cat);
          totalInserted += inserted;
          totalSkipped += skipped;
        } catch (e) {
          toast(`[${CATEGORY_LABELS[cat]}] 수집 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
        }
      }

      // 마지막 실행 메타 — 합산 결과 기록 (개별 카테고리 ron은 history에 별도 저장됨)
      const aggregateResult = {
        collected: 0, unique: 0, curated: 0,
        inserted: totalInserted,
        failed: 0,
      };
      // upsertDoc(merge) + 마스킹 보호 → 기존 youtubeApiKey 보존
      await upsertDoc(COLLECTIONS.SETTINGS, "ai-collector", stripMaskedApiKey({
        ...config,
        lastRunAt: new Date().toISOString(),
        lastRunResult: aggregateResult,
      }));
      setConfig((prev) => ({ ...prev, lastRunAt: new Date().toISOString(), lastRunResult: aggregateResult }));
      setCollectProgress("");
      toast(`수집 완료: ${totalInserted}건 삽입, ${totalSkipped}건 스킵`, "success");
      loadBoardCounts();
    } catch (e) {
      toast(`수집 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
      setCollectProgress("");
    }
    setCollecting(false);
  };

  /** 단일 카테고리 수집 (대시보드 카드의 "지금 수집" 버튼) */
  const handleCollectCategory = async (cat: AiCategory) => {
    if (!user) return;
    const cs = resolveCategorySettings(config, cat);
    if (!cs.enabled) {
      toast(`[${CATEGORY_LABELS[cat]}] 카테고리 비활성 상태 — 카드의 토글로 켜고 다시 시도하세요.`, "info");
      return;
    }
    setCollecting(true);
    setCollectProgress("");
    try {
      const { inserted, skipped, disabled } = await runCategory(cat);
      if (disabled) {
        toast(`[${CATEGORY_LABELS[cat]}] 비활성`, "info");
        setCollecting(false);
        return;
      }
      const nowIso = new Date().toISOString();
      const newCategorySettings = {
        ...(config.categorySettings ?? {}),
        [cat]: { ...cs, lastRunAt: nowIso },
      };
      const aggregateResult = { collected: 0, unique: 0, curated: 0, inserted, failed: 0 };
      const next: AiCollectorConfig = {
        ...config,
        lastRunAt: nowIso,
        lastRunResult: aggregateResult,
        categorySettings: newCategorySettings,
      };
      await upsertDoc(COLLECTIONS.SETTINGS, "ai-collector", stripMaskedApiKey(next));
      setConfig(next);
      setCollectProgress("");
      toast(`[${CATEGORY_LABELS[cat]}] ${inserted}건 삽입, ${skipped}건 스킵`, "success");
      loadBoardCounts();
    } catch (e) {
      toast(`[${CATEGORY_LABELS[cat]}] 수집 실패: ${e instanceof Error ? e.message : "오류"}`, "error");
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
          onCollectCategory={handleCollectCategory}
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
      {tab === "history" && (
        <HistoryTab
          runs={runs}
          loading={runsLoading}
          onApplySearchHistory={(opts) => {
            setPendingSearchApply(opts);
            setTab("search");
          }}
        />
      )}
      {tab === "review" && (
        <ReviewTab items={pendingItems} loading={pendingLoading} onApprove={handleApprove} onReject={handleReject} />
      )}
      {tab === "stats" && <StatsTab runs={runs} runsLoaded={!runsLoading} onLoadRuns={loadHistory} />}
      {tab === "search" && (
        <YoutubeAdvancedSearch
          youtubeApiKey={config.youtubeApiKey}
          initialApply={pendingSearchApply}
        />
      )}
    </div>
  );
}

// ── 카테고리별 수집 카드 ──

const CATEGORY_ICONS: Record<AiCategory, string> = {
  video: "▶",
  article: "📰",
  resource: "📚",
};

function CategoryCollectCard({
  category, collecting, onCollect, settings, onUpdateSettings,
}: {
  category: AiCategory;
  collecting: boolean;
  onCollect: () => void;
  settings: CategorySettings;
  onUpdateSettings: (patch: Partial<CategorySettings>) => void;
}) {
  const icon = CATEGORY_ICONS[category];
  const label = CATEGORY_LABELS[category];
  const lastRun = settings.lastRunAt
    ? new Date(settings.lastRunAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
    : "—";
  return (
    <div className={cn(
      "rounded-lg border p-4 transition bg-white",
      settings.enabled ? "border-gray-200 hover:border-purple-300" : "border-gray-200 bg-gray-50 opacity-75",
    )}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>{icon}</span>
          <span className="text-sm font-bold text-gray-900">{label}</span>
        </div>
        <label className="inline-flex items-center gap-1 cursor-pointer text-xs text-gray-500">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => onUpdateSettings({ enabled: e.target.checked })}
            className="rounded border-gray-300"
          />
          활성
        </label>
      </div>
      <p className="text-[10px] text-gray-400 mb-2">마지막 실행: {lastRun}</p>
      <button
        type="button"
        onClick={onCollect}
        disabled={collecting || !settings.enabled}
        className={cn(
          "w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition mb-2",
          "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {collecting ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
        {collecting ? "수집 중..." : "지금 수집"}
      </button>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <label className="flex items-center gap-1 text-gray-600">
          <input
            type="checkbox"
            checked={settings.autoPublish}
            onChange={(e) => onUpdateSettings({ autoPublish: e.target.checked })}
            className="rounded border-gray-300"
          />
          자동공개
        </label>
        <label className="flex items-center gap-1 text-gray-600">
          1회
          <input
            type="number"
            min={1}
            max={20}
            value={settings.maxPerRun}
            onChange={(e) => onUpdateSettings({ maxPerRun: Number(e.target.value) || 5 })}
            className="w-12 rounded border border-gray-200 px-1 py-0.5 text-center text-[11px]"
          />
          건
        </label>
      </div>
    </div>
  );
}

// ── 대시보드 탭 ──

function DashboardTab({
  config, setConfig, boardCounts, collecting, collectProgress, onCollect, onCollectCategory, onCleanup,
}: {
  config: AiCollectorConfig;
  setConfig: React.Dispatch<React.SetStateAction<AiCollectorConfig>>;
  boardCounts: Record<string, number>;
  collecting: boolean;
  collectProgress: string;
  onCollect: () => void;
  onCollectCategory: (cat: AiCategory) => void;
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
              onFocus={(e) => {
                // 마스킹 placeholder는 클릭 시 자동 클리어 — 새 키 입력 깔끔하게
                if (e.target.value === "••••••••") setConfig((p) => ({ ...p, youtubeApiKey: "" }));
              }}
              onChange={(e) => setConfig((p) => ({ ...p, youtubeApiKey: e.target.value }))}
              placeholder={config.youtubeApiKey === "••••••••" ? "기존 키 저장됨 (변경하려면 클릭)" : "AIza..."}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            {config.youtubeApiKey === "••••••••" && (
              <p className="mt-1 text-[10px] text-emerald-600">🔒 키가 저장되어 있습니다. 입력 필드 클릭 시 새로 입력 가능.</p>
            )}
            {/* 키 진단 — videoCategories.list 1 quota 단위 호출로 즉시 검증 */}
            <button
              type="button"
              disabled={verifyingKey || !config.youtubeApiKey || config.youtubeApiKey === "••••••••"}
              onClick={async () => {
                setVerifyingKey(true);
                try {
                  const r = await verifyYoutubeApiKey(config.youtubeApiKey);
                  if (r.ok) {
                    toast(`✅ 키 정상 — 카테고리 응답: "${r.sampleCategory}"`, "success", 5000);
                  } else {
                    toast(`❌ 키 거부: ${r.error}`, "error", 8000);
                  }
                } finally {
                  setVerifyingKey(false);
                }
              }}
              className={cn(
                "mt-1.5 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              title="YouTube API 키 즉시 검증 (1 quota 사용)"
            >
              {verifyingKey ? <Loader2 size={11} className="animate-spin" /> : <KeyRound size={11} />}
              {verifyingKey ? "진단 중..." : "키 진단"}
            </button>
            {config.youtubeApiKey === "••••••••" && (
              <p className="mt-0.5 text-[10px] text-gray-400">진단하려면 입력 필드를 클릭해 새 키를 붙여넣은 뒤 누르세요.</p>
            )}
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

      {/* 카테고리별 수집 — 영상·게시판글·교육자료 의도별 실행 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-2">카테고리별 수집</h3>
        <p className="text-sm text-gray-500 mb-4">의도별로 분리 실행하면 카테고리에 맞는 큐레이션 정책(boardHints)이 적용되어 보드 분류가 정확해집니다.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ALL_CATEGORIES.map((cat) => (
            <CategoryCollectCard
              key={cat}
              category={cat}
              collecting={collecting}
              onCollect={() => onCollectCategory(cat)}
              settings={config.categorySettings?.[cat] ?? DEFAULT_CATEGORY_SETTINGS[cat]}
              onUpdateSettings={(patch) => setConfig((prev) => ({
                ...prev,
                categorySettings: {
                  ...(prev.categorySettings ?? {}),
                  [cat]: { ...(prev.categorySettings?.[cat] ?? DEFAULT_CATEGORY_SETTINGS[cat]), ...patch },
                },
              }))}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onCollect}
            disabled={collecting}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white",
              "bg-purple-500 hover:bg-purple-600 disabled:opacity-50",
            )}
          >
            {collecting ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
            {collecting ? "수집중..." : "전체 수집(3 카테고리 순차)"}
          </button>
          <button
            type="button"
            onClick={onCleanup}
            disabled={collecting}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <Trash2 size={16} />
            중복 정리
          </button>
        </div>
        {collectProgress && (
          <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50/60 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw size={14} className="animate-spin text-purple-600" />
              <span className="text-sm font-medium text-purple-700">{collectProgress}</span>
            </div>
            {/* 단계 stepper — collectProgress 문자열에서 키워드 매칭으로 active 추론 */}
            <div className="flex items-center gap-1 text-[10px]">
              {[
                { key: "수집", label: "1.수집" },
                { key: "중복", label: "2.중복제거" },
                { key: "큐레이션", label: "3.큐레이션" },
                { key: "저장", label: "4.저장" },
              ].map((s, i, arr) => {
                const idx = arr.findIndex((x) => collectProgress.includes(x.key));
                const active = idx === i;
                const done = idx > i;
                return (
                  <span
                    key={s.key}
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium border",
                      active && "bg-purple-500 text-white border-purple-500",
                      done && "bg-emerald-100 text-emerald-700 border-emerald-200",
                      !active && !done && "bg-white text-gray-400 border-gray-200",
                    )}
                  >
                    {done ? "✓ " : ""}{s.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
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

function HistoryTab({
  runs,
  loading,
  onApplySearchHistory,
}: {
  runs: CollectionRun[];
  loading: boolean;
  onApplySearchHistory: (opts: SearchOptsSnapshot) => void;
}) {
  return (
    <div className="space-y-6">
      {/* ① YouTube 검색 영역 — 빨간 톤 박스로 자동 수집 이력과 시각 구분 */}
      <div className="rounded-2xl border-2 border-red-100 bg-red-50/30 p-5 space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-red-100">
          <span className="text-base">🔍</span>
          <h2 className="text-sm font-bold text-red-700">YouTube 검색 (수동 탐색)</h2>
          <span className="text-[11px] text-red-500/80">관리자가 수동으로 검색해 발견한 영상 기록</span>
        </div>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Eye size={12} className="text-gray-400" />
            검색 결과 회차
          </h3>
          <p className="text-[11px] text-gray-500">최근 검색에서 발견된 영상 목록 보관 — 펼치면 썸네일·제목·채널 확인.</p>
          <YoutubeSearchSnapshotsList onApplyOpts={onApplySearchHistory} />
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Search size={12} className="text-gray-400" />
            검색 조건 히스토리
          </h3>
          <p className="text-[11px] text-gray-500">칩 클릭 시 고급 검색 탭으로 전환 + 옵션 복원.</p>
          <YoutubeSearchHistoryChips onApply={onApplySearchHistory} variant="full" />
        </section>
      </div>

      {/* ② 자동/수동 수집 실행 이력 — 보라 톤 박스로 별도 컨텍스트 강조 */}
      <div className="rounded-2xl border-2 border-purple-100 bg-purple-50/30 p-5 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-purple-100">
          <span className="text-base">🤖</span>
          <h2 className="text-sm font-bold text-purple-700">자동·수동 수집 실행 로그</h2>
          <span className="text-[11px] text-purple-500/80">cron + 대시보드 실행 1회씩 1 row</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw size={24} className="animate-spin text-gray-400" /></div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">수집 이력이 없습니다</div>
        ) : (
          <RunsList runs={runs} />
        )}
      </div>
    </div>
  );
}

function RunsList({ runs }: { runs: CollectionRun[] }) {
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
  const [categoryFilter, setCategoryFilter] = useState<AiCategory | "all">("all");
  const [bulking, setBulking] = useState(false);

  // boardKey → 카테고리 매핑으로 클라이언트 필터링
  const filtered = items.filter((it) => {
    if (categoryFilter === "all") return true;
    return categoryOfBoard(it.boardKey) === categoryFilter;
  });

  const bulkApprove = async () => {
    if (filtered.length === 0 || bulking) return;
    if (!confirm(`현재 필터 ${filtered.length}건을 모두 승인합니까?`)) return;
    setBulking(true);
    try {
      const { updateDocFields } = await import("@/lib/firestore");
      for (const it of filtered) {
        await updateDocFields(COLLECTIONS.CONTENTS, it.id, { isApproved: true });
        onApprove(it.id);
      }
      toast(`${filtered.length}건 승인 완료`, "success");
    } catch { toast("일괄 승인 중 오류", "error"); }
    setBulking(false);
  };

  const bulkReject = async () => {
    if (filtered.length === 0 || bulking) return;
    if (!confirm(`현재 필터 ${filtered.length}건을 모두 반려(삭제)합니까?`)) return;
    setBulking(true);
    try {
      for (const it of filtered) {
        await onReject(it.id);
      }
      toast(`${filtered.length}건 반려 완료`, "success");
    } catch { toast("일괄 반려 중 오류", "error"); }
    setBulking(false);
  };

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
      {/* 필터 + 일괄 액션 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">카테고리</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as AiCategory | "all")}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="all">전체</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">{filtered.length}건</span>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={bulkApprove}
            disabled={bulking || filtered.length === 0}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            전체 승인
          </button>
          <button
            type="button"
            onClick={bulkReject}
            disabled={bulking || filtered.length === 0}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            전체 반려
          </button>
        </div>
      </div>
      {filtered.length === 0 && (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-400">
          이 카테고리에 검토 대기 콘텐츠가 없습니다.
        </div>
      )}
      {filtered.map((item) => (
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
  const [categoryFilter, setCategoryFilter] = useState<AiCategory | "all">("all");

  // 탭 진입 시마다 자동 갱신 — stale 데이터 방지
  useEffect(() => {
    onLoadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = Date.now();
  const periodMs: Record<StatPeriod, number> = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    all: Infinity,
  };

  const filtered = runs.filter((r) => {
    if (now - new Date(r.runAt).getTime() >= periodMs[period]) return false;
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    return true;
  });

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

  // 단계별 변환율 — 직전 단계 대비 통과율 (이전 single rate는 misleading)
  const dedupRate = totals.collected > 0 ? (totals.unique / totals.collected) * 100 : 0;
  const curationRate = totals.unique > 0 ? (totals.curated / totals.unique) * 100 : 0;
  const insertRate = totals.curated > 0 ? (totals.inserted / totals.curated) * 100 : 0;
  const overallRate = totals.collected > 0 ? (totals.inserted / totals.collected) * 100 : 0;

  if (!runsLoaded) return <div className="flex justify-center py-12"><RefreshCw size={24} className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6">
      {/* 기간 + 카테고리 필터 */}
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-gray-500">카테고리</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as AiCategory | "all")}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="all">전체</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center" title="원본 수집 대비 최종 삽입 비율 (전체 파이프라인 통과율)">
          <p className="text-3xl font-bold text-purple-600">{overallRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">전체 통과율</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-blue-600">{avgDuration}초</p>
          <p className="text-xs text-gray-500 mt-1">평균 실행 시간</p>
        </div>
      </div>

      {/* 누적 파이프라인 — 단계별 funnel + 단계간 변환율 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-1">수집 파이프라인 변환율</h3>
        <p className="text-xs text-gray-500 mb-4">각 단계의 감소를 시각화 — 어디서 가장 많이 빠지는지 한눈에.</p>
        <div className="space-y-2">
          {[
            { key: "collected" as const, label: "수집", color: "bg-gray-400", barColor: "bg-gray-200" },
            { key: "unique" as const, label: "고유 (중복 제거 후)", color: "bg-blue-500", barColor: "bg-blue-100", prevRate: dedupRate, prevLabel: "중복 제거 후 통과" },
            { key: "curated" as const, label: "큐레이션 통과", color: "bg-purple-500", barColor: "bg-purple-100", prevRate: curationRate, prevLabel: "Gemini 품질 통과" },
            { key: "inserted" as const, label: "삽입", color: "bg-green-500", barColor: "bg-green-100", prevRate: insertRate, prevLabel: "보드 cap 통과" },
          ].map((stage) => {
            const val = totals[stage.key];
            const pct = totals.collected > 0 ? (val / totals.collected) * 100 : 0;
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-xs text-gray-600">{stage.label}</div>
                <div className="flex-1 h-6 rounded-full bg-gray-50 relative overflow-hidden">
                  <div
                    className={cn("absolute left-0 top-0 h-full rounded-full transition-all", stage.color)}
                    style={{ width: `${Math.max(pct, val > 0 ? 1 : 0)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-bold text-gray-700">
                    {val} ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-32 shrink-0 text-right text-[11px] text-gray-400">
                  {"prevRate" in stage && stage.prevRate !== undefined && (
                    <>
                      <span className={cn("font-semibold", stage.prevRate >= 70 ? "text-emerald-600" : stage.prevRate >= 30 ? "text-amber-600" : "text-rose-600")}>
                        ↓ {stage.prevRate.toFixed(0)}%
                      </span>
                      <br />
                      <span>{stage.prevLabel}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {totals.failed > 0 && (
          <p className="mt-4 text-xs text-rose-600">❌ 삽입 실패: {totals.failed}건 (네트워크·권한·Firestore 오류)</p>
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
