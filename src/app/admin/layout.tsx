import type { Metadata } from "next";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

export const metadata: Metadata = {
 title: "AISH Admin",
};

export default function AdminLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 return (
   <div className="min-h-screen bg-gray-50">
     <AdminSidebar />
     <div className="ml-64 transition-all duration-300">
       <AdminHeader />
       <main className="p-6">{children}</main>
     </div>
   </div>
 );
}
