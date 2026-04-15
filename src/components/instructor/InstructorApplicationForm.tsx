"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft, Linkedin, Youtube, Instagram,
  CheckSquare, Square, Plus, Trash2, Paperclip, BookOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { COLLECTIONS, createDoc, getFilteredCollection, updateDocFields } from "@/lib/firestore";
import { cn } from "@/lib/utils";
import { useRunmoaContents } from "@/hooks/useRunmoaContents";
import { SimpleHtmlEditor } from "@/components/ui/SimpleHtmlEditor";
import type { RunmoaContent } from "@/types/runmoa";

export type ApplicationStatus = "none" | "pending" | "approved" | "rejected";

interface SelectedCourse {
  contentId: number;
  title: string;
  url: string;
}

interface CourseProposal {
  title: string;
  summary: string;
  descriptionHtml: string;
  attachments: { name: string; url: string }[];
}

const EMPTY_PROPOSAL: CourseProposal = {
  title: "",
  summary: "",
  descriptionHtml: "",
  attachments: [],
};

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
  rejectionReason?: string;
}

export interface ApplicationCheckResult {
  status: ApplicationStatus;
  docId?: string;
  rejectionReason?: string;
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
  const [existingDocId, setExistingDocId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  /* ── 기본 정보 ── */
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

  /* ── 수업 가능한 강의 선택 ── */
  const { data: runmoaCourses, loading: coursesLoading } = useRunmoaContents({ limit: 100 });
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
  const [courseSearch, setCourseSearch] = useState("");

  const filteredCourses = useMemo(() => {
    if (!courseSearch.trim()) return runmoaCourses;
    const q = courseSearch.toLowerCase();
    return runmoaCourses.filter((c) => c.title.toLowerCase().includes(q));
  }, [runmoaCourses, courseSearch]);

  const toggleCourse = (course: RunmoaContent) => {
    setSelectedCourses((prev) => {
      const exists = prev.some((c) => c.contentId === course.content_id);
      if (exists) return prev.filter((c) => c.contentId !== course.content_id);
      return [
        ...prev,
        {
          contentId: course.content_id,
          title: course.title,
          url: `https://aish.runmoa.com/classes/${course.content_id}`,
        },
      ];
    });
  };

  const isCourseSelected = (contentId: number) =>
    selectedCourses.some((c) => c.contentId === contentId);

  /* ── 강의 제안 ── */
  const [proposals, setProposals] = useState<CourseProposal[]>([]);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [currentProposal, setCurrentProposal] = useState<CourseProposal>(EMPTY_PROPOSAL);
  const [attachName, setAttachName] = useState("");
  const [attachUrl, setAttachUrl] = useState("");

  const addAttachment = () => {
    const name = attachName.trim();
    const url = attachUrl.trim();
    if (!name || !url) {
      toast("첨부 파일명과 URL을 모두 입력하세요.", "error");
      return;
    }
    setCurrentProposal((p) => ({
      ...p,
      attachments: [...p.attachments, { name, url }],
    }));
    setAttachName("");
    setAttachUrl("");
  };

  const removeAttachment = (idx: number) => {
    setCurrentProposal((p) => ({
      ...p,
      attachments: p.attachments.filter((_, i) => i !== idx),
    }));
  };

  const saveProposal = () => {
    if (!currentProposal.title.trim()) {
      toast("강의 제목을 입력하세요.", "error");
      return;
    }
    setProposals((prev) => [...prev, currentProposal]);
    setCurrentProposal(EMPTY_PROPOSAL);
    setShowProposalForm(false);
    toast("강의가 추가되었습니다.", "success");
  };

  const removeProposal = (idx: number) => {
    setProposals((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ── 기존 신청 확인 ── */
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
          const doc = existing[0];
          const status = doc.status as ApplicationStatus;
          setExistingStatus(status || "pending");
          if (status === "rejected") setExistingDocId(doc.id);
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

  /* ── 제출 ── */
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

      const programs = selectedCourses.map((c) => ({
        title: c.title,
        url: c.url,
      }));

      const instructorData = {
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
        programs,
        pastPrograms: [],
        isActive: false,
        status: "pending",
        applicantUid: user.uid,
        displayOrder: 999,
      };

      let instructorDocId: string;
      if (existingDocId) {
        await updateDocFields(COLLECTIONS.INSTRUCTORS, existingDocId, {
          ...instructorData,
          rejectionReason: "",
        });
        instructorDocId = existingDocId;
      } else {
        instructorDocId = await createDoc(COLLECTIONS.INSTRUCTORS, instructorData);
      }

      for (const proposal of proposals) {
        await createDoc(COLLECTIONS.COURSE_PROPOSALS, {
          instructorDocId,
          applicantUid: user.uid,
          applicantName: form.name.trim(),
          title: proposal.title,
          summary: proposal.summary,
          descriptionHtml: proposal.descriptionHtml,
          attachments: proposal.attachments,
          status: "pending",
        });
      }

      toast("강사 신청이 완료되었습니다. 관리자 승인 후 프로필이 공개됩니다.", "success");
      setExistingStatus("pending");
      onSubmitted();
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.error("강사 신청 실패:", err);
      toast("신청에 실패했습니다. 다시 시도해주세요.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── 로딩/상태 카드 ── */
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

        <div className="space-y-8">
          {/* ====== 1. 기본 정보 ====== */}
          <SectionHeading number={1} title="기본 정보" />

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
          </div>

          {/* ====== 2. 수업 가능한 강의 선택 ====== */}
          <SectionHeading number={2} title="수업 가능한 강의 선택" />
          <p className="text-xs text-gray-500 -mt-4">
            현재 등록된 강의 중 수업이 가능한 항목을 선택하세요.
          </p>

          <div className="space-y-3">
            <input
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              placeholder="강의명 검색..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 placeholder:text-gray-400"
            />

            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-100">
              {coursesLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                  강의 목록 로딩 중...
                </div>
              ) : filteredCourses.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                  {courseSearch ? "검색 결과 없음" : "등록된 강의 없음"}
                </div>
              ) : (
                filteredCourses.map((course) => {
                  const selected = isCourseSelected(course.content_id);
                  return (
                    <button
                      key={course.content_id}
                      type="button"
                      onClick={() => toggleCourse(course)}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-3 text-left transition-colors",
                        selected ? "bg-blue-50" : "hover:bg-gray-50",
                      )}
                    >
                      {selected ? (
                        <CheckSquare size={18} className="text-blue-600 shrink-0" />
                      ) : (
                        <Square size={18} className="text-gray-300 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "text-sm truncate",
                          selected ? "font-medium text-blue-900" : "text-gray-700",
                        )}>
                          {course.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {course.content_type === "vod" ? "VOD" :
                           course.content_type === "live" ? "라이브" :
                           course.content_type === "offline" ? "오프라인" : "디지털 콘텐츠"}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedCourses.length > 0 && (
              <p className="text-xs text-blue-600 font-medium">
                {selectedCourses.length}개 강의 선택됨
              </p>
            )}
          </div>

          {/* ====== 3. 강의 제안 (새 강의 생성) ====== */}
          <SectionHeading number={3} title="강의 제안" />
          <p className="text-xs text-gray-500 -mt-4">
            새로운 강의를 직접 제안할 수 있습니다. 관리자 승인 후 등록됩니다.
          </p>

          {proposals.length > 0 && (
            <div className="space-y-2">
              {proposals.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <BookOpen size={16} className="text-green-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-green-900 truncate">{p.title}</p>
                    {p.summary && (
                      <p className="text-xs text-green-700 mt-0.5 truncate">{p.summary}</p>
                    )}
                    {p.attachments.length > 0 && (
                      <p className="text-xs text-green-600 mt-0.5">
                        첨부 {p.attachments.length}건
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProposal(idx)}
                    className="text-green-400 hover:text-red-500 transition-colors p-1"
                    aria-label="제안 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showProposalForm ? (
            <div className="border border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50/50">
              <FormField
                label="강의 제목 *"
                value={currentProposal.title}
                onChange={(v) => setCurrentProposal((p) => ({ ...p, title: v }))}
                placeholder="예) 실전 AI 활용 마스터 클래스"
              />
              <FormField
                label="한 줄 요약"
                value={currentProposal.summary}
                onChange={(v) => setCurrentProposal((p) => ({ ...p, summary: v }))}
                placeholder="예) 비전공자를 위한 AI 실무 활용 집중 과정"
              />

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  강의 상세 설명 (HTML)
                </label>
                <SimpleHtmlEditor
                  value={currentProposal.descriptionHtml}
                  onChange={(v) => setCurrentProposal((p) => ({ ...p, descriptionHtml: v }))}
                  placeholder="강의 커리큘럼, 대상, 기대 효과 등을 작성하세요..."
                  rows={8}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  첨부 파일 (외부 URL)
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Google Drive, Dropbox 등 공유 링크를 입력하세요.
                </p>
                <div className="flex gap-2">
                  <input
                    value={attachName}
                    onChange={(e) => setAttachName(e.target.value)}
                    placeholder="파일명 (예: 강의계획서)"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                  <input
                    value={attachUrl}
                    onChange={(e) => setAttachUrl(e.target.value)}
                    placeholder="URL"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAttachment())}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                  <button
                    type="button"
                    onClick={addAttachment}
                    className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                    aria-label="첨부 추가"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {currentProposal.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {currentProposal.attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm bg-white px-3 py-1.5 rounded-md border border-gray-100">
                        <Paperclip size={12} className="text-gray-400" />
                        <span className="font-medium text-gray-700">{att.name}</span>
                        <span className="text-xs text-gray-400 truncate max-w-[200px]">{att.url}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="ml-auto text-gray-400 hover:text-red-500"
                          aria-label="첨부 삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowProposalForm(false); setCurrentProposal(EMPTY_PROPOSAL); }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveProposal}
                  className="flex-1 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  강의 추가
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowProposalForm(true)}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3",
                "border-2 border-dashed border-gray-200 rounded-xl",
                "text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors",
              )}
            >
              <Plus size={16} />
              새 강의 제안하기
            </button>
          )}

          {/* ====== 제출 버튼 ====== */}
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

/* ── 섹션 제목 ── */
function SectionHeading({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold">
        {number}
      </span>
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
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
): Promise<ApplicationCheckResult> {
  try {
    const existing = await getFilteredCollection<ExistingApplication>(
      COLLECTIONS.INSTRUCTORS,
      "applicantUid",
      uid,
    );
    if (existing.length > 0) {
      const doc = existing[0];
      return {
        status: (doc.status as ApplicationStatus) || "pending",
        docId: doc.id,
        rejectionReason: doc.rejectionReason,
      };
    }
  } catch {
    // ignore
  }
  return { status: "none" };
}
