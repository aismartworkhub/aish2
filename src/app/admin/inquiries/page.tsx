"use client";

import { useState, useEffect } from "react";
import { Search, Mail, MailOpen, Clock, CheckCircle, XCircle, Trash2, Save, Send, Settings, Bell, Reply } from "lucide-react";
import { cn } from "@/lib/utils";
import { INQUIRY_STATUS_LABELS } from "@/lib/constants";
import { COLLECTIONS, updateDocFields, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { useToast } from "@/components/ui/Toast";

type InquiryStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  category: string;
  status: InquiryStatus;
  date: string;
  content: string;
  adminNote: string;
  emailSent: boolean;
  replyContent: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  ENROLLMENT: "수강 문의",
  PARTNERSHIP: "협력 제안",
  CERTIFICATE: "수료증",
  GENERAL: "일반 문의",
  TECHNICAL: "기술 문의",
};

const STATUS_ICONS: Record<string, React.ElementType> = { NEW: Mail, IN_PROGRESS: Clock, RESOLVED: CheckCircle, CLOSED: XCircle };
const STATUS_COLORS: Record<string, string> = { NEW: "bg-red-100 text-red-700", IN_PROGRESS: "bg-yellow-100 text-yellow-700", RESOLVED: "bg-green-100 text-green-700", CLOSED: "bg-gray-100 text-gray-700" };

