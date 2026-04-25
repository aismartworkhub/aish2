"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, CheckCircle, AlertTriangle, GraduationCap, Camera, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import MyDashboard from "@/components/profile/MyDashboard";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS, updateDocFields } from "@/lib/firestore";
import { saveUserGeminiApiKey } from "@/lib/user-private-settings";
import { COHORT_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { analyzeBusinessCard } from "@/lib/business-card-analyzer";
import { callGasWebapp } from "@/lib/gas-client";
import {
  InstructorApplicationForm,
  checkInstructorApplicationStatus,
  type ApplicationStatus,
  type ApplicationCheckResult,
} from "@/components/instructor/InstructorApplicationForm";

const INPUT_CLASS = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-colors";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { user, profile, loading, isProfileComplete, refreshProfile, deleteAccount } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [showInstructorApply, setShowInstructorApply] = useState(false);
  const [instructorCheck, setInstructorCheck] = useState<ApplicationCheckResult>({ status: "none" });
  const [statusLoading, setStatusLoading] = useState(true);
  // 마이 대시보드 활성 탭. "profile"이면 기존 폼, 그 외는 MyDashboard 렌더.
  const [activeTopTab, setActiveTopTab] = useState<"profile" | "bookmarks" | "likes" | "myposts">("profile");

  const [interestInput, setInterestInput] = useState("");
  const [cardAnalyzing, setCardAnalyzing] = useState(false);
  const [cardConsent, setCardConsent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cohort: "",
    phone: "",
    companyName: "",
    companyProduct: "",
    companyWebsite: "",
    companySocial: "",
    companyRole: "",
    companyIntro: "",
    companyIndustry: "",
    bio: "",
    interests: [] as string[],
    socialLinksData: { linkedin: "", youtube: "", instagram: "", github: "" },
    geminiApiKey: "",
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) {
      setStatusLoading(false);
      return;
    }
    let cancelled = false;
    checkInstructorApplicationStatus(user.uid).then((result) => {
      if (!cancelled) {
        setInstructorCheck(result);
        setStatusLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [user]);

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
        companyRole: profile.companyRole ?? "",
        companyIntro: profile.companyIntro ?? "",
        companyIndustry: profile.companyIndustry ?? "",
        bio: profile.bio ?? "",
        interests: profile.interests ?? [],
        socialLinksData: {
          linkedin: profile.socialLinks?.linkedin ?? "",
          youtube: profile.socialLinks?.youtube ?? "",
          instagram: profile.socialLinks?.instagram ?? "",
          github: profile.socialLinks?.github ?? "",
        },
        geminiApiKey: profile.geminiApiKey ?? "",
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
      const { socialLinksData, geminiApiKey, ...rest } = form;
      await saveUserGeminiApiKey(profile.uid, geminiApiKey ?? "");
      await updateDocFields(COLLECTIONS.USERS, profile.uid, {
        ...rest,
        socialLinks: socialLinksData,
      });
      await updateDoc(doc(db, COLLECTIONS.USERS, profile.uid), {
        geminiApiKey: deleteField(),
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

  const handleBusinessCard = async (file: File) => {
    if (!form.geminiApiKey) {
      alert("먼저 Gemini API 키를 입력하고 저장해주세요.");
      return;
    }
    if (!cardConsent) {
      alert("개인정보 처리 동의가 필요합니다.");
      return;
    }
    setCardAnalyzing(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await analyzeBusinessCard(base64, form.geminiApiKey);
      setForm((prev) => ({
        ...prev,
        name: result.name || prev.name,
        companyName: result.companyName || prev.companyName,
        companyRole: result.companyRole || prev.companyRole,
        companyProduct: result.companyProduct || prev.companyProduct,
        companyWebsite: result.companyWebsite || prev.companyWebsite,
        phone: result.phone || prev.phone,
        companyIndustry: result.companyIndustry || prev.companyIndustry,
      }));
      callGasWebapp("business-card", {
        imageBase64: base64,
        fileName: `card_${user.uid}_${Date.now()}.jpg`,
        userEmail: user.email ?? "",
        userName: form.name || user.displayName || "",
      }).catch(() => {});
      alert("명함 분석이 완료되었습니다. 결과를 확인 후 저장해주세요.");
    } catch (err) {
      alert("명함 분석에 실패했습니다. API 키를 확인하거나 다시 시도해주세요.");
      console.error(err);
    } finally {
      setCardAnalyzing(false);
    }
  };

  if (!mounted || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const TOP_TABS: { key: typeof activeTopTab; label: string }[] = [
    { key: "profile", label: "프로필" },
    { key: "bookmarks", label: "내 컬렉션" },
    { key: "likes", label: "좋아요" },
    { key: "myposts", label: "내 글" },
  ];

  return (
    <div className={cn("mx-auto px-4 py-12", activeTopTab === "profile" ? "max-w-2xl" : "max-w-5xl")}>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        뒤로가기
      </button>

      {/* 마이 대시보드 상단 탭 */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
        {TOP_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTopTab(t.key)}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              activeTopTab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTopTab !== "profile" ? (
        <MyDashboard defaultTab={activeTopTab} />
      ) : (
      <>
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

            {/* 명함 AI 자동 입력 */}
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Camera size={16} className="text-brand-blue" />
                명함으로 자동 입력
              </div>
              <p className="text-xs text-gray-500">명함 사진을 업로드하면 AI가 정보를 자동으로 인식합니다.</p>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cardConsent}
                  onChange={(e) => setCardConsent(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-brand-blue"
                />
                명함 정보가 프로필에 반영되고 관리자에게 안전하게 보관됩니다.
              </label>
              <div className="flex items-center gap-2">
                <label className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors",
                  cardConsent && form.geminiApiKey
                    ? "bg-brand-blue text-white hover:bg-brand-dark"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}>
                  <Camera size={14} />
                  {cardAnalyzing ? "분석 중..." : "명함 업로드"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={!cardConsent || !form.geminiApiKey || cardAnalyzing}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBusinessCard(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {cardAnalyzing && <Loader2 size={16} className="animate-spin text-brand-blue" />}
              </div>
              {!form.geminiApiKey && (
                <p className="text-xs text-amber-600">하단의 &quot;AI 기능 설정&quot;에서 Gemini API 키를 먼저 입력해주세요.</p>
              )}
            </div>

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
                placeholder="Instagram, LinkedIn 등 SNS·프로필 URL"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">직책</label>
              <input
                value={form.companyRole}
                onChange={(e) => setForm({ ...form, companyRole: e.target.value })}
                placeholder="예: 대표이사, 팀장, 연구원"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">업종</label>
              <select
                value={form.companyIndustry}
                onChange={(e) => setForm({ ...form, companyIndustry: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="">선택하세요</option>
                <option value="IT">IT/소프트웨어</option>
                <option value="AI">AI/머신러닝</option>
                <option value="EDU">교육</option>
                <option value="FINANCE">금융</option>
                <option value="MANUFACTURING">제조</option>
                <option value="HEALTHCARE">의료/헬스케어</option>
                <option value="GOVERNMENT">정부/공공기관</option>
                <option value="STARTUP">스타트업</option>
                <option value="CONSULTING">컨설팅</option>
                <option value="MEDIA">미디어/콘텐츠</option>
                <option value="OTHER">기타</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">회사 소개</label>
              <textarea
                value={form.companyIntro}
                onChange={(e) => setForm({ ...form, companyIntro: e.target.value })}
                placeholder="회사(기관)에 대한 간단한 소개를 작성해주세요."
                rows={3}
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

          {/* AI 기능 설정 */}
          <div className="space-y-4 pt-2">
            <p className="text-sm font-semibold text-gray-800">AI 기능 설정 (선택)</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API 키</label>
              <p className="text-xs text-gray-500 mb-2">
                Google Gemini API 키를 입력하면 명함 AI 분석, AI 상담 등 개인화된 기능을 사용할 수 있습니다.
              </p>
              <input
                type="password"
                value={form.geminiApiKey}
                onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })}
                placeholder="AI로 시작하는 API 키"
                className={INPUT_CLASS}
                autoComplete="off"
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
              "bg-brand-blue text-white hover:bg-brand-dark disabled:opacity-50"
            )}
          >
            <Save size={16} />
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
      {/* 강사 신청 */}
      <InstructorApplySection
        status={instructorCheck.status}
        rejectionReason={instructorCheck.rejectionReason}
        statusLoading={statusLoading}
        showForm={showInstructorApply}
        onShowForm={() => setShowInstructorApply(true)}
        onBack={() => setShowInstructorApply(false)}
        onSubmitted={() => {
          setInstructorCheck({ status: "pending" });
          setShowInstructorApply(false);
        }}
        onReapply={() => {
          setInstructorCheck({ status: "none" });
          setShowInstructorApply(true);
        }}
      />

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
      </>
      )}
    </div>
  );
}

/* ── 강사 신청 섹션 ── */
function InstructorApplySection({
  status,
  rejectionReason,
  statusLoading,
  showForm,
  onShowForm,
  onBack,
  onSubmitted,
  onReapply,
}: {
  status: ApplicationStatus;
  rejectionReason?: string;
  statusLoading: boolean;
  showForm: boolean;
  onShowForm: () => void;
  onBack: () => void;
  onSubmitted: () => void;
  onReapply: () => void;
}) {
  if (statusLoading) {
    return (
      <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <span className="text-sm text-gray-500">강사 신청 상태 확인 중...</span>
        </div>
      </div>
    );
  }

  if (showForm && (status === "none" || status === "rejected")) {
    return (
      <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <InstructorApplicationForm
          onBack={onBack}
          onSubmitted={onSubmitted}
          variant="embed"
        />
      </div>
    );
  }

  const statusConfig: Record<
    Exclude<ApplicationStatus, "none">,
    { label: string; color: string; bg: string; dot: string; desc: string }
  > = {
    pending: {
      label: "심사중",
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-200",
      dot: "bg-amber-400",
      desc: "관리자 승인을 기다리고 있습니다.",
    },
    approved: {
      label: "승인 완료",
      color: "text-green-600",
      bg: "bg-green-50 border-green-200",
      dot: "bg-green-400",
      desc: "강사 페이지에서 프로필을 확인하세요.",
    },
    rejected: {
      label: "반려",
      color: "text-red-600",
      bg: "bg-red-50 border-red-200",
      dot: "bg-red-400",
      desc: "신청이 반려되었습니다. 수정 후 다시 신청할 수 있습니다.",
    },
  };

  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="px-6 py-5 flex items-start gap-3">
        <GraduationCap size={20} className="text-brand-blue shrink-0 mt-0.5" />
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">강사 신청</h2>
          <p className="text-sm text-gray-500 mt-1">
            {status === "none"
              ? "전문 분야를 공유하고 AISH 강사로 활동하세요."
              : statusConfig[status].desc}
          </p>
          {status !== "none" && (
            <div className={cn("inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-medium border", statusConfig[status].bg)}>
              <span className={cn("w-2 h-2 rounded-full", statusConfig[status].dot)} />
              <span className={statusConfig[status].color}>{statusConfig[status].label}</span>
            </div>
          )}
          {status === "rejected" && rejectionReason && (
            <p className="text-sm text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-2">
              반려 사유: {rejectionReason}
            </p>
          )}
        </div>
        {status === "none" && (
          <button
            onClick={onShowForm}
            className="px-4 py-2 text-sm font-medium text-brand-blue border border-brand-blue/30 rounded-lg hover:bg-brand-blue/5 transition-colors shrink-0"
          >
            신청하기
          </button>
        )}
        {status === "rejected" && (
          <button
            onClick={onReapply}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-blue rounded-lg hover:bg-brand-blue/90 transition-colors shrink-0"
          >
            다시 신청하기
          </button>
        )}
      </div>
    </div>
  );
}
