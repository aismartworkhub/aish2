"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ImageIcon, Hash, MousePointerClick, Megaphone,
  Save, Plus, Trash2, GripVertical,
  Key, Mail, Cloud, Calendar, Database, Shield,
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

type SettingsTab = "hero" | "stats" | "cta" | "banner" | "integrations";

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
  { id: "hero", label: "히어로 섹션", icon: ImageIcon },
  { id: "stats", label: "실적 수치", icon: Hash },
  { id: "cta", label: "CTA 설정", icon: MousePointerClick },
  { id: "banner", label: "배너 관리", icon: Megaphone },
  { id: "integrations", label: "외부 연동", icon: Key },
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
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabParam || "hero");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (tabParam && ["hero", "stats", "cta", "banner", "integrations"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Hero
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [eduImages, setEduImages] = useState<Record<string, string>>({});
  const [specImages, setSpecImages] = useState<Record<string, string>>({});

  // Stats
  const [stats, setStats] = useState<StatItem[]>([]);

  // CTA
  const [cta, setCta] = useState<CtaConfig>({ buttonText: "수강 신청하기", buttonUrl: "", floatingEnabled: true });

  // Banner
  const [banner, setBanner] = useState<BannerConfig>({ enabled: true, title: "", dDayDate: "", link: "" });

  // Integrations
  const [googleApi, setGoogleApi] = useState<GoogleApiConfig>({ clientId: "", clientSecret: "", apiKey: "" });
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({ adminEmail: "", smtpServer: "", senderName: "" });
  const [driveConfig, setDriveConfig] = useState<DriveConfig>({ folderId: "", autoSyncEnabled: false });
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig>({ calendarId: "", autoRegisterEnabled: false });

  useEffect(() => {
    Promise.all([
      getSingletonDoc<{ slides: HeroSlide[]; educationImages: Record<string, string>; specialtyImages: Record<string, string> }>(COLLECTIONS.SETTINGS, "hero"),
      getSingletonDoc<{ items: StatItem[] }>(COLLECTIONS.SETTINGS, "stats"),
      getSingletonDoc<CtaConfig>(COLLECTIONS.SETTINGS, "cta"),
      getSingletonDoc<BannerConfig>(COLLECTIONS.SETTINGS, "banner"),
      getSingletonDoc<{ googleApi: GoogleApiConfig; emailConfig: EmailConfig; driveConfig: DriveConfig; calendarConfig: CalendarConfig }>(COLLECTIONS.SETTINGS, "integrations"),
    ]).then(([heroDoc, statsDoc, ctaDoc, bannerDoc, intDoc]) => {
      if (heroDoc) {
        if (heroDoc.slides) setHeroSlides(heroDoc.slides);
        if (heroDoc.educationImages) setEduImages(heroDoc.educationImages);
        if (heroDoc.specialtyImages) setSpecImages(heroDoc.specialtyImages);
      }
      if (statsDoc?.items) setStats(statsDoc.items);
      if (ctaDoc) setCta({ buttonText: ctaDoc.buttonText ?? "", buttonUrl: ctaDoc.buttonUrl ?? "", floatingEnabled: ctaDoc.floatingEnabled ?? true });
      if (bannerDoc) setBanner({ enabled: bannerDoc.enabled ?? true, title: bannerDoc.title ?? "", dDayDate: bannerDoc.dDayDate ?? "", link: bannerDoc.link ?? "" });
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
    }).catch(console.error);
  }, []);

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
      for (const url of Object.values(eduImages)) {
        if (url.trim() && !isValidNonEmptyImageSource(url)) {
          return "Education 이미지 URL 형식을 확인하세요.";
        }
      }
      for (const url of Object.values(specImages)) {
        if (url.trim() && !isValidNonEmptyImageSource(url)) {
          return "Specialty 이미지 URL 형식을 확인하세요.";
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
      if (activeTab === "hero") {
        await setSingletonDoc(COLLECTIONS.SETTINGS, "hero", { slides: heroSlides, educationImages: eduImages, specialtyImages: specImages });
      } else if (activeTab === "stats") {
        await setSingletonDoc(COLLECTIONS.SETTINGS, "stats", { items: stats });
      } else if (activeTab === "cta") {
        await setSingletonDoc(COLLECTIONS.SETTINGS, "cta", cta);
      } else if (activeTab === "banner") {
        await setSingletonDoc(COLLECTIONS.SETTINGS, "banner", banner);
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

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Education 섹션 이미지</h2>
            <div className="space-y-3">
              {Object.entries(eduImages).map(([label, url]) => (
                <div key={label} className="flex items-center gap-4 p-3 rounded-lg border border-gray-200">
                  <img src={url} alt={label} className="w-16 h-10 rounded object-cover shrink-0" />
                  <span className="text-sm font-medium text-gray-700 w-24 shrink-0">{label}</span>
                  <input type="text" value={url} onChange={(e) => setEduImages((prev) => ({ ...prev, [label]: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"><Save size={16} />{saving ? "저장중..." : "저장하기"}</button>
              {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Specialty 섹션 이미지</h2>
            <div className="space-y-3">
              {Object.entries(specImages).map(([label, url]) => (
                <div key={label} className="flex items-center gap-4 p-3 rounded-lg border border-gray-200">
                  <img src={url} alt={label} className="w-16 h-10 rounded object-cover shrink-0" />
                  <span className="text-sm font-medium text-gray-700 w-24 shrink-0">{label}</span>
                  <input type="text" value={url} onChange={(e) => setSpecImages((prev) => ({ ...prev, [label]: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button onClick={showSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"><Save size={16} />{saving ? "저장중..." : "저장하기"}</button>
              {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
            </div>
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
    </div>
  );
}
