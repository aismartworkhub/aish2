"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface SampleBadgeProps {
  adminLink?: string;
  className?: string;
}

export default function SampleBadge({ adminLink, className }: SampleBadgeProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "superadmin" || profile?.role === "admin";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5", className)}>
      샘플
      {isAdmin && adminLink && (
        <Link href={adminLink} className="underline text-amber-700 hover:text-amber-800 ml-1">
          등록하기
        </Link>
      )}
    </span>
  );
}
