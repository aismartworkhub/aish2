"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Save, Plus, Trash2, ChevronUp, ChevronDown, Loader2, ExternalLink, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTIONS, PAGE_DOC_ID, getSingletonDoc, setSingletonDoc } from "@/lib/firestore";
import { useToast } from "@/components/ui/Toast";
import { HtmlEditor } from "@/components/admin/HtmlEditor";
import { PAGE_DEFAULTS, invalidatePageContentCache } from "@/lib/page-content-public";
import { PAGE_CONTENT_SAVED_PUBLIC_HINT } from "@/lib/admin-validation";
import type {
  PageKey,
  PageContentBase,
  HomePageContent,
  AboutPageContent,
  ValueItem,
  EducationCard,
  SpecialtyCard,
  PageSection,
} from "@/types/page-content";

const PAGE_TABS: { key: PageKey; label: string }[] = [
  { key: "home", label: "홈" },
  { key: "about", label: "소개" },
  { key: "programs", label: "교육 프로그램" },
  { key: "instructors", label: "실무전문가" },
  { key: "workathon", label: "스마트워크톤" },
  { key: "videos", label: "영상·콘텐츠" },
  { key: "community", label: "커뮤니티" },
];

const PAGE_PUBLIC_HREF: Record<PageKey, string> = {
  home: "/",
  about: "/about",
  programs: "/programs",
  instructors: "/instructors",
  workathon: "/workathon",
  videos: "/videos",
  community: "/community",
};

type FormData = PageContentBase & {
  values?: ValueItem[];
  educationCards?: EducationCard[];
  specialtyCards?: SpecialtyCard[];
};

