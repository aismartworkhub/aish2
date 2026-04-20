"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ImageIcon, Hash, MousePointerClick, Megaphone,
  Save, Plus, Trash2, GripVertical,
  Key, Mail, Cloud, Calendar, Database, Shield, Loader2,
  Palette, Check, Bot, RefreshCw, ToggleLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTIONS, getSingletonDoc, setSingletonDoc, upsertDoc } from "@/lib/firestore";
import { useToast } from "@/components/ui/Toast";
import AdminSettingsPublicHint from "@/components/admin/AdminSettingsPublicHint";
import {
  ADMIN_SETTINGS_SAVED_PUBLIC_HINT,
  isValidNonEmptyImageSource,
  isValidOptionalHttpOrPath,
} from "@/lib/admin-validation";
import { type FeatureFlags, DEFAULT_FEATURE_FLAGS, invalidateFeatureFlagsCache } from "@/lib/site-settings-public";
import { collectAll } from "@/lib/ai-content-collector";
import type { CollectResult } from "@/lib/ai-content-collector";
import { curateItems } from "@/lib/ai-content-curator";
import type { CuratedItem } from "@/lib/ai-content-curator";
import { getExistingUrls, filterDuplicates, cleanupDuplicates } from "@/lib/ai-content-dedup";
import { createContentIfNew } from "@/lib/content-engine";

type SettingsTab = "hero" | "stats" | "cta" | "banner" | "integrations" | "theme" | "ai" | "features";

type HomeTemplate = "default" | "modern" | "community";

interface HeroSlide { imageUrl: string; title: string; subtitle: string; ctaText: string; ctaLink: string; isActive: boolean; }
interface StatItem { label: string; value: number; unit: string; icon: string; }
interface CtaConfig { buttonText: string; buttonUrl: string; floatingEnabled: boolean; }
interface BannerConfig { enabled: boolean; title: string; dDayDate: string; link: string; }

interface GoogleApiConfig { clientId: string; clientSecret: string; apiKey: string; }
interface EmailConfig { adminEmail: string; smtpServer: string; senderName: string; }
interface DriveConfig { folderId: string; autoSyncEnabled: boolean; }
interface CalendarConfig { calendarId: string; autoRegisterEnabled: boolean; }

const MASKED_VALUE = "••••••••";
const SENSITIVE_FIELDS = ["clientSecret", "apiKey"] as const;

function maskSensitive(value: string): string {
  if (!value) return "";
  return MASKED_VALUE;
}

function isMasked(value: string): boolean {
  return value === MASKED_VALUE;
}

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "theme", label: "홈 테마", icon: Palette },
  { id: "ai", label: "AI 수집", icon: Bot },
  { id: "hero", label: "히어로 섹션", icon: ImageIcon },
  { id: "stats", label: "실적 수치", icon: Hash },
  { id: "cta", label: "CTA 설정", icon: MousePointerClick },
  { id: "banner", label: "배너 관리", icon: Megaphone },
  { id: "integrations", label: "외부 연동", icon: Key },
  { id: "features" as SettingsTab, label: "기능 관리", icon: ToggleLeft },
];

interface AiCollectorConfig {
  youtubeApiKey: string;
  maxItemsPerRun: number;
  minQualityScore: number;
  lastRunAt?: string;
  lastRunResult?: {
    collected: number;
    unique: number;
    curated: number;
    inserted: number;
    failed: number;
  };
}

const DEFAULT_AI_CONFIG: AiCollectorConfig = {
  youtubeApiKey: "",
  maxItemsPerRun: 10,
  minQualityScore: 7,
};

const THEME_OPTIONS: { id: HomeTemplate; name: string; desc: string }[] = [
  { id: "default", name: "1안 — 클래식", desc: "풀스크린 히어로, 검색 바, 카드 레이아웃 중심의 기본 디자인" },
  { id: "modern", name: "2안 — 모던", desc: "SaaS 스타일 그라데이션 히어로, 다크 인사이트 섹션" },
  { id: "community", name: "3안 — 커뮤니티", desc: "회원 혜택 강조, 커뮤니티 참여 중심 구성" },
];

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-400 text-sm">불러오는 중...</div>}>
      <AdminSettingsInner />
    </Suspense>
  );
}

function AdminSettingsInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabParam || "theme");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [tabLoading, setTabLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (tabParam && ["hero", "stats", "cta", "banner", "integrations", "theme", "ai", "features"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Hero
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);

  // Stats
  const [stats, setStats] = useState<StatItem[]>([]);

  // CTA
  const [cta, setCta] = useState<CtaConfig>({ buttonText: "수강 신청하기", buttonUrl: "", floatingEnabled: true });

  // Banner
  const [banner, setBanner] = useState<BannerConfig>({ enabled: true, title: "", dDayDate: "", link: "" });

  // Theme
  const [homeTemplate, setHomeTemplate] = useState<HomeTemplate>("default");

  // AI Collector
  const [aiConfig, setAiConfig] = useState<AiCollectorConfig>(DEFAULT_AI_CONFIG);
  const [collecting, setCollecting] = useState(false);
  const [collectProgress, setCollectProgress] = useState("");

  // Feature Flags
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);

  // Integrations
  const [googleApi, setGoogleApi] = useState<GoogleApiConfig>({ clientId: "", clientSecret: "", apiKey: "" });
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({ adminEmail: "", smtpServer: "", senderName: "" });
  const [driveConfig, setDriveConfig] = useState<DriveConfig>({ folderId: "", autoSyncEnabled: false });
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig>({ calendarId: "", autoRegisterEnabled: false });

  const loadTabData = useCallback(async (tab: SettingsTab) => {
    setTabLoading(true);
    try {
      if (tab === "theme") {
        const themeDoc = await getSingletonDoc<{ homeTemplate: HomeTemplate }>(COLLECTIONS.SETTINGS, "theme");
        if (themeDoc?.homeTemplate) setHomeTemplate(themeDoc.homeTemplate);
      } else if (tab === "ai") {
        const aiDoc = await getSingletonDoc<AiCollectorConfig>(COLLECTIONS.SETTINGS, "ai-collector");
        if (aiDoc) setAiConfig({ ...DEFAULT_AI_CONFIG, ...aiDoc });
      } else if (tab === "hero") {
        const heroDoc = await getSingletonDoc<{ slides: HeroSlide[] }>(COLLECTIONS.SETTINGS, "hero");
        if (heroDoc?.slides) setHeroSlides(heroDoc.slides);
      } else if (tab === "stats") {
        const statsDoc = await getSingletonDoc<{ items: StatItem[] }>(COLLECTIONS.SETTINGS, "stats");
        if (statsDoc?.items) setStats(statsDoc.items);
      } else if (tab === "cta") {
        const ctaDoc = await getSingletonDoc<CtaConfig>(COLLECTIONS.SETTINGS, "cta");
        if (ctaDoc) setCta({ buttonText: ctaDoc.buttonText ?? "", buttonUrl: ctaDoc.buttonUrl ?? "", floatingEnabled: ctaDoc.floatingEnabled ?? true });
      } else if (tab === "banner") {
        const bannerDoc = await getSingletonDoc<BannerConfig>(COLLECTIONS.SETTINGS, "banner");
        if (bannerDoc) setBanner({ enabled: bannerDoc.enabled ?? true, title: bannerDoc.title ?? "", dDayDate: bannerDoc.dDayDate ?? "", link: bannerDoc.link ?? "" });
      } else if (tab === "features") {
        const ffDoc = await getSingletonDoc<FeatureFlags>(COLLECTIONS.SETTINGS, "featureFlags");
        if (ffDoc) setFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, ...ffDoc });
      } else if (tab === "integrations") {
        const intDoc = await getSingletonDoc<{ googleApi: GoogleApiConfig; emailConfig: EmailConfig; driveConfig: DriveConfig; calendarConfig: CalendarConfig }>(COLLECTIONS.SETTINGS, "integrations");
        if (intDoc) {
          if (intDoc.googleApi) setGoogleApi({
            ...intDoc.googleApi,
            clientSecret: maskSensitive(intDoc.googleApi.clientSecret),
            apiKey: maskSensitive(intDoc.googleApi.apiKey),
          });
          if (intDoc.emailConfig) setEmailConfig(intDoc.emailConfig);
          if (intDoc.driveConfig) setDriveConfig(intDoc.driveConfig);
          if (intDoc.calendarConfig) setCalendarConfig(intDoc.calendarConfig);
        }
      }
    } catch { /* 로드 실패 시 기본값 유지 */ }
    setTabLoading(false);
  }, []);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  const validateBeforeSave = (): string | null => {
    if (activeTab === "hero") {
      for (let i = 0; i < heroSlides.length; i++) {
        const s = heroSlides[i];
        if (!isValidNonEmptyImageSource(s.imageUrl)) {
          return `슬라이드 ${i + 1}: 이미지 URL을 입력하세요. (/로 시작하는 경로 또는 https:// URL)`;
        }
        if (!isValidOptionalHttpOrPath(s.ctaLink)) {
          return `슬라이드 ${i + 1}: CTA 링크는 https:// 또는 / 로 시작해야 합니다. (비우면 사이트 공통 CTA URL 사용)`;
        }
      }
    }
    if (activeTab === "cta") {
      if (!isValidOptionalHttpOrPath(cta.buttonUrl)) {
        return "연결 URL은 https:// 또는 / 로 시작하는 경로여야 합니다. (비우면 기본 교육과정 URL이 사용됩니다.)";
      }
    }
    if (activeTab === "banner") {
      if (banner.link.trim() && !isValidOptionalHttpOrPath(banner.link)) {
        return "배너 연결 URL 형식을 확인하세요. (https:// 또는 / 경로)";
      }
    }
    return null;
  };

  const showSave = async () => {
    const err = validateBeforeSave();
    if (err) {
      toast(err, "error");
      return;
    }
    setSaving(true);
    try {
      if (activeTab === "theme") {
        await setSingletonDoc(COLLECTIONS.SETTINGS, "theme", { homeTemplate });
      } else if (activeTab === "ai") {
        await setSingletonDoc(COLLECTIONS.SETTINGS, "ai-collector", {
          youtubeApiKey: aiConfig.youtubeApiKey,
          maxItemsPerRun: aiConfig.maxItemsPerRun,
          minQualityScore: aiConfig.minQualityScore,
        });
      } else if (activeTab === "hero") {
        await setSingletonDoc(COLLECTIONS.SETTINGS, "hero", { slides: heroSlides });
      } else if (activeTab === "stats") {
        await setSingletonDoc(COLLECTIONS.SETTINGS, "stats", { items: stats });
      } else if (activeTab === "cta") {
        await setSingletonDoc(COLLECTIONS.SETTINGS, "cta", cta);
      } else if (activeTab === "banner") {
        await setSingletonDoc(COLLECTIONS.SETTINGS, "banner", banner);
      } else if (activeTab === "features") {
        await setSingletonDoc(COLLECTIONS.SETTINGS, "featureFlags", featureFlags);
        invalidateFeatureFlagsCache();
      } else if (activeTab === "integrations") {
        const safeGoogleApi = { ...googleApi };
        for (const field of SENSITIVE_FIELDS) {
          if (isMasked(safeGoogleApi[field])) {
            delete (safeGoogleApi as Record<string, unknown>)[field];
          }
        }
        await upsertDoc(COLLECTIONS.SETTINGS, "integrations", { googleApi: safeGoogleApi, emailConfig, driveConfig, calendarConfig });
      }
      setSaveMessage("저장되었습니다");
      toast(`저장되었습니다.\n${ADMIN_SETTINGS_SAVED_PUBLIC_HINT}`, "success");
      setTimeout(() => setSaveMessage(""), 2000);
    } catch {
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateHeroSlide = (index: number, field: keyof HeroSlide, value: string | boolean) => {
    setHeroSlides((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };
  const addHeroSlide = () => setHeroSlides((prev) => [...prev, { imageUrl: "/images/defaults/hero-main.jpg", title: "", subtitle: "", ctaText: "", ctaLink: "", isActive: true }]);
  const deleteHeroSlide = (index: number) => { if (confirm("삭제하시겠습니까?")) setHeroSlides((prev) => prev.filter((_, i) => i !== index)); };

  const updateStat = (index: number, field: keyof StatItem, value: string | number) => {
    setStats((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };
  const addStat = () => setStats((prev) => [...prev, { label: "", value: 0, unit: "", icon: "Users" }]);
  const deleteStat = (index: number) => {
    if (!confirm("이 실적 항목을 삭제하시겠습니까?")) return;
    setStats((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">사이트 설정</h1>
        <p className="text-gray-500 mt-1">메인 페이지 히어로, 실적, CTA, 배너를 관리합니다.</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {SETTINGS_TABS.map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSaveMessage(""); }}
            className={cn("inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab.id ? "bg-primary-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50")}>
            <tab.icon size={16} />{tab.label}
          </button>
        ))}
      </div>

      <AdminSettingsPublicHint tab={activeTab} />

      {tabLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      ) : (<>

      {/* 홈 테마 */}
      {activeTab === "theme" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">홈페이지 테마 선택</h2>
          <p className="text-sm text-gray-500 mb-6">공개 홈페이지에 적용할 디자인을 선택하세요. 저장 즉시 반영됩니다.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {THEME_OPTIONS.map((opt) => {
              const selected = homeTemplate === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setHomeTemplate(opt.id)}
                  className={cn(
                    "relative text-left p-5 rounded-xl border-2 transition-all",
                    selected
                      ? "border-primary-600 bg-primary-50 shadow-md"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                  )}
                >
                  {selected && (
                    <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </span>
                  )}
                  <h3 className={cn("text-base font-bold mb-1", selected ? "text-primary-700" : "text-gray-900")}>
                    {opt.name}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{opt.desc}</p>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-6">
            <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"><Save size={16} />{saving ? "저장중..." : "저장하기"}</button>
            {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
          </div>

        </div>
      )}

      {/* AI 수집 */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          {/* 수집 설정 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">AI 콘텐츠 자동 수집</h2>
            <p className="text-sm text-gray-500 mb-6">YouTube, GitHub, Reddit, X.com, Instagram에서 최신 AI 콘텐츠를 수집하고 Gemini로 교차 검증합니다.</p>

            <div className="space-y-4 max-w-lg">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">YouTube API Key</label>
                <p className="text-xs text-gray-400 mb-1">Google Cloud Console에서 YouTube Data API v3 키를 발급받으세요. 없으면 YouTube 수집을 건너뜁니다.</p>
                <input
                  type="password"
                  value={aiConfig.youtubeApiKey}
                  onChange={(e) => setAiConfig({ ...aiConfig, youtubeApiKey: e.target.value })}
                  placeholder="AIza..."
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">수집 최대 건수</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={aiConfig.maxItemsPerRun}
                    onChange={(e) => setAiConfig({ ...aiConfig, maxItemsPerRun: Number(e.target.value) || 10 })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">최소 품질 점수</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={aiConfig.minQualityScore}
                    onChange={(e) => setAiConfig({ ...aiConfig, minQualityScore: Number(e.target.value) || 7 })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <p className="text-xs text-gray-400 mt-1">Gemini 품질 점수 1~10, 이 점수 미만은 제외</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50">
                <Save size={16} />{saving ? "저장중..." : "설정 저장"}
              </button>
              {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
            </div>
          </div>

          {/* 즉시 수집 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">즉시 수집</h3>
            <p className="text-sm text-gray-500 mb-4">
              버튼을 누르면 즉시 수집을 시작합니다. 브라우저에서는 YouTube, GitHub 수집이 가능하며, Reddit/X.com/Instagram은 CORS 제한으로 건너뛸 수 있습니다.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={collecting || saving}
                onClick={async () => {
                  if (!confirm("AI 콘텐츠를 수집합니다. 진행하시겠습니까?")) return;
                  setCollecting(true);
                  setCollectProgress("소스에서 수집 중...");

                  try {
                    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";

                    const result: CollectResult = await collectAll({
                      youtubeApiKey: aiConfig.youtubeApiKey,
                      maxPerSource: Math.ceil(aiConfig.maxItemsPerRun / 3),
                    });
                    setCollectProgress(`${result.items.length}건 수집 완료. 중복 확인 중...`);

                    const existingUrls = await getExistingUrls();
                    const unique = filterDuplicates(result.items, existingUrls);
                    setCollectProgress(`${unique.length}건 고유 항목. Gemini 큐레이션 중...`);

                    let curated: CuratedItem[];
                    if (geminiKey) {
                      curated = await curateItems(unique, geminiKey, aiConfig.minQualityScore);
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

                    curated.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
                    const toInsert = curated.slice(0, aiConfig.maxItemsPerRun);
                    setCollectProgress(`${toInsert.length}건 큐레이션 완료. 저장 중...`);

                    let inserted = 0;
                    let skipped = 0;
                    for (const item of toInsert) {
                      try {
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
                          isApproved: true,
                        });
                        if (docId) inserted++;
                        else skipped++;
                        await new Promise((r) => setTimeout(r, 300));
                      } catch {
                        /* 개별 삽입 실패 무시 */
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
                      ...aiConfig,
                      lastRunAt: new Date().toISOString(),
                      lastRunResult: runResult,
                    });
                    setAiConfig((prev) => ({
                      ...prev,
                      lastRunAt: new Date().toISOString(),
                      lastRunResult: runResult,
                    }));

                    const sourceInfo = Object.entries(result.sourceResults)
                      .map(([k, v]) => `${k}: ${v.count}건${v.error ? "(오류)" : ""}`)
                      .join(", ");
                    toast(`수집 완료! ${inserted}건 삽입, ${skipped}건 중복 스킵 (${sourceInfo})`, inserted > 0 ? "success" : "info");
                    setCollectProgress(`완료: ${inserted}건 삽입됨`);
                  } catch (e) {
                    toast("수집 중 오류가 발생했습니다.", "error");
                    setCollectProgress(`오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
                  } finally {
                    setCollecting(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={collecting ? "animate-spin" : ""} />
                {collecting ? "수집중..." : "즉시 수집 실행"}
              </button>

              <button
                type="button"
                disabled={collecting || saving}
                onClick={async () => {
                  if (!confirm("기존 중복 콘텐츠를 정리합니다. 오래된 항목만 남기고 나머지를 삭제합니다.")) return;
                  setSaving(true);
                  try {
                    const { removed, groups } = await cleanupDuplicates();
                    toast(`중복 정리 완료: ${groups}개 그룹에서 ${removed}건 삭제`, removed > 0 ? "success" : "info");
                  } catch {
                    toast("중복 정리에 실패했습니다.", "error");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
                중복 정리
              </button>
            </div>

            {collectProgress && (
              <div className={cn(
                "mt-4 p-3 rounded-lg text-sm",
                collecting ? "bg-blue-50 text-blue-800" : collectProgress.startsWith("오류") ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800",
              )}>
                {collecting && <Loader2 size={14} className="inline animate-spin mr-2" />}
                {collectProgress}
              </div>
            )}
          </div>

          {/* 최근 수집 결과 */}
          {aiConfig.lastRunAt && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4">최근 수집 결과</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: "수집", value: aiConfig.lastRunResult?.collected ?? 0, color: "text-gray-900" },
                  { label: "고유", value: aiConfig.lastRunResult?.unique ?? 0, color: "text-blue-600" },
                  { label: "큐레이션", value: aiConfig.lastRunResult?.curated ?? 0, color: "text-purple-600" },
                  { label: "삽입", value: aiConfig.lastRunResult?.inserted ?? 0, color: "text-green-600" },
                  { label: "실패", value: aiConfig.lastRunResult?.failed ?? 0, color: "text-red-600" },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 rounded-lg bg-gray-50">
                    <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                마지막 실행: {new Date(aiConfig.lastRunAt).toLocaleString("ko-KR")}
              </p>
            </div>
          )}

          {/* 소스 안내 */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">수집 소스 안내</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>YouTube — Data API v3 (API Key 필요, 7일 이내 영상)</li>
              <li>GitHub — Search API (인증 없이 가능, 7일 이내 업데이트된 리포)</li>
              <li>Reddit — r/artificial, r/MachineLearning, r/LocalLLaMA (브라우저에서 CORS 제한 가능)</li>
              <li>X.com — Nitter RSS 브릿지 경유 (불안정, 실패 시 건너뜀)</li>
              <li>Instagram — 해시태그 스크래핑 (불안정, 실패 시 건너뜀)</li>
            </ul>
            <p className="text-xs text-gray-400 mt-2">
              매일 자정(KST) GitHub Actions 크론으로 전체 소스 자동 수집이 실행됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 히어로 */}
      {activeTab === "hero" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">히어로 슬라이드 관리</h2>
              <button onClick={addHeroSlide} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 text-primary-600 text-sm font-medium hover:bg-primary-100 transition-colors">
                <Plus size={16} />슬라이드 추가
              </button>
            </div>
            <div className="space-y-4">
              {heroSlides.map((slide, index) => (
                <div key={index} className="p-4 rounded-xl border border-gray-200 hover:border-primary-200 transition-colors">
                  <div className="flex items-center gap-4 mb-4">
                    <GripVertical size={18} className="text-gray-300 cursor-grab" />
                    <img src={slide.imageUrl} alt={`슬라이드 ${index + 1}`} className="w-24 h-14 rounded-lg object-cover shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">슬라이드 {index + 1}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{slide.title || "(제목 없음)"}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={slide.isActive} onChange={(e) => updateHeroSlide(index, "isActive", e.target.checked)} className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 peer-checked:bg-primary-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                    <button onClick={() => deleteHeroSlide(index)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-0 sm:ml-10">
                    <div><label className="text-xs font-medium text-gray-500 mb-1 block">이미지 URL</label>
                      <input type="text" value={slide.imageUrl} onChange={(e) => updateHeroSlide(index, "imageUrl", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" /></div>
                    <div><label className="text-xs font-medium text-gray-500 mb-1 block">CTA 링크</label>
                      <input type="text" value={slide.ctaLink} onChange={(e) => updateHeroSlide(index, "ctaLink", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" /></div>
                    <div><label className="text-xs font-medium text-gray-500 mb-1 block">제목</label>
                      <input type="text" value={slide.title} onChange={(e) => updateHeroSlide(index, "title", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" /></div>
                    <div><label className="text-xs font-medium text-gray-500 mb-1 block">CTA 텍스트</label>
                      <input type="text" value={slide.ctaText} onChange={(e) => updateHeroSlide(index, "ctaText", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" /></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"><Save size={16} />{saving ? "저장중..." : "저장하기"}</button>
              {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">
              AI실전마스터·Specialty 카드(제목·이미지)는{" "}
              <a href="/admin/pages" className="underline font-medium text-primary-600">페이지 관리 &gt; 홈</a>
              에서 관리합니다.
            </p>
          </div>
        </div>
      )}

      {/* 실적 수치 */}
      {activeTab === "stats" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">숫자 실적 대시보드</h2>
          <div className="space-y-4">
            {stats.map((stat, index) => (
              <div key={index} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">항목명</label>
                    <input type="text" value={stat.label} onChange={(e) => updateStat(index, "label", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" /></div>
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">수치</label>
                    <input type="number" value={stat.value} onChange={(e) => updateStat(index, "value", Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" /></div>
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">단위</label>
                    <input type="text" value={stat.unit} onChange={(e) => updateStat(index, "unit", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" /></div>
                </div>
                <button onClick={() => deleteStat(index)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={addStat} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors"><Plus size={16} />항목 추가</button>
            <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"><Save size={16} />{saving ? "저장중..." : "저장하기"}</button>
            {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
          </div>
        </div>
      )}

      {/* CTA 설정 */}
      {activeTab === "cta" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">수강 신청 CTA 버튼 설정</h2>
          <div className="space-y-4 max-w-lg">
            <div><label className="text-sm font-medium text-gray-700 mb-2 block">버튼 텍스트</label>
              <input type="text" value={cta.buttonText} onChange={(e) => setCta({ ...cta, buttonText: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-2 block">연결 URL</label>
              <input type="text" inputMode="url" placeholder="https://… 또는 /programs"
                value={cta.buttonUrl} onChange={(e) => setCta({ ...cta, buttonUrl: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" /></div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={cta.floatingEnabled} onChange={(e) => setCta({ ...cta, floatingEnabled: e.target.checked })} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-checked:bg-primary-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
              <span className="text-sm text-gray-700">모바일 플로팅 버튼 활성화</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6">
            <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"><Save size={16} />{saving ? "저장중..." : "저장하기"}</button>
            {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
          </div>
        </div>
      )}

      {/* 배너 관리 */}
      {activeTab === "banner" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">워크톤 D-Day 배너 설정</h2>
          <div className="space-y-4 max-w-lg">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={banner.enabled} onChange={(e) => setBanner({ ...banner, enabled: e.target.checked })} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-checked:bg-primary-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
              <span className="text-sm text-gray-700">배너 노출</span>
            </div>
            <div><label className="text-sm font-medium text-gray-700 mb-2 block">배너 제목</label>
              <input type="text" value={banner.title} onChange={(e) => setBanner({ ...banner, title: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-2 block">D-Day 기준 날짜</label>
              <input type="date" value={banner.dDayDate} onChange={(e) => setBanner({ ...banner, dDayDate: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-2 block">연결 URL</label>
              <input type="text" inputMode="url" placeholder="https://… 또는 /workathon"
                value={banner.link} onChange={(e) => setBanner({ ...banner, link: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" /></div>
          </div>
          <div className="flex items-center gap-3 mt-6">
            <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"><Save size={16} />{saving ? "저장중..." : "저장하기"}</button>
            {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
          </div>
        </div>
      )}

      {/* 외부 연동 */}
      {activeTab === "integrations" && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-amber-600" />
              <p className="text-sm text-amber-800 font-medium">민감 정보는 마스킹 처리됩니다. 변경이 필요한 경우에만 새 값을 입력하세요.</p>
            </div>
          </div>

          {/* Google API 설정 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Key size={18} className="text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Google API 설정</h2>
            </div>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Google OAuth Client ID</label>
                <input type="text" value={googleApi.clientId} onChange={(e) => setGoogleApi({ ...googleApi, clientId: e.target.value })} placeholder="xxxx.apps.googleusercontent.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Google OAuth Client Secret</label>
                <input type="password" value={googleApi.clientSecret} onChange={(e) => setGoogleApi({ ...googleApi, clientSecret: e.target.value })} placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Google API Key</label>
                <input type="password" value={googleApi.apiKey} onChange={(e) => setGoogleApi({ ...googleApi, apiKey: e.target.value })} placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"><Save size={16} />{saving ? "저장중..." : "저장하기"}</button>
              {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
            </div>
          </div>

          {/* 이메일 설정 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <Mail size={18} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">이메일 설정</h2>
            </div>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">관리자 이메일 주소</label>
                <p className="text-xs text-gray-400 mb-1">문의 수신용 이메일 주소</p>
                <input type="email" value={emailConfig.adminEmail} onChange={(e) => setEmailConfig({ ...emailConfig, adminEmail: e.target.value })} placeholder="admin@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">SMTP 서버 (또는 Gmail API)</label>
                <input type="text" value={emailConfig.smtpServer} onChange={(e) => setEmailConfig({ ...emailConfig, smtpServer: e.target.value })} placeholder="smtp.gmail.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">발신자 이름</label>
                <input type="text" value={emailConfig.senderName} onChange={(e) => setEmailConfig({ ...emailConfig, senderName: e.target.value })} placeholder="AISH 관리자"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"><Save size={16} />{saving ? "저장중..." : "저장하기"}</button>
              {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
            </div>
          </div>

          {/* Google Drive 연동 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center">
                <Cloud size={18} className="text-yellow-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Google Drive 연동</h2>
            </div>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Google Drive Folder ID</label>
                <p className="text-xs text-gray-400 mb-1">갤러리 동기화용 폴더 ID</p>
                <input type="text" value={driveConfig.folderId} onChange={(e) => setDriveConfig({ ...driveConfig, folderId: e.target.value })} placeholder="1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={driveConfig.autoSyncEnabled} onChange={(e) => setDriveConfig({ ...driveConfig, autoSyncEnabled: e.target.checked })} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-200 peer-checked:bg-primary-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
                <span className="text-sm text-gray-700">자동 동기화 활성화</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"><Save size={16} />{saving ? "저장중..." : "저장하기"}</button>
              {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
            </div>
          </div>

          {/* Google Calendar 연동 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                <Calendar size={18} className="text-purple-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Google Calendar 연동</h2>
            </div>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Calendar ID</label>
                <input type="text" value={calendarConfig.calendarId} onChange={(e) => setCalendarConfig({ ...calendarConfig, calendarId: e.target.value })} placeholder="example@group.calendar.google.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={calendarConfig.autoRegisterEnabled} onChange={(e) => setCalendarConfig({ ...calendarConfig, autoRegisterEnabled: e.target.checked })} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-200 peer-checked:bg-primary-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
                <span className="text-sm text-gray-700">자동 일정 등록</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"><Save size={16} />{saving ? "저장중..." : "저장하기"}</button>
              {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
            </div>
          </div>

          {/* Firebase 설정 (read-only) */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
                <Database size={18} className="text-orange-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Firebase 설정</h2>
              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded">읽기 전용</span>
            </div>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Project ID</label>
                <input type="text" value="aish-web-v2" readOnly
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-600 cursor-not-allowed" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">상태</label>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-green-700 font-medium">연결됨</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 기능 관리 (Feature Flags) */}
      {activeTab === "features" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">기능 관리 (Phase별 ON/OFF)</h2>
          <p className="text-sm text-gray-500 mb-6">
            각 개선 단계를 활성화/비활성화합니다. 코드는 이미 배포되어 있으며, 여기서 활성화해야 사용자에게 보입니다.
          </p>
          <div className="space-y-6">
            {([
              { key: "phase1" as const, label: "Phase 1 — 기본 UX 개선", desc: "샘플 배지, 콘텐츠 딥링크, 로딩 스켈레톤 등", subs: [
                { key: "demoSampleBadge", label: "데모 데이터 [샘플] 배지" },
                { key: "contentDeepLink", label: "콘텐츠 딥링크 (공유 URL)" },
                { key: "loadingSkeleton", label: "로딩 스켈레톤 UI" },
              ]},
              { key: "phase2" as const, label: "Phase 2 — Google Apps Script 백엔드", desc: "환영 이메일, 명함→Drive, 관리자 알림", subs: [
                { key: "welcomeEmail", label: "가입 환영 이메일" },
                { key: "businessCardDrive", label: "명함 → Google Drive 전송" },
              ]},
              { key: "phase3" as const, label: "Phase 3 — 프로필 강화 + 명함 AI", desc: "Gemini API 키, 프로필 확장, 명함 분석", subs: [
                { key: "geminiKeyInput", label: "Gemini API 키 입력" },
                { key: "businessCardScan", label: "명함 AI 자동 분석" },
                { key: "extendedProfile", label: "프로필 필드 확장 (직책, 회사소개)" },
              ]},
              { key: "phase4" as const, label: "Phase 4 — 알림 + 커뮤니티 강화", desc: "알림 시스템, 공유 버튼, 인기글", subs: [
                { key: "notificationSystem", label: "알림 시스템" },
                { key: "shareButton", label: "콘텐츠 공유 버튼" },
                { key: "popularPosts", label: "인기글 섹션" },
              ]},
              { key: "phase5" as const, label: "Phase 5 — AI 상담사", desc: "사이트 전체 데이터를 학습한 AI 챗봇", subs: [
                { key: "aiCounselor", label: "AI 상담사 채팅" },
              ]},
            ]).map((phase) => (
              <div key={phase.key} className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{phase.label}</h3>
                    <p className="text-sm text-gray-500">{phase.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeatureFlags((prev) => ({
                      ...prev,
                      [phase.key]: { ...prev[phase.key], enabled: !prev[phase.key].enabled },
                    }))}
                    className={cn(
                      "relative w-12 h-6 rounded-full transition-colors",
                      featureFlags[phase.key].enabled ? "bg-primary-600" : "bg-gray-300"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                      featureFlags[phase.key].enabled ? "translate-x-6" : "translate-x-0.5"
                    )} />
                  </button>
                </div>
                {featureFlags[phase.key].enabled && phase.subs.length > 0 && (
                  <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-100 pl-4">
                    {phase.subs.map((sub) => (
                      <label key={sub.key} className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={featureFlags[phase.key][sub.key] === true}
                          onChange={(e) => setFeatureFlags((prev) => ({
                            ...prev,
                            [phase.key]: { ...prev[phase.key], [sub.key]: e.target.checked },
                          }))}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        {sub.label}
                      </label>
                    ))}
                    {phase.key === "phase2" && (
                      <div className="mt-3">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Apps Script 웹앱 URL</label>
                        <input
                          type="url"
                          value={(featureFlags.phase2 as FeatureFlags["phase2"]).gasWebappUrl || ""}
                          onChange={(e) => setFeatureFlags((prev) => ({
                            ...prev,
                            phase2: { ...prev.phase2, gasWebappUrl: e.target.value },
                          }))}
                          placeholder="https://script.google.com/macros/s/..."
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-6">
            <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"><Save size={16} />{saving ? "저장중..." : "저장하기"}</button>
            {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
          </div>
        </div>
      )}

      </>)}
    </div>
  );
}
