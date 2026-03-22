"use client";

import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import AuthGuard from "@/components/admin/AuthGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <AdminSidebar />
        <div className="ml-64 transition-all duration-300">
          <AdminHeader />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
