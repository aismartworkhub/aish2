"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { COLLECTIONS, updateDocFields } from "@/lib/firestore";
import { COHORT_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const INPUT_CLASS = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-colors";

export default function ProfilePage() {
  const { user, profile, loading, isProfileComplete, refreshProfile, deleteAccount } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [interestInput, setInterestInput] = useState("");
  const [form, setForm] = useState({
    name: "",
    cohort: "",
    phone: "",
    companyName: "",
    companyProduct: "",
    companyWebsite: "",
    companySocial: "",
    bio: "",
    interests: [] as string[],
    socialLinksData: { linkedin: "", youtube: "", instagram: "", github: "" },
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
        bio: profile.bio ?? "",
        interests: profile.interests ?? [],
        socialLinksData: {
          linkedin: profile.socialLinks?.linkedin ?? "",
          youtube: profile.socialLinks?.youtube ?? "",
          instagram: profile.socialLinks?.instagram ?? "",
          github: profile.socialLinks?.github ?? "",
        },
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
      const { socialLinksData, ...rest } = form;
      await updateDocFields(COLLECTIONS.USERS, profile.uid, {
        ...rest,
        socialLinks: socialLinksData,
      });
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
        <div className="w-8 h-8 border-3 border-brand-blue border-t-transparent rounded-full animate-spin" />
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
                 
                <img src={profile.photoURL} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-gray flex items-center justify-center">
                  <span className="text-brand-blue font-bold">{(profile?.displayName || profile?.email || "?")[0]}</span>
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

          {/* 자기소개 */}
          <div className="space-y-4 pt-2">
            <p className="text-sm font-semibold text-gray-800">자기소개 (선택)</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">자기소개</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={3}
                placeholder="간단한 자기소개를 작성해 주세요"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none"
              />
            </div>
          </div>

          {/* 관심 분야 */}
          <div className="space-y-4 pt-2">
            <p className="text-sm font-semibold text-gray-800">관심 분야 (선택)</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">관심 분야</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.interests.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-gray text-brand-blue text-xs font-medium"
                  >
                    {tag}
                    <button
                      onClick={() => setForm({ ...form, interests: form.interests.filter((t) => t !== tag) })}
                      className="hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && interestInput.trim()) {
                      e.preventDefault();
                      setForm({ ...form, interests: [...form.interests, interestInput.trim()] });
                      setInterestInput("");
                    }
                  }}
                  placeholder="관심 분야 입력 후 Enter"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 소셜 링크 */}
          <div className="space-y-4 pt-2">
            <p className="text-sm font-semibold text-gray-800">소셜 링크 (선택)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { key: "linkedin", label: "LinkedIn" },
                { key: "youtube", label: "YouTube" },
                { key: "instagram", label: "Instagram" },
                { key: "github", label: "GitHub" },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type="url"
                    value={form.socialLinksData[key]}
                    onChange={(e) => setForm({ ...form, socialLinksData: { ...form.socialLinksData, [key]: e.target.value } })}
                    placeholder={`https://${key}.com/...`}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
                  />
                </div>
              ))}
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
              "bg-brand-blue text-white hover:bg-brand-dark disabled:opacity-50"
            )}
          >
            <Save size={16} />
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
      {/* 내 활동 */}
      <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">내 활동</h2>
        <div className="text-sm text-gray-500">
          <p>내 댓글과 북마크는 커뮤니티 활동 시 이곳에 표시됩니다.</p>
        </div>
      </div>

      {/* 회원 탈퇴 */}
      <div className="mt-8 bg-white rounded-2xl border border-red-200 shadow-sm">
        <div className="px-6 py-5 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">회원 탈퇴</h2>
            <p className="text-sm text-gray-500 mt-1">
              탈퇴 시 모든 회원 정보가 삭제되며 복구할 수 없습니다.
            </p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors shrink-0"
          >
            탈퇴하기
          </button>
        </div>
      </div>

      {/* 탈퇴 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={20} className="text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900">회원 탈퇴 확인</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              정말로 탈퇴하시겠습니까? 모든 회원 정보가 영구적으로 삭제됩니다.
              <br />확인을 위해 이메일 주소를 입력해 주세요.
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={profile?.email ?? "이메일 입력"}
              className={INPUT_CLASS}
            />
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm(""); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteAccount();
                    router.replace("/");
                  } catch (e) {
                    console.error(e);
                    alert("탈퇴 처리에 실패했습니다. 다시 로그인 후 시도해 주세요.");
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleteConfirm !== profile?.email || deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
