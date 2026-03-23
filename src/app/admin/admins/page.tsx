"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Shield, ShieldCheck } from "lucide-react";
import { COLLECTIONS, getCollection, createDoc, upsertDoc, updateDocFields, removeDoc } from "@/lib/firestore";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "editor";
  isActive: boolean;
  lastLogin?: string;
}

const ROLE_LABELS: Record<string, string> = { superadmin: "최고 관리자", admin: "관리자", editor: "편집자" };
const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-red-50 text-red-700",
  admin: "bg-blue-50 text-blue-700",
  editor: "bg-gray-100 text-gray-700",
};

const EMPTY_FORM: Omit<AdminUser, "id"> = { name: "", email: "", role: "editor", isActive: true };

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const data = await getCollection<AdminUser>(COLLECTIONS.ADMINS);
      setItems(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true); };
  const openEdit = (item: AdminUser) => {
    setForm({ name: item.name, email: item.email, role: item.role, isActive: item.isActive });
    setEditId(item.id); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await upsertDoc(COLLECTIONS.ADMINS, editId, form);
        setItems((prev) => prev.map((i) => i.id === editId ? { ...i, ...form } : i));
      } else {
        const id = await createDoc(COLLECTIONS.ADMINS, form);
        setItems((prev) => [...prev, { id, ...form }]);
      }
      setShowModal(false);
    } catch (e) { console.error(e); alert("저장에 실패했습니다."); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    try {
      await removeDoc(COLLECTIONS.ADMINS, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) { console.error(e); alert("삭제에 실패했습니다."); }
  };

  const toggleActive = async (item: AdminUser) => {
    try {
      await updateDocFields(COLLECTIONS.ADMINS, item.id, { isActive: !item.isActive });
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isActive: !i.isActive } : i));
    } catch (e) { console.error(e); alert("상태 변경에 실패했습니다."); }
  };

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">관리자 관리</h1>
          <p className="text-gray-500 mt-1">관리자 계정을 관리합니다.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <Plus size={16} /> 관리자 추가
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">이름</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">이메일</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">역할</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">상태</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">등록된 관리자가 없습니다.</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 text-xs font-bold">{item.name[0]}</span>
                    </div>
                    <span className="font-medium text-gray-900">{item.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{item.email}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[item.role] || ""}`}>
                    {ROLE_LABELS[item.role] || item.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => toggleActive(item)} className={`text-xs px-2 py-1 rounded-full ${item.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {item.isActive ? "활성" : "비활성"}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">{editId ? "관리자 수정" : "관리자 추가"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="관리자 이름" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="admin@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminUser["role"] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="superadmin">최고 관리자</option>
                  <option value="admin">관리자</option>
                  <option value="editor">편집자</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {saving ? "저장중..." : editId ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
