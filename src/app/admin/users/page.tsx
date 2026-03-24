"use client";

import { useState } from "react";
import { Search, Shield, ShieldCheck, Crown, X, CheckCircle, AlertCircle, Trash2, AlertTriangle } from "lucide-react";
import { COLLECTIONS, updateDocFields, removeDoc } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { useAuth } from "@/contexts/AuthContext";
import {
  SUPER_ADMIN_EMAIL,
  USER_ROLE_LABELS,
  USER_ROLE_COLORS,
  COHORT_OPTIONS,
  type UserRole,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  isActive: boolean;
  name?: string;
  cohort?: string;
  phone?: string;
  companyName?: string;
  companyProduct?: string;
  companyWebsite?: string;
  companySocial?: string;
}

const ASSIGNABLE_ROLES: UserRole[] = ["admin", "member", "user", "premium"];

const INPUT_CLASS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600";

function isComplete(u: UserRecord): boolean {
  return !!(u.name?.trim() && u.cohort?.trim() && u.phone?.trim());
}

export default function UsersPage() {
  const { isSuperAdmin } = useAuth();
  const { data: users, setData: setUsers, loading, error, refresh } =
    useFirestoreCollection<UserRecord>(COLLECTIONS.USERS);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [profileFilter, setProfileFilter] = useState<"all" | "complete" | "incomplete">("all");
  const [changing, setChanging] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", cohort: "", phone: "",
    companyName: "", companyProduct: "", companyWebsite: "", companySocial: "",
    role: "user" as UserRole, isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      u.name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchCohort = cohortFilter === "all" || u.cohort === cohortFilter;
    const matchProfile =
      profileFilter === "all" ||
      (profileFilter === "complete" && isComplete(u)) ||
      (profileFilter === "incomplete" && !isComplete(u));
    return matchSearch && matchRole && matchCohort && matchProfile;
  });

  const openEdit = (u: UserRecord) => {
    setEditUser(u);
    setEditForm({
      name: u.name ?? "", cohort: u.cohort ?? "", phone: u.phone ?? "",
      companyName: u.companyName ?? "", companyProduct: u.companyProduct ?? "",
      companyWebsite: u.companyWebsite ?? "", companySocial: u.companySocial ?? "",
      role: u.role, isActive: u.isActive,
    });
  };

  const handleEditSave = async () => {
    if (!editUser || !isSuperAdmin) return;
    setSaving(true);
    try {
      const isSuperAdminUser = editUser.email === SUPER_ADMIN_EMAIL;
      const updates: Record<string, unknown> = {
        name: editForm.name, cohort: editForm.cohort, phone: editForm.phone,
        companyName: editForm.companyName, companyProduct: editForm.companyProduct,
        companyWebsite: editForm.companyWebsite, companySocial: editForm.companySocial,
      };
      if (!isSuperAdminUser) {
        updates.role = editForm.role;
        updates.isActive = editForm.isActive;
      }
      await updateDocFields(COLLECTIONS.USERS, editUser.id, updates);
      setUsers((prev) =>
        prev.map((u) => (u.id === editUser.id ? { ...u, ...updates } as UserRecord : u))
      );
      setEditUser(null);
    } catch (e) {
      console.error(e);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: UserRecord) => {
    if (u.email === SUPER_ADMIN_EMAIL) return;
    if (!confirm(`"${u.displayName || u.email}" 회원을 삭제하시겠습니까?\n\nFirestore 프로필이 삭제됩니다. (Firebase Auth 계정은 유지)`)) return;
    try {
      await removeDoc(COLLECTIONS.USERS, u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      setEditUser(null);
    } catch (e) {
      console.error(e);
      alert("삭제에 실패했습니다.");
    }
  };

  const getRoleIcon = (role: UserRole) => {
    if (role === "superadmin") return <Crown size={14} className="text-red-500" />;
    if (role === "admin") return <ShieldCheck size={14} className="text-blue-500" />;
    return <Shield size={14} className="text-gray-400" />;
  };

  // 기수 목록 (실제 데이터에 있는 것만)
  const existingCohorts = [...new Set(users.map((u) => u.cohort).filter(Boolean))].sort();

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  const incompleteCount = users.filter((u) => !isComplete(u)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">회원관리</h1>
        <p className="text-gray-500 mt-1">전체 회원 목록 및 프로필을 관리합니다.</p>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(Object.entries(USER_ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => {
          const count = users.filter((u) => u.role === role).length;
          return (
            <div key={role} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900">{count}</p>
            </div>
          );
        })}
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">프로필 미완성</p>
          <p className={cn("text-xl font-bold", incompleteCount > 0 ? "text-amber-600" : "text-gray-900")}>
            {incompleteCount}
          </p>
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 이메일로 검색"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">전체 역할</option>
          {Object.entries(USER_ROLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={cohortFilter}
          onChange={(e) => setCohortFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">전체 기수</option>
          {existingCohorts.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={profileFilter}
          onChange={(e) => setProfileFilter(e.target.value as "all" | "complete" | "incomplete")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">프로필 전체</option>
          <option value="complete">완성</option>
          <option value="incomplete">미완성</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">사용자</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">이름</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">기수</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">연락처</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">역할</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">프로필</th>
              {isSuperAdmin && (
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">관리</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">조건에 맞는 회원이 없습니다.</td></tr>
            )}
            {filtered.map((u) => (
              <tr
                key={u.id}
                className={cn("hover:bg-gray-50", isSuperAdmin && "cursor-pointer")}
                onClick={() => isSuperAdmin && openEdit(u)}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {u.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 text-xs font-bold">
                          {(u.displayName || u.email || "?")[0]}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{u.displayName || "-"}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{u.name || "-"}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{u.cohort || "-"}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{u.phone || "-"}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    {getRoleIcon(u.role)}
                    <span className={cn("text-xs px-2 py-1 rounded-full font-medium", USER_ROLE_COLORS[u.role])}>
                      {USER_ROLE_LABELS[u.role] || u.role}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {isComplete(u) ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle size={14} /> 완성
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertCircle size={14} /> 미완성
                    </span>
                  )}
                </td>
                {isSuperAdmin && (
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(u); }}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      상세
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        총 {filtered.length}명 / 전체 {users.length}명
      </p>

      {/* 상세/수정 모달 */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">회원 상세</h3>
              <button onClick={() => setEditUser(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* 계정 정보 */}
              <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                {editUser.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editUser.photoURL} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 font-bold">{(editUser.displayName || editUser.email)[0]}</span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">{editUser.displayName || "-"}</p>
                  <p className="text-xs text-gray-500">{editUser.email}</p>
                </div>
              </div>

              {/* 역할/상태 (슈퍼관리자 계정 제외) */}
              {editUser.email !== SUPER_ADMIN_EMAIL && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                      className={INPUT_CLASS}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                    <select
                      value={editForm.isActive ? "active" : "inactive"}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "active" })}
                      className={INPUT_CLASS}
                    >
                      <option value="active">활성</option>
                      <option value="inactive">비활성</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 필수 정보 */}
              <p className="text-sm font-semibold text-gray-800 pt-1">필수 정보</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">기수</label>
                  <select
                    value={editForm.cohort}
                    onChange={(e) => setEditForm({ ...editForm, cohort: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">선택</option>
                    {COHORT_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="010-0000-0000"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* 회사 정보 */}
              <p className="text-sm font-semibold text-gray-800 pt-1">회사 정보</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">회사명</label>
                <input
                  value={editForm.companyName}
                  onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주요 제품/서비스</label>
                <input
                  value={editForm.companyProduct}
                  onChange={(e) => setEditForm({ ...editForm, companyProduct: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">웹사이트</label>
                <input
                  type="url"
                  value={editForm.companyWebsite}
                  onChange={(e) => setEditForm({ ...editForm, companyWebsite: e.target.value })}
                  placeholder="https://"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">소셜 링크</label>
                <input
                  type="url"
                  value={editForm.companySocial}
                  onChange={(e) => setEditForm({ ...editForm, companySocial: e.target.value })}
                  placeholder="https://"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              {editUser.email !== SUPER_ADMIN_EMAIL ? (
                <button
                  onClick={() => handleDelete(editUser)}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 size={14} />
                  회원 삭제
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
