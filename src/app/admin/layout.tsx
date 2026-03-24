"use client";

import { useState, useCallback } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import AuthGuard from "@/components/admin/AuthGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <AdminSidebar mobileOpen={mobileOpen} onClose={closeMobile} />
        <div className="ml-0 lg:ml-64 transition-all duration-300">
          <AdminHeader onMenuToggle={toggleMobile} />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
