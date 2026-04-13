"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Linkedin, Youtube, Instagram } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { COLLECTIONS, createDoc, getFilteredCollection } from "@/lib/firestore";
import { cn } from "@/lib/utils";

export type ApplicationStatus = "none" | "pending" | "approved" | "rejected";

interface InstructorApplicationFormProps {
  onBack: () => void;
  onSubmitted: () => void;
  /** "embed" = profile 페이지 내장, "standalone" = /instructors 단독 페이지 */
  variant?: "standalone" | "embed";
}

interface ExistingApplication {
  id: string;
  status?: string;
  applicantUid?: string;
}

export function InstructorApplicationForm({
  onBack,
  onSubmitted,
  variant = "standalone",
}: InstructorApplicationFormProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [existingStatus, setExistingStatus] = useState<ApplicationStatus>("none");
  const [checking, setChecking] = useState(true);

  const [form, setForm] = useState({
    name: "",
    title: "",
    organization: "",
    bio: "",
    specialtiesText: "",
    educationText: "",
    imageUrl: "",
    contactEmail: "",
    linkedin: "",
    youtube: "",
    instagram: "",
    certificationsText: "",
  });

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const existing = await getFilteredCollection<ExistingApplication>(
          COLLECTIONS.INSTRUCTORS,
          "applicantUid",
          user.uid,
        );
        if (!cancelled && existing.length > 0) {
          const status = existing[0].status as ApplicationStatus;
          setExistingStatus(status || "pending");
        }
      } catch {
        // 조회 실패 시 신청 가능하도록 유지
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (profile || user) {
      setForm((prev) => ({
        ...prev,
        name: prev.name || profile?.name || user?.displayName || "",
        imageUrl: prev.imageUrl || user?.photoURL || "",
        contactEmail: prev.contactEmail || user?.email || "",
        organization: prev.organization || profile?.companyName || "",
        bio: prev.bio || profile?.bio || "",
        linkedin: prev.linkedin || profile?.socialLinks?.linkedin || "",
        youtube: prev.youtube || profile?.socialLinks?.youtube || "",
        instagram: prev.instagram || profile?.socialLinks?.instagram || "",
      }));
    }
  }, [profile, user]);

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.title.trim()) {
      toast("이름과 직함은 필수 항목입니다.", "error");
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const specialties = form.specialtiesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const education = form.educationText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ degree: line, institution: "", year: "" }));

      const certifications = form.certificationsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      await createDoc(COLLECTIONS.INSTRUCTORS, {
        name: form.name.trim(),
        title: form.title.trim(),
        organization: form.organization.trim(),
        bio: form.bio.trim(),
        specialties,
        education,
        imageUrl: form.imageUrl.trim(),
        contactEmail: form.contactEmail.trim(),
        socialLinks: {
          linkedin: form.linkedin.trim(),
          youtube: form.youtube.trim(),
          instagram: form.instagram.trim(),
          github: "",
          personalSite: "",
        },
        certifications,
        programs: [],
        pastPrograms: [],
        isActive: false,
        status: "pending",
        applicantUid: user.uid,
        displayOrder: 999,
      });

      toast("강사 신청이 완료되었습니다. 관리자 승인 후 프로필이 공개됩니다.", "success");
      setExistingStatus("pending");
      onSubmitted();
    } catch {
      toast("신청에 실패했습니다. 다시 시도해주세요.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (existingStatus === "pending") {
    return <StatusCard status="pending" onBack={onBack} variant={variant} />;
  }
  if (existingStatus === "approved") {
    return <StatusCard status="approved" onBack={onBack} variant={variant} />;
  }
  if (existingStatus === "rejected") {
    return <StatusCard status="rejected" onBack={onBack} variant={variant} />;
  }

  const isEmbed = variant === "embed";

  return (
    <div className={cn(isEmbed ? "" : "min-h-screen bg-white")}>
      <div className={cn(isEmbed ? "" : "max-w-2xl mx-auto px-4 py-10 md:py-16")}>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          {isEmbed ? "프로필로 돌아가기" : "전체 강사소개"}
        </button>

        <h1 className={cn(
          "font-bold text-gray-900 tracking-tight mb-2",
          isEmbed ? "text-xl" : "text-2xl md:text-3xl"
        )}>
          강사 신청
        </h1>
        <p className="text-sm text-gray-500 mb-10">
          아래 정보를 입력하고 신청하시면, 관리자 승인 후 강사 프로필이 공개됩니다.
        </p>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="이름 *"
              value={form.name}
              onChange={(v) => set("name", v)}
              placeholder="홍길동"
            />
            <FormField
              label="직함 *"
              value={form.title}
              onChange={(v) => set("title", v)}
              placeholder="AI 교육 전문가"
            />
          </div>

          <FormField
            label="소속"
            value={form.organization}
            onChange={(v) => set("organization", v)}
            placeholder="소속 기관 또는 회사"
          />

          <FormField
            label="한 줄 소개"
            value={form.bio}
            onChange={(v) => set("bio", v)}
            placeholder="자신을 간단히 소개해 주세요."
            multiline
            rows={3}
          />

          <FormField
            label="주요 경력"
            value={form.specialtiesText}
            onChange={(v) => set("specialtiesText", v)}
            placeholder={"한 줄에 하나씩 입력해 주세요.\n예) AI 교육 10년\n예) 삼성전자 데이터분석팀 근무"}
            multiline
            rows={4}
          />

          <FormField
            label="학력"
            value={form.educationText}
            onChange={(v) => set("educationText", v)}
            placeholder={"한 줄에 하나씩 입력해 주세요.\n예) 서울대학교 컴퓨터공학 석사"}
            multiline
            rows={3}
          />

          <FormField
            label="자격증"
            value={form.certificationsText}
            onChange={(v) => set("certificationsText", v)}
            placeholder={"한 줄에 하나씩 입력해 주세요.\n예) 정보처리기사\n예) AWS Solutions Architect"}
            multiline
            rows={3}
          />

          <FormField
            label="프로필 이미지 URL"
            value={form.imageUrl}
            onChange={(v) => set("imageUrl", v)}
            placeholder="Google Drive 공유 링크 또는 이미지 URL"
          />

          <FormField
            label="연락처 이메일"
            value={form.contactEmail}
            onChange={(v) => set("contactEmail", v)}
            placeholder="example@email.com"
          />

          <div>
            <label className="text-sm font-medium text-gray-700 mb-3 block">
              SNS (선택)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Linkedin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={form.linkedin}
                  onChange={(e) => set("linkedin", e.target.value)}
                  placeholder="LinkedIn URL"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
              <div className="relative">
                <Youtube size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={form.youtube}
                  onChange={(e) => set("youtube", e.target.value)}
                  placeholder="YouTube URL"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
              <div className="relative">
                <Instagram size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={form.instagram}
                  onChange={(e) => set("instagram", e.target.value)}
                  placeholder="Instagram URL"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onBack}
              className="flex-1 py-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={cn(
                "flex-1 py-3 rounded-lg bg-gray-900 text-white text-sm font-semibold",
                "hover:bg-gray-800 disabled:opacity-50 transition-colors",
              )}
            >
              {submitting ? "신청 중..." : "강사 신청하기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 상태 안내 카드 ── */
function StatusCard({
  status,
  onBack,
  variant,
}: {
  status: "pending" | "approved" | "rejected";
  onBack: () => void;
  variant: "standalone" | "embed";
}) {
  const isEmbed = variant === "embed";
  const config = {
    pending: {
      title: "심사중",
      desc: "강사 신청이 접수되었습니다. 관리자 승인을 기다리고 있습니다.",
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-200",
      dot: "bg-amber-400",
    },
    approved: {
      title: "승인 완료",
      desc: "강사 신청이 승인되었습니다. 강사 페이지에서 프로필을 확인하세요.",
      color: "text-green-600",
      bg: "bg-green-50 border-green-200",
      dot: "bg-green-400",
    },
    rejected: {
      title: "반려",
      desc: "강사 신청이 반려되었습니다. 관리자에게 문의하시거나 내용을 수정하여 다시 신청해 주세요.",
      color: "text-red-600",
      bg: "bg-red-50 border-red-200",
      dot: "bg-red-400",
    },
  }[status];

  return (
    <div className={cn(isEmbed ? "" : "min-h-screen bg-white")}>
      <div className={cn(isEmbed ? "" : "max-w-2xl mx-auto px-4 py-10 md:py-16")}>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          {isEmbed ? "프로필로 돌아가기" : "전체 강사소개"}
        </button>

        <div className={cn("rounded-xl border p-6", config.bg)}>
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("w-2.5 h-2.5 rounded-full", config.dot)} />
            <h2 className={cn("text-lg font-bold", config.color)}>
              {config.title}
            </h2>
          </div>
          <p className="text-sm text-gray-600">{config.desc}</p>
        </div>
      </div>
    </div>
  );
}

/* ── FormField ── */
function FormField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const cls = cn(
    "w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm",
    "focus:outline-none focus:ring-2 focus:ring-gray-200 placeholder:text-gray-400",
  );
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-1.5 block">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows || 3}
          className={cn(cls, "resize-none")}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}

/* ── 신청 상태 확인 유틸 (외부에서도 사용) ── */
export async function checkInstructorApplicationStatus(
  uid: string,
): Promise<ApplicationStatus> {
  try {
    const existing = await getFilteredCollection<ExistingApplication>(
      COLLECTIONS.INSTRUCTORS,
      "applicantUid",
      uid,
    );
    if (existing.length > 0) {
      return (existing[0].status as ApplicationStatus) || "pending";
    }
  } catch {
    // ignore
  }
  return "none";
}
