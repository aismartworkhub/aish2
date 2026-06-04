"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Save, RotateCcw, ChevronUp, ChevronDown, Eye, EyeOff, Loader2, ExternalLink, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COLLECTIONS, setSingletonDoc } from "@/lib/firestore";
import { useToast } from "@/components/ui/Toast";
import { loadSiteTheme } from "@/lib/site-settings-public";
import {
  TEMPLATE_SECTIONS,
  defaultLayoutFor,
  loadHomeLayout,
  loadHomeLayoutDoc,
  invalidateHomeLayoutCache,
} from "@/lib/home-layout-public";
import type { HomeSectionItem, HomeTemplateKey } from "@/types/home-layout";

const TEMPLATE_LABEL: Record<HomeTemplateKey, string> = {
  default: "기본형",
  community: "커뮤니티형",
  modern: "모던형",
};

export default function AdminHomeLayoutPage() {
  const { toast } = useToast();
  const [template, setTemplate] = useState<HomeTemplateKey>("default");
  const [sections, setSections] = useState<HomeSectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invalidateHomeLayoutCache();
    loadSiteTheme()
      .then(async (t) => {
        const tpl = t.homeTemplate as HomeTemplateKey;
        setTemplate(tpl);
        const layout = await loadHomeLayout(tpl);
        setSections(layout.sections);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const metaByKey = useMemo(
    () => Object.fromEntries(TEMPLATE_SECTIONS[template].map((m) => [m.key, m])),
    [template],
  );
  const visibleCount = useMemo(() => sections.filter((s) => s.visible).length, [sections]);

  const update = (idx: number, patch: Partial<HomeSectionItem>) =>
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const move = (idx: number, dir: -1 | 1) =>
    setSections((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      const normalized = sections.map((s, i) => ({ ...s, order: (i + 1) * 10 }));
      const current = await loadHomeLayoutDoc();
      const templates = { ...(current?.templates ?? {}), [template]: { sections: normalized } };
      await setSingletonDoc(COLLECTIONS.SETTINGS, "home-layout", { templates });
      invalidateHomeLayoutCache();
      setSections(normalized);
      toast("저장되었습니다. 공개 홈에서 새로고침하면 반영됩니다.", "success");
    } catch {
      toast("저장에 실패했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (confirm("기본 레이아웃(현재 디자인 순서)으로 되돌릴까요? 저장 전까지는 반영되지 않습니다.")) {
      setSections(defaultLayoutFor(template).sections);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">메인 페이지 편집</h1>
        <p className="text-gray-500 mt-1">
          현재 홈 템플릿: <strong>{TEMPLATE_LABEL[template]}</strong> — 섹션의 표시·순서·제목·여백을 관리합니다.
        </p>
      </div>

      <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-900">
        <div className="flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>
              <strong>표시</strong> 토글로 섹션을 켜고 끄고, <strong>↑↓</strong>로 순서를 바꿉니다. 일부 섹션은 제목·설명을 직접 편집할 수 있습니다.
            </p>
            <p className="text-blue-800/90">
              이미지(히어로·강사·카드 등)는 각 콘텐츠 화면에서 URL로 관리합니다. 홈 템플릿은 <strong>사이트 설정 → 홈 테마</strong>에서 변경하며, 템플릿마다 섹션 구성이 다릅니다.
            </p>
            <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-700 font-medium hover:underline">
              공개 홈 미리보기 <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          이 템플릿({TEMPLATE_LABEL[template]})은 아직 섹션 편집을 지원하지 않습니다. 사이트 설정에서 다른 홈 테마를 선택하세요.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">표시 중 {visibleCount} / {sections.length} 섹션</p>
            <div className="flex items-center gap-2">
              <button onClick={reset} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                <RotateCcw size={14} /> 기본값
              </button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50">
                <Save size={16} />{saving ? "저장중..." : "저장하기"}
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {sections.map((s, idx) => {
              const meta = metaByKey[s.key];
              return (
                <div
                  key={s.key}
                  className={cn(
                    "rounded-xl border bg-white p-4 transition-colors",
                    s.visible ? "border-gray-200" : "border-gray-100 bg-gray-50/60 opacity-70",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-mono text-gray-400">{idx + 1}</span>
                    <div className="flex flex-col">
                      <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                        <ChevronUp size={16} />
                      </button>
                      <button onClick={() => move(idx, 1)} disabled={idx === sections.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                        <ChevronDown size={16} />
                      </button>
                    </div>
                    <span className="flex-1 font-semibold text-gray-800">{meta?.label ?? s.key}</span>
                    <button
                      onClick={() => update(idx, { visible: !s.visible })}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                        s.visible ? "bg-primary-50 text-primary-700 border border-primary-200" : "bg-gray-100 text-gray-500 border border-gray-200",
                      )}
                    >
                      {s.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      {s.visible ? "표시" : "숨김"}
                    </button>
                  </div>

                  {meta?.supportsHeading && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 pl-9">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">제목</label>
                        <input
                          type="text"
                          value={s.title ?? ""}
                          onChange={(e) => update(idx, { title: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">설명</label>
                        <input
                          type="text"
                          value={s.description ?? ""}
                          onChange={(e) => update(idx, { description: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-4 pl-9">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">상단 여백(px)</label>
                      <input
                        type="number"
                        min={0}
                        value={s.paddingTop ?? ""}
                        placeholder="기본"
                        onChange={(e) => update(idx, { paddingTop: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                        className="w-24 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">하단 여백(px)</label>
                      <input
                        type="number"
                        min={0}
                        value={s.paddingBottom ?? ""}
                        placeholder="기본"
                        onChange={(e) => update(idx, { paddingBottom: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                        className="w-24 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50">
              <Save size={16} />{saving ? "저장중..." : "저장하기"}
            </button>
            <Link href="/admin" className="text-sm text-gray-500 hover:text-primary-600">대시보드로</Link>
          </div>
        </>
      )}
    </div>
  );
}
