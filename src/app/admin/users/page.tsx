"use client";

import { useState } from "react";
import { Search, Shield, ShieldCheck, Crown } from "lucide-react";
import { COLLECTIONS, updateDocFields } from "@/lib/firestore";
import { useFirestoreCollection } from "@/hooks/useFirestoreCollection";
import { AdminLoading, AdminError } from "@/components/admin/AdminLoadingState";
import { useAuth } from "@/contexts/AuthContext";
import {
  SUPER_ADMIN_EMAIL,
  USER_ROLE_LABELS,
  USER_ROLE_COLORS,
  type UserRole,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Firestore에서 가져온 사용자 (id = uid) */
interface UserRecord {
  id: string; // Firestore doc ID = Firebase Auth uid
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  isActive: boolean;
}

const ASSIGNABLE_ROLES: UserRole[] = ["admin", "member", "user", "premium"];

export default function UsersPage() {
  const { isSuperAdmin, profile: myProfile } = useAuth();
  const { data: users, setData: setUsers, loading, error, refresh } =
    useFirestoreCollection<UserRecord>(COLLECTIONS.USERS);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [changing, setChanging] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleRoleChange = async (user: UserRecord, newRole: UserRole) => {
    if (user.email === SUPER_ADMIN_EMAIL) return; // 슈퍼관리자 역할 변경 불가
    if (!isSuperAdmin) return; // 슈퍼관리자만 역할 변경 가능

    setChanging(user.id);
    try {
      await updateDocFields(COLLECTIONS.USERS, user.id, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
    } catch (e) {
      console.error(e);
      alert("역할 변경에 실패했습니다.");
    } finally {
      setChanging(null);
    }
  };

  const toggleActive = async (user: UserRecord) => {
    if (user.email === SUPER_ADMIN_EMAIL) return;
    if (!isSuperAdmin) return;

    setChanging(user.id);
    try {
      await updateDocFields(COLLECTIONS.USERS, user.id, { isActive: !user.isActive });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u))
      );
    } catch (e) {
      console.error(e);
      alert("상태 변경에 실패했습니다.");
    } finally {
      setChanging(null);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    if (role === "superadmin") return <Crown size={14} className="text-red-500" />;
    if (role === "admin") return <ShieldCheck size={14} className="text-blue-500" />;
    return <Shield size={14} className="text-gray-400" />;
  };

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} onRetry={refresh} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">회원관리</h1>
        <p className="text-gray-500 mt-1">전체 회원 목록 및 역할을 관리합니다.</p>
      </div>

      {/* 필터 영역 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일로 검색"
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
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(Object.entries(USER_ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => {
          const count = users.filter((u) => u.role === role).length;
          return (
            <div key={role} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900">{count}</p>
            </div>
          );
        })}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">사용자</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">이메일</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">역할</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">상태</th>
              {isSuperAdmin && (
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">관리</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">조건에 맞는 회원이 없습니다.</td></tr>
            )}
            {filtered.map((u) => {
              const isSuperAdminUser = u.email === SUPER_ADMIN_EMAIL;
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-700 text-xs font-bold">
                            {(u.displayName || u.email || "?")[0]}
                          </span>
                        </div>
                      )}
                      <span className="font-medium text-gray-900">{u.displayName || "-"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {getRoleIcon(u.role)}
                      <span className={cn("text-xs px-2 py-1 rounded-full font-medium", USER_ROLE_COLORS[u.role])}>
                        {USER_ROLE_LABELS[u.role] || u.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      u.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {u.isActive ? "활성" : "비활성"}
                    </span>
                  </td>
                  {isSuperAdmin && (
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {isSuperAdminUser ? (
                          <span className="text-xs text-gray-400">변경 불가</span>
                        ) : (
                          <>
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                              disabled={changing === u.id}
                              className="text-xs border border-gray-300 rounded-lg px-2 py-1 disabled:opacity-50"
                            >
                              {ASSIGNABLE_ROLES.map((r) => (
                                <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => toggleActive(u)}
                              disabled={changing === u.id}
                              className={cn(
                                "text-xs px-2 py-1 rounded-lg disabled:opacity-50",
                                u.isActive
                                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                                  : "bg-green-50 text-green-600 hover:bg-green-100"
                              )}
                            >
                              {u.isActive ? "비활성화" : "활성화"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        총 {filtered.length}명 / 전체 {users.length}명
      </p>
    </div>
  );
}
