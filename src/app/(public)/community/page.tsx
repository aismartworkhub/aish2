"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Bell, FolderOpen, Award, HelpCircle, Handshake, Images, FileText,
  ChevronDown, ChevronUp, ExternalLink, Mail, Phone, Building,
  Star, Download, Eye, Pin, Search,
} from "lucide-react";
import { cn, toDateString } from "@/lib/utils";
import { DEMO_FAQ } from "@/lib/demo-data";
import { getCollection, createDoc, COLLECTIONS } from "@/lib/firestore";
import { useLoginGuard } from "@/hooks/useLoginGuard";
import LoginModal from "@/components/public/LoginModal";

type TabKey = "notice" | "resource" | "certificate" | "faq" | "inquiry" | "gallery" | string;

const FIXED_TABS: { key: TabKey; label: string; icon: React.ElementType; color: string }[] = [
  { key: "notice", label: "공지사항", icon: Bell, color: "text-blue-600 bg-blue-50" },
  { key: "resource", label: "자료실", icon: FolderOpen, color: "text-green-600 bg-green-50" },
  { key: "certificate", label: "수료증 발급", icon: Award, color: "text-purple-600 bg-purple-50" },
  { key: "faq", label: "FAQ", icon: HelpCircle, color: "text-yellow-600 bg-yellow-50" },
  { key: "inquiry", label: "협력 문의", icon: Handshake, color: "text-red-600 bg-red-50" },
  { key: "gallery", label: "갤러리", icon: Images, color: "text-pink-600 bg-pink-50" },
];

const NOTICES: { id: string | number; title: string; date: string; views: number; pinned: boolean }[] = [
  { id: 1, title: "[모집] AI 기초 정규과정 11기 수강생 모집 안내", date: "2026.03.15", views: 234, pinned: true },
  { id: 2, title: "[안내] 2026년 상반기 교육 일정 안내", date: "2026.03.10", views: 189, pinned: true },
  { id: 3, title: "[소식] 제3회 스마트워크톤 결과 발표", date: "2026.02.28", views: 145, pinned: false },
  { id: 4, title: "[안내] 신규 강사진 소개", date: "2026.02.20", views: 98, pinned: false },
  { id: 5, title: "[소식] 누적 수강생 1,500명 돌파", date: "2026.02.15", views: 76, pinned: false },
];

const RESOURCES: { id: string | number; title: string; author: string; date: string; downloads: number; type: string }[] = [
  { id: 1, title: "AI 기초 11기 - 1주차 강의자료", author: "김상용", date: "2026.03.15", downloads: 156, type: "PDF" },
  { id: 2, title: "프롬프트 엔지니어링 실습 가이드", author: "김상용", date: "2026.03.14", downloads: 98, type: "PDF" },
  { id: 3, title: "데이터 분석 실습 데이터셋", author: "김학태", date: "2026.03.10", downloads: 76, type: "ZIP" },
  { id: 4, title: "바이브 코딩 입문 자료", author: "제갈정", date: "2026.03.05", downloads: 54, type: "PDF" },
];

const GALLERY_IMAGES: { id: string | number; title: string; category: string; imageUrl: string }[] = [
  { id: 1, title: "AI 기초 정규과정 10기 수료식", category: "교육", imageUrl: "/images/defaults/spec-community.jpg" },
  { id: 2, title: "제3회 스마트워크톤 현장", category: "워크톤", imageUrl: "/images/defaults/workathon-bg.jpg" },
  { id: 3, title: "데이터 분석 실습 현장", category: "교육", imageUrl: "/images/defaults/edu-data.jpg" },
  { id: 4, title: "강사진 워크숍", category: "행사", imageUrl: "/images/defaults/spec-practice.jpg" },
  { id: 5, title: "AI 기초 강의 현장", category: "교육", imageUrl: "/images/defaults/edu-ai.jpg" },
  { id: 6, title: "네트워킹 행사", category: "행사", imageUrl: "/images/defaults/spec-system.jpg" },
];

function CommunityContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam || "notice");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [inquiryForm, setInquiryForm] = useState({ name: "", email: "", phone: "", company: "", subject: "", message: "" });
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [certEmail, setCertEmail] = useState("");
  const [certName, setCertName] = useState("");
  const [certSearched, setCertSearched] = useState(false);
  const [certResult, setCertResult] = useState<{ courseName: string; completionDate: string; cohort: string; status: string } | null>(null);
  const [certLoading, setCertLoading] = useState(false);

  const [faqList, setFaqList] = useState(DEMO_FAQ);
  const [noticeList, setNoticeList] = useState(NOTICES);
  const [resourceList, setResourceList] = useState(RESOURCES);
  const [galleryList, setGalleryList] = useState(GALLERY_IMAGES);
  const [customBoards, setCustomBoards] = useState<{ boardType: string; posts: { id: string; title: string; date: string; views: number; pinned: boolean }[] }[]>([]);

  const { user, showLogin, loginMessage, requireLogin, closeLogin } = useLoginGuard();

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    Promise.all([
      getCollection<typeof DEMO_FAQ[0]>(COLLECTIONS.FAQ),
      getCollection<{ id: string; type?: string; boardType?: string; title: string; category?: string; createdAt?: string; date?: string; views?: number; pinned?: boolean; isPinned?: boolean; author?: string; downloads?: number; fileType?: string }>(COLLECTIONS.POSTS),
      getCollection<{ id: number | string; title: string; category: string; imageUrl: string }>(COLLECTIONS.GALLERY),
    ]).then(([faq, posts, gallery]) => {
      if (faq.length > 0) setFaqList(faq);
      if (posts.length > 0) {
        const getType = (p: { type?: string; boardType?: string }) => p.type || p.boardType || "";
        const n = posts.filter((p) => getType(p) === "NOTICE").map((p) => ({
          id: p.id, title: p.title, date: toDateString(p.createdAt || p.date), views: p.views || 0, pinned: p.pinned || p.isPinned || false,
        }));
        const r = posts.filter((p) => getType(p) === "RESOURCE").map((p) => ({
          id: p.id, title: p.title, author: p.author || "", date: toDateString(p.createdAt || p.date), downloads: p.downloads || 0, type: p.fileType || "PDF",
        }));
        if (n.length > 0) setNoticeList(n);
        if (r.length > 0) setResourceList(r);
        // 커스텀 게시판 수집
        const knownTypes = ["NOTICE", "RESOURCE"];
        const customTypes = [...new Set(posts.map((p) => getType(p)).filter((t) => t && !knownTypes.includes(t)))];
        if (customTypes.length > 0) {
          setCustomBoards(customTypes.map((bt) => ({
            boardType: bt,
            posts: posts.filter((p) => getType(p) === bt).map((p) => ({
              id: p.id, title: p.title, date: toDateString(p.createdAt || p.date), views: p.views || 0, pinned: p.pinned || p.isPinned || false,
            })),
          })));
        }
      }
      if (gallery.length > 0) setGalleryList(gallery);
    }).catch(console.error);
  }, []);

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requireLogin(async () => {
      try {
        await createDoc(COLLECTIONS.INQUIRIES, {
          ...inquiryForm,
          status: "NEW",
          type: "PARTNERSHIP",
          userId: user?.uid,
          userEmail: user?.email,
          date: new Date().toISOString().slice(0, 10),
          adminNote: "",
          replyContent: "",
          emailSent: false,
          category: "PARTNERSHIP",
          content: inquiryForm.message,
        });
      } catch (err) {
        console.error(err);
      }
      setInquirySubmitted(true);
    }, "협력 문의를 보내려면 로그인이 필요합니다.");
  };

  const handleDownload = (resTitle: string) => {
    requireLogin(() => {
      // TODO: 실제 파일 다운로드 로직
      alert(`"${resTitle}" 다운로드를 시작합니다.`);
    }, "자료를 다운로드하려면 로그인이 필요합니다.");
  };

  const handleCertSearch = () => {
    requireLogin(async () => {
      setCertLoading(true);
      setCertResult(null);
      try {
        const [graduates, cohorts] = await Promise.all([
          getCollection<{ id: string; email: string; name: string; cohortId: string; status: string; courseName?: string; completionDate?: string; cohort?: string }>(COLLECTIONS.CERTIFICATES_GRADUATES),
          getCollection<{ id: string; name: string; programTitle: string; endDate: string }>(COLLECTIONS.CERTIFICATES_COHORTS),
        ]);
        const emailLower = certEmail.trim().toLowerCase();
        const nameTrimmed = certName.trim();
        const match = graduates.find((g) => {
          const emailMatch = emailLower && g.email.toLowerCase() === emailLower;
          const nameMatch = nameTrimmed && g.name === nameTrimmed;
          const isEligible = g.status === "수료" || g.status === "졸업";
          return (emailMatch || nameMatch) && isEligible;
        });
        if (match) {
          const cohort = cohorts.find((c) => c.id === match.cohortId);
          setCertResult({
            courseName: match.courseName || cohort?.programTitle || "과정명 미등록",
            completionDate: match.completionDate || cohort?.endDate || "",
            cohort: match.cohort || cohort?.name || "",
            status: match.status,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCertSearched(true);
        setCertLoading(false);
      }
    }, "수료증을 조회하려면 로그인이 필요합니다.");
  };

  return (
    <div className="py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">커뮤니티</h1>
          <p className="text-lg text-gray-500">
            AISH 커뮤니티에서 다양한 정보와 서비스를 이용하세요.
          </p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {[...FIXED_TABS, ...customBoards.map((cb) => ({
            key: cb.boardType.toLowerCase(),
            label: cb.boardType,
            icon: FileText,
            color: "text-gray-600 bg-gray-50",
          }))].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all",
                activeTab === tab.key
                  ? "bg-primary-600 text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 공지사항 */}
        {activeTab === "notice" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">공지사항</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {noticeList.map((notice) => (
                <div key={notice.id} className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer">
                  {notice.pinned && <Pin size={14} className="text-primary-500 mr-2 shrink-0" />}
                  <span className={cn("text-sm flex-1", notice.pinned ? "font-semibold text-gray-900" : "text-gray-700")}>
                    {notice.title}
                  </span>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Eye size={12} />{notice.views}</span>
                    <span className="text-xs text-gray-400">{notice.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 자료실 */}
        {activeTab === "resource" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">자료실</h2>
              <p className="text-sm text-gray-500 mt-1">교육 자료와 참고 문서를 다운로드하세요.</p>
            </div>
            <div className="divide-y divide-gray-50">
              {resourceList.map((res) => (
                <div key={res.id} className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{res.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{res.author} · {res.date}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{res.type}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Download size={12} />{res.downloads}</span>
                    <button onClick={() => handleDownload(res.title)} className="p-2 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors">
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 수료증 발급 */}
        {activeTab === "certificate" && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
                  <Award size={32} className="text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">수료증 발급</h2>
                <p className="text-sm text-gray-500 mt-2">
                  수강 시 등록한 이메일로 수료증 발급 여부를 확인할 수 있습니다.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">등록 이메일</label>
                  <input
                    type="email"
                    value={certEmail}
                    onChange={(e) => { setCertEmail(e.target.value); setCertSearched(false); setCertResult(null); }}
                    placeholder="수강 신청 시 사용한 이메일을 입력하세요"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">이름 (선택)</label>
                  <input
                    type="text"
                    value={certName}
                    onChange={(e) => { setCertName(e.target.value); setCertSearched(false); setCertResult(null); }}
                    placeholder="이메일로 찾을 수 없을 때 이름으로 검색합니다"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <button
                  onClick={() => handleCertSearch()}
                  disabled={(!certEmail.trim() && !certName.trim()) || certLoading}
                  className="w-full py-3 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {certLoading ? "조회 중..." : "수료증 조회"}
                </button>
                {certSearched && !certResult && (
                  <div className="bg-yellow-50 text-yellow-700 text-sm p-4 rounded-lg">
                    <p className="font-medium mb-1">수료 정보를 찾을 수 없습니다.</p>
                    <ul className="text-yellow-600 text-xs space-y-1 mt-2 list-disc list-inside">
                      <li>수강 신청 시 등록한 이메일과 동일한지 확인해 주세요.</li>
                      <li>이메일로 찾을 수 없는 경우 이름으로도 검색해 보세요.</li>
                      <li>수료 또는 졸업 상태인 수강생만 조회 가능합니다.</li>
                      <li>관리자가 아직 수료 정보를 등록하지 않았을 수 있습니다.</li>
                      <li>문의사항은 <button type="button" onClick={() => setActiveTab("inquiry")} className="underline font-medium">협력 문의</button> 탭을 이용해 주세요.</li>
                    </ul>
                  </div>
                )}
                {certResult && (
                  <div className="bg-green-50 text-green-700 text-sm p-4 rounded-lg">
                    <p className="font-medium mb-2">수료 정보가 확인되었습니다!</p>
                    <div className="space-y-1 text-green-600 text-xs">
                      <p>과정명: <strong>{certResult.courseName}</strong></p>
                      <p>기수: <strong>{certResult.cohort}</strong></p>
                      <p>상태: <strong>{certResult.status}</strong></p>
                      <p>수료일: <strong>{certResult.completionDate}</strong></p>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-6 text-center">
                * Google 로그인 연동 후 자동 확인이 가능합니다. (추후 지원 예정)
              </p>
            </div>
          </div>
        )}

        {/* FAQ */}
        {activeTab === "faq" && (
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">자주 묻는 질문</h2>
            </div>
            {faqList.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-900 pr-4">{faq.question}</span>
                  {openFaqIndex === index ? (
                    <ChevronUp size={18} className="text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-gray-400 shrink-0" />
                  )}
                </button>
                {openFaqIndex === index && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    <p className="text-sm text-gray-600 leading-relaxed pt-4">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 협력 문의 */}
        {activeTab === "inquiry" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2">협력 문의</h2>
              <p className="text-sm text-gray-500 mb-6">교육 협력 및 제휴를 문의해 주세요. 담당자가 빠르게 연락드리겠습니다.</p>

              {inquirySubmitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">문의가 접수되었습니다</h3>
                  <p className="text-sm text-gray-500">담당자 확인 후 입력하신 이메일로 답변드리겠습니다.</p>
                  <button
                    onClick={() => { setInquirySubmitted(false); setInquiryForm({ name: "", email: "", phone: "", company: "", subject: "", message: "" }); }}
                    className="mt-6 px-6 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    새 문의 작성
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">이름 *</label>
                      <input type="text" required value={inquiryForm.name} onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">이메일 *</label>
                      <input type="email" required value={inquiryForm.email} onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">연락처</label>
                      <input type="tel" value={inquiryForm.phone} onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                        placeholder="010-0000-0000"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">소속/회사</label>
                      <input type="text" value={inquiryForm.company} onChange={(e) => setInquiryForm({ ...inquiryForm, company: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">제목 *</label>
                    <input type="text" required value={inquiryForm.subject} onChange={(e) => setInquiryForm({ ...inquiryForm, subject: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">문의 내용 *</label>
                    <textarea rows={5} required value={inquiryForm.message} onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                      placeholder="문의 내용을 입력해 주세요..."
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
                  </div>
                  <button type="submit"
                    className="w-full py-3 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
                    문의 보내기
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 갤러리 */}
        {activeTab === "gallery" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">갤러리</h2>
              <p className="text-sm text-gray-500 mt-1">교육 현장과 행사 사진을 둘러보세요.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {galleryList.map((img) => (
                <div key={img.id} className="group relative rounded-xl overflow-hidden aspect-[4/3] cursor-pointer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.imageUrl} alt={img.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 w-full p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs px-2 py-0.5 rounded bg-white/20 backdrop-blur">{img.category}</span>
                    <p className="text-sm font-medium mt-1">{img.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 커스텀 게시판 */}
        {customBoards.map((cb) => (
          activeTab === cb.boardType.toLowerCase() && (
            <div key={cb.boardType} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">{cb.boardType}</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {cb.posts.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-400 text-sm">게시물이 없습니다.</div>
                ) : cb.posts.map((post) => (
                  <div key={post.id} className="flex items-center px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer">
                    {post.pinned && <Pin size={14} className="text-primary-500 mr-2 shrink-0" />}
                    <span className={cn("text-sm flex-1", post.pinned ? "font-semibold text-gray-900" : "text-gray-700")}>
                      {post.title}
                    </span>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Eye size={12} />{post.views}</span>
                      <span className="text-xs text-gray-400">{post.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
      <LoginModal isOpen={showLogin} onClose={closeLogin} message={loginMessage} />
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-gray-400">로딩 중...</div>}>
      <CommunityContent />
    </Suspense>
  );
}
