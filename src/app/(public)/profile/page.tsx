"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { COLLECTIONS, updateDocFields } from "@/lib/firestore";
import { COHORT_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const INPUT_CLASS = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-colors";

export default function ProfilePage() {
  const { user, profile, loading, isProfileComplete, refreshProfile } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    name: "",
    cohort: "",
    phone: "",
    companyName: "",
    companyProduct: "",
    companyWebsite: "",
    companySocial: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? "",
        cohort: profile.cohort ?? "",
        phone: profile.phone ?? "",
        companyName: profile.companyName ?? "",
        companyProduct: profile.companyProduct ?? "",
        companyWebsite: profile.companyWebsite ?? "",
        companySocial: profile.companySocial ?? "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    if (!form.name.trim() || !form.cohort.trim() || !form.phone.trim()) {
      alert("이름, 기수, 휴대폰번호는 필수 입력 항목입니다.");
      return;
    }
    setSaving(true);
    try {
      await updateDocFields(COLLECTIONS.USERS, profile.uid, form);
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        뒤로가기
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900">프로필 설정</h1>
          <p className="text-sm text-gray-500 mt-1">
            회원 정보를 입력하여 프로필을 완성해 주세요.
          </p>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* 계정 정보 (읽기 전용) */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase">계정 정보</p>
            <div className="flex items-center gap-3">
              {profile?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoURL} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-700 font-bold">{(profile?.displayName || profile?.email || "?")[0]}</span>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">{profile?.displayName || "-"}</p>
                <p className="text-xs text-gray-500">{profile?.email}</p>
              </div>
            </div>
          </div>

          {/* 필수 정보 */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-800">필수 정보</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="실명을 입력해 주세요"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                기수 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.cohort}
                onChange={(e) => setForm({ ...form, cohort: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="">기수를 선택해 주세요</option>
                {COHORT_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                휴대폰번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="010-0000-0000"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* 회사 정보 */}
          <div className="space-y-4 pt-2">
            <p className="text-sm font-semibold text-gray-800">회사 정보 (선택)</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">회사명</label>
              <input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="회사명"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주요 제품/서비스</label>
              <input
                value={form.companyProduct}
                onChange={(e) => setForm({ ...form, companyProduct: e.target.value })}
                placeholder="회사의 주요 제품 또는 서비스"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">회사 웹사이트</label>
              <input
                type="url"
                value={form.companyWebsite}
                onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })}
                placeholder="https://example.com"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">소셜 링크</label>
              <input
                type="url"
                value={form.companySocial}
                onChange={(e) => setForm({ ...form, companySocial: e.target.value })}
                placeholder="Instagram, LinkedIn 등 소셜 미디어 URL"
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div>
            {isProfileComplete && (
              <span className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle size={14} />
                프로필 완성됨
              </span>
            )}
            {saved && (
              <span className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle size={14} />
                저장되었습니다
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
              "bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            )}
          >
            <Save size={16} />
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