function cloneDeep<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export default function AdminPagesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<PageKey>("home");
  const [form, setForm] = useState<FormData>(cloneDeep(PAGE_DEFAULTS.home));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTab = useCallback(async (key: PageKey) => {
    setLoading(true);
    try {
      const raw = await getSingletonDoc<Record<string, unknown>>(
        COLLECTIONS.SETTINGS,
        PAGE_DOC_ID(key),
      );
      const defaults = PAGE_DEFAULTS[key];
      if (raw) {
        const merged = mergeWithDefaults(defaults, raw);
        setForm(merged);
      } else {
        setForm(cloneDeep(defaults) as FormData);
      }
    } catch {
      setForm(cloneDeep(PAGE_DEFAULTS[key]) as FormData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setSingletonDoc(COLLECTIONS.SETTINGS, PAGE_DOC_ID(activeTab), form);
      invalidatePageContentCache(activeTab);
      await loadTab(activeTab);
      toast(`저장되었습니다.\n${PAGE_CONTENT_SAVED_PUBLIC_HINT}`, "success");
    } catch {
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateHero = (field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      hero: { ...prev.hero, [field]: value },
    }));
  };

  const updateSection = (key: string, field: keyof PageSection, value: string) => {
    setForm((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [key]: { ...prev.sections[key], [field]: value },
      },
    }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">페이지 콘텐츠 관리</h1>
          <p className="text-gray-500 mt-1">
            각 페이지의 배너·섹션 제목·콘텐츠를 편집합니다. Firestore{" "}
            <code className="text-xs bg-gray-100 px-1 rounded">siteSettings/page_*</code> 문서에 저장됩니다.
          </p>
          <Link
            href={PAGE_PUBLIC_HREF[activeTab]}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1 mt-2 text-sm font-medium text-primary-600 hover:text-primary-700",
            )}
          >
            <ExternalLink size={14} aria-hidden />
            현재 탭 공개 페이지 열기
          </Link>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors",
            "bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.key
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hero Section — 홈은 사이트 설정 슬라이드로 관리 */}
          {activeTab === "home" ? (
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">홈 히어로는 슬라이드 캐러셀로 운영됩니다.</p>
                <p>
                  슬라이드 이미지·제목·CTA는{" "}
                  <Link href="/admin/settings?tab=hero" className="underline font-medium">
                    사이트 설정 &gt; 히어로 섹션
                  </Link>
                  에서 관리합니다.
                </p>
              </div>
            </div>
          ) : (
            <Card title="히어로 / 상단 배너">
              <div className="space-y-3">
                <Field label="배너 이미지 URL">
                  <input
                    value={form.hero.imageUrl}
                    onChange={(e) => updateHero("imageUrl", e.target.value)}
                    placeholder="예: /images/defaults/hero-main.jpg 또는 https://..."
                    className={INPUT_CLASS}
                  />
                  {form.hero.imageUrl && (
                    <img
                      src={form.hero.imageUrl}
                      alt="미리보기"
                      className="mt-2 h-32 rounded-lg object-cover"
                    />
                  )}
                </Field>
                <Field label="제목">
                  <textarea
                    value={form.hero.title}
                    onChange={(e) => updateHero("title", e.target.value)}
                    placeholder="페이지 대제목"
                    rows={2}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="부제">
                  <textarea
                    value={form.hero.subtitle}
                    onChange={(e) => updateHero("subtitle", e.target.value)}
                    placeholder="페이지 부제목"
                    rows={2}
                    className={INPUT_CLASS}
                  />
                </Field>
              </div>
            </Card>
          )}

          {/* Sections */}
          {Object.keys(form.sections).length > 0 && (
            <Card title="섹션 제목 / 설명">
              <div className="space-y-4">
                {Object.entries(form.sections).map(([key, sec]) => (
                  <div key={key} className="rounded-lg border border-gray-100 p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">{key}</p>
                    <div className="space-y-2">
                      <Field label="제목">
                        <input
                          value={sec.title}
                          onChange={(e) => updateSection(key, "title", e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </Field>
                      <HtmlEditor
                        label="설명"
                        value={sec.description ?? ""}
                        onChange={(v) => updateSection(key, "description", v)}
                        rows={3}
                        placeholder="섹션 설명 (HTML 가능)"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* About - VALUES */}
          {activeTab === "about" && (
            <ValuesEditor
              values={(form as AboutPageContent).values ?? []}
              onChange={(values) => setForm((p) => ({ ...p, values }))}
            />
          )}

          {/* Home - Education Cards */}
          {activeTab === "home" && (
            <>
              <EducationCardsEditor
                cards={(form as HomePageContent).educationCards ?? []}
                onChange={(educationCards) => setForm((p) => ({ ...p, educationCards }))}
              />
              <SpecialtyCardsEditor
                cards={(form as HomePageContent).specialtyCards ?? []}
                onChange={(specialtyCards) => setForm((p) => ({ ...p, specialtyCards }))}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 공통 UI ── */

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-base font-bold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

/* ── VALUES (소개 핵심 가치) 편집기 ── */

function ValuesEditor({
  values,
  onChange,
}: {
  values: ValueItem[];
  onChange: (v: ValueItem[]) => void;
}) {
  const add = () => onChange([...values, { icon: "Star", title: "", desc: "" }]);
  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx));
  const update = (idx: number, field: keyof ValueItem, val: string) =>
    onChange(values.map((v, i) => (i === idx ? { ...v, [field]: val } : v)));
  const move = (idx: number, dir: -1 | 1) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= values.length) return;
    const copy = [...values];
    [copy[idx], copy[ni]] = [copy[ni], copy[idx]];
    onChange(copy);
  };

  return (
    <Card title="핵심 가치 (VALUES)">
      <div className="space-y-3">
        {values.map((v, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-gray-100 p-3">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                value={v.icon}
                onChange={(e) => update(i, "icon", e.target.value)}
                placeholder="아이콘 (예: Target)"
                className={INPUT_CLASS}
              />
              <input
                value={v.title}
                onChange={(e) => update(i, "title", e.target.value)}
                placeholder="제목"
                className={INPUT_CLASS}
              />
              <input
                value={v.desc}
                onChange={(e) => update(i, "desc", e.target.value)}
                placeholder="설명"
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <button type="button" onClick={() => move(i, -1)} className="p-1 rounded hover:bg-gray-100" aria-label="위로">
                <ChevronUp size={14} />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="p-1 rounded hover:bg-gray-100" aria-label="아래로">
                <ChevronDown size={14} />
              </button>
              <button type="button" onClick={() => remove(i)} className="p-1 rounded hover:bg-red-50 text-red-500" aria-label="삭제">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <Plus size={14} /> 항목 추가
        </button>
      </div>
    </Card>
  );
}

/* ── Education 카드 편집기 ── */

function EducationCardsEditor({
  cards,
  onChange,
}: {
  cards: EducationCard[];
  onChange: (c: EducationCard[]) => void;
}) {
  const add = () =>
    onChange([...cards, { title: "", subtitle: "", description: "", imageUrl: "", span: "normal" }]);
  const remove = (idx: number) => onChange(cards.filter((_, i) => i !== idx));
  const update = (idx: number, field: keyof EducationCard, val: string) =>
    onChange(cards.map((c, i) => (i === idx ? { ...c, [field]: val } : c)));
  const move = (idx: number, dir: -1 | 1) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= cards.length) return;
    const copy = [...cards];
    [copy[idx], copy[ni]] = [copy[ni], copy[idx]];
    onChange(copy);
  };

  return (
    <Card title="실무전문가(홈) 카드">
      <div className="space-y-3">
        {cards.map((c, i) => (
          <div key={i} className="rounded-lg border border-gray-100 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 w-6">#{i + 1}</span>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input
                  value={c.title}
                  onChange={(e) => update(i, "title", e.target.value)}
                  placeholder="제목"
                  className={INPUT_CLASS}
                />
                <input
                  value={c.subtitle}
                  onChange={(e) => update(i, "subtitle", e.target.value)}
                  placeholder="부제 (영문)"
                  className={INPUT_CLASS}
                />
                <input
                  value={c.description}
                  onChange={(e) => update(i, "description", e.target.value)}
                  placeholder="설명"
                  className={INPUT_CLASS}
                />
                <select
                  value={c.span ?? "normal"}
                  onChange={(e) => update(i, "span", e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="normal">일반</option>
                  <option value="big">크게 (2x2)</option>
                </select>
              </div>
              <div className="flex gap-0.5">
                <button type="button" onClick={() => move(i, -1)} className="p-1 rounded hover:bg-gray-100" aria-label="위로"><ChevronUp size={14} /></button>
                <button type="button" onClick={() => move(i, 1)} className="p-1 rounded hover:bg-gray-100" aria-label="아래로"><ChevronDown size={14} /></button>
                <button type="button" onClick={() => remove(i)} className="p-1 rounded hover:bg-red-50 text-red-500" aria-label="삭제"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-8">
              <input
                value={c.imageUrl}
                onChange={(e) => update(i, "imageUrl", e.target.value)}
                placeholder="이미지 URL"
                className={cn(INPUT_CLASS, "flex-1")}
              />
              {c.imageUrl && (
                <img src={c.imageUrl} alt="" className="h-10 w-16 rounded object-cover shrink-0" />
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <Plus size={14} /> 카드 추가
        </button>
      </div>
    </Card>
  );
}

/* ── Specialty 카드 편집기 ── */

function SpecialtyCardsEditor({
  cards,
  onChange,
}: {
  cards: SpecialtyCard[];
  onChange: (c: SpecialtyCard[]) => void;
}) {
  const add = () =>
    onChange([...cards, { title: "", subtitle: "", description: "", imageUrl: "" }]);
  const remove = (idx: number) => onChange(cards.filter((_, i) => i !== idx));
  const update = (idx: number, field: keyof SpecialtyCard, val: string) =>
    onChange(cards.map((c, i) => (i === idx ? { ...c, [field]: val } : c)));
  const move = (idx: number, dir: -1 | 1) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= cards.length) return;
    const copy = [...cards];
    [copy[idx], copy[ni]] = [copy[ni], copy[idx]];
    onChange(copy);
  };

  return (
    <Card title="Specialty 카드">
      <div className="space-y-3">
        {cards.map((c, i) => (
          <div key={i} className="rounded-lg border border-gray-100 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 w-6">#{i + 1}</span>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  value={c.title}
                  onChange={(e) => update(i, "title", e.target.value)}
                  placeholder="제목"
                  className={INPUT_CLASS}
                />
                <input
                  value={c.subtitle}
                  onChange={(e) => update(i, "subtitle", e.target.value)}
                  placeholder="부제 (영문)"
                  className={INPUT_CLASS}
                />
                <input
                  value={c.description}
                  onChange={(e) => update(i, "description", e.target.value)}
                  placeholder="설명"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex gap-0.5">
                <button type="button" onClick={() => move(i, -1)} className="p-1 rounded hover:bg-gray-100" aria-label="위로"><ChevronUp size={14} /></button>
                <button type="button" onClick={() => move(i, 1)} className="p-1 rounded hover:bg-gray-100" aria-label="아래로"><ChevronDown size={14} /></button>
                <button type="button" onClick={() => remove(i)} className="p-1 rounded hover:bg-red-50 text-red-500" aria-label="삭제"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-8">
              <input
                value={c.imageUrl}
                onChange={(e) => update(i, "imageUrl", e.target.value)}
                placeholder="이미지 URL"
                className={cn(INPUT_CLASS, "flex-1")}
              />
              {c.imageUrl && (
                <img src={c.imageUrl} alt="" className="h-10 w-16 rounded object-cover shrink-0" />
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <Plus size={14} /> 카드 추가
        </button>
      </div>
    </Card>
  );
}

/* ── merge 유틸 ── */

function mergeWithDefaults(
  defaults: PageContentBase,
  raw: Record<string, unknown>,
): FormData {
  const hero = defaults.hero;
  const rawHero = (raw.hero ?? {}) as Partial<typeof hero>;
  const mergedHero = {
    imageUrl: rawHero.imageUrl?.toString() ?? hero.imageUrl,
    title: rawHero.title?.toString() ?? hero.title,
    subtitle: rawHero.subtitle?.toString() ?? hero.subtitle,
  };

  const sections = { ...defaults.sections };
  const rawSections = (raw.sections ?? {}) as Record<string, Record<string, string>>;
  for (const key of Object.keys(sections)) {
    if (rawSections[key]) {
      sections[key] = {
        title: rawSections[key].title ?? sections[key].title,
        description: rawSections[key].description ?? sections[key].description,
      };
    }
  }

  const result: FormData = { hero: mergedHero, sections };

  if ("values" in defaults) {
    result.values = Array.isArray(raw.values) && raw.values.length > 0
      ? (raw.values as ValueItem[])
      : [...(defaults as AboutPageContent).values];
  }
  if ("educationCards" in defaults) {
    result.educationCards = Array.isArray(raw.educationCards) && raw.educationCards.length > 0
      ? (raw.educationCards as EducationCard[])
      : [...(defaults as HomePageContent).educationCards];
  }
  if ("specialtyCards" in defaults) {
    result.specialtyCards = Array.isArray(raw.specialtyCards) && raw.specialtyCards.length > 0
      ? (raw.specialtyCards as SpecialtyCard[])
      : [...(defaults as HomePageContent).specialtyCards];
  }

  return result;
}