export default function AdminInquiriesPage() {
  const { toast } = useToast();
  const { data: rawInquiries, loading, error, refresh } = useFirestoreCollection<Inquiry & { createdAt?: { seconds: number }; message?: string }>(COLLECTIONS.INQUIRIES);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editStatus, setEditStatus] = useState<InquiryStatus>("NEW");
  const [replyText, setReplyText] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [showEmailSettings, setShowEmailSettings] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [emailNotify, setEmailNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInquiries(rawInquiries.map((d) => ({
      ...d,
      date: d.date || (d.createdAt?.seconds ? new Date(d.createdAt.seconds * 1000).toISOString().slice(0, 10) : ""),
      content: d.content || d.message || "",
      adminNote: d.adminNote || "",
      replyContent: d.replyContent || "",
      emailSent: d.emailSent || false,
      status: d.status || "NEW",
      category: d.category || "GENERAL",
    })));
  }, [rawInquiries]);

  const filtered = inquiries.filter((i) => {
    const matchSearch = !searchQuery || i.subject.includes(searchQuery) || i.name.includes(searchQuery) || i.email.includes(searchQuery);
    const matchStatus = statusFilter === "ALL" || i.status === statusFilter;
    const matchCategory = categoryFilter === "ALL" || i.category === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  const selected = inquiries.find((i) => i.id === selectedId);

  const selectInquiry = (id: string) => {
    const inq = inquiries.find((i) => i.id === id);
    if (inq) {
      setSelectedId(id);
      setEditNote(inq.adminNote);
      setEditStatus(inq.status);
      setReplyText(inq.replyContent);
      setSaveMessage("");
    }
  };

  const saveInquiry = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const updates = { status: editStatus, adminNote: editNote, replyContent: replyText };
      await updateDocFields(COLLECTIONS.INQUIRIES, selectedId, updates);
      setInquiries((prev) => prev.map((i) => i.id === selectedId ? { ...i, ...updates } : i));
      setSaveMessage("저장되었습니다");
      setTimeout(() => setSaveMessage(""), 2000);
    } catch (e) {
      console.error(e);
      setSaveMessage("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    setSaving(true);
    try {
      const updates = { status: "RESOLVED" as InquiryStatus, replyContent: replyText, emailSent: true };
      await updateDocFields(COLLECTIONS.INQUIRIES, selectedId, updates);
      setInquiries((prev) => prev.map((i) => i.id === selectedId ? { ...i, ...updates } : i));
      setEditStatus("RESOLVED");
      setSaveMessage("답변이 저장되었습니다 (이메일 연동 설정 시 실제 발송)");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteInquiry = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.INQUIRIES, id);
      setInquiries((prev) => prev.filter((i) => i.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      console.error(e);
      toast("삭제에 실패했습니다.", "error");
    }
  };

  const newCount = inquiries.filter((i) => i.status === "NEW").length;

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">문의 관리</h1>
          <p className="text-gray-500 mt-1">접수된 문의를 확인하고 이메일로 답변합니다.</p>
        </div>
        <div className="flex gap-2">
          {newCount > 0 && (
            <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium">
              <Bell size={14} />신규 {newCount}건
            </span>
          )}
          <button onClick={() => setShowEmailSettings(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            <Settings size={16} />이메일 설정
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {(["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const).map((status) => {
          const Icon = STATUS_ICONS[status];
          const count = inquiries.filter((i) => i.status === status).length;
          return (
            <button key={status} onClick={() => setStatusFilter(statusFilter === status ? "ALL" : status)}
              className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all",
                statusFilter === status ? "border-primary-300 bg-primary-50 shadow-sm" : "border-gray-100 bg-white hover:border-gray-200")}>
              <Icon size={20} className={STATUS_COLORS[status].split(" ")[1]} />
              <div className="text-left">
                <p className="text-xs text-gray-500">{INQUIRY_STATUS_LABELS[status]}</p>
                <p className="text-lg font-bold text-gray-900">{count}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none">
              <option value="ALL">전체 카테고리</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {filtered.map((inquiry) => (
              <div key={inquiry.id} className={cn("flex items-center border-b border-gray-50 hover:bg-gray-50 transition-colors",
                selectedId === inquiry.id && "bg-primary-50 border-l-2 border-l-primary-500")}>
                <button onClick={() => selectInquiry(inquiry.id)} className="flex-1 text-left p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900 truncate">{inquiry.subject}</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2", STATUS_COLORS[inquiry.status])}>
                      {INQUIRY_STATUS_LABELS[inquiry.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{inquiry.name}</span>
                    <span>&middot;</span>
                    <span className="text-primary-400">{CATEGORY_LABELS[inquiry.category] || inquiry.category}</span>
                    <span>&middot;</span>
                    <span>{inquiry.date}</span>
                    {inquiry.emailSent && <Mail size={10} className="text-green-500" />}
                  </div>
                </button>
                <button onClick={() => deleteInquiry(inquiry.id)} className="p-3 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {filtered.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">문의가 없습니다.</div>}
          </div>
        </div>

        <div className="lg:col-span-3">
          {selected ? (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900">{selected.subject}</h2>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as InquiryStatus)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none">
                    <option value="NEW">신규</option>
                    <option value="IN_PROGRESS">처리중</option>
                    <option value="RESOLVED">해결</option>
                    <option value="CLOSED">종료</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-100">
                  <div><span className="text-xs text-gray-400">이름</span><p className="text-sm font-medium text-gray-900">{selected.name}</p></div>
                  <div><span className="text-xs text-gray-400">이메일</span><p className="text-sm font-medium text-primary-600">{selected.email}</p></div>
                  <div><span className="text-xs text-gray-400">연락처</span><p className="text-sm font-medium text-gray-900">{selected.phone || "-"}</p></div>
                  <div><span className="text-xs text-gray-400">카테고리</span><p className="text-sm font-medium text-gray-900">{CATEGORY_LABELS[selected.category] || selected.category}</p></div>
                  <div><span className="text-xs text-gray-400">접수일</span><p className="text-sm font-medium text-gray-900">{selected.date}</p></div>
                  <div><span className="text-xs text-gray-400">이메일 발송</span>
                    <p className={cn("text-sm font-medium", selected.emailSent ? "text-green-600" : "text-gray-400")}>
                      {selected.emailSent ? "발송 완료" : "미발송"}
                    </p>
                  </div>
                </div>
                <div className="mb-6">
                  <span className="text-xs text-gray-400">문의 내용</span>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-4">{selected.content}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">관리자 메모 (내부용)</span>
                  <textarea rows={2} value={editNote} onChange={(e) => setEditNote(e.target.value)}
                    placeholder="내부 메모를 입력하세요..."
                    className="mt-2 w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Reply size={18} className="text-primary-600" />
                  <h3 className="font-bold text-gray-900">이메일 답변</h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Mail size={14} />
                    <span>받는 사람: <strong className="text-gray-700">{selected.email}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 mt-1">
                    <span className="ml-5">제목: RE: {selected.subject}</span>
                  </div>
                </div>
                <textarea rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  placeholder="답변 내용을 입력하세요..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={sendReply} disabled={!replyText.trim() || saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50">
                    <Send size={16} />이메일 답변 보내기
                  </button>
                  <button onClick={saveInquiry} disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
                    <Save size={16} />{saving ? "저장중..." : "메모만 저장"}
                  </button>
                  {saveMessage && <span className="text-sm text-green-600 font-medium">{saveMessage}</span>}
                </div>
                <p className="text-xs text-gray-400 mt-2">* 실제 이메일 발송은 관리자 설정 &gt; 외부 연동에서 이메일 설정을 완료해야 작동합니다.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <MailOpen size={48} className="text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400">문의를 선택해주세요</p>
            </div>
          )}
        </div>
      </div>

      {showEmailSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">이메일 알림 설정</h2>
              <button onClick={() => setShowEmailSettings(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><XCircle size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-lg">
                문의가 접수되면 관리자 이메일로 알림을 보냅니다. 전체 이메일 설정은 <strong>사이트 설정 &gt; 외부 연동</strong>에서 관리하세요.
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">관리자 이메일</label>
                <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@aish.co.kr"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={emailNotify} onChange={(e) => setEmailNotify(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-200 peer-checked:bg-primary-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
                <span className="text-sm text-gray-700">새 문의 접수 시 이메일 알림</span>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowEmailSettings(false)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={() => setShowEmailSettings(false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
                <Save size={16} />저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
