"use client";

import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  legacyName: string;
  targetBoardKey?: string;
};

export default function LegacyMigrationBanner({ legacyName, targetBoardKey }: Props) {
  const href = targetBoardKey
    ? `/admin/contents?board=${targetBoardKey}`
    : "/admin/contents";

  return (
    <div className={cn(
      "mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3",
    )}>
      <Info size={18} className="shrink-0 text-blue-500" />
      <div className="flex-1 text-sm text-blue-700">
        <strong>{legacyName}</strong>은 <strong>통합 콘텐츠 관리</strong>로 이전되었습니다.
        새 콘텐츠는 통합 관리 페이지에서 등록해 주세요. 이 페이지는 기존 데이터 조회용으로 유지됩니다.
      </div>
      <Link
        href={href}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white",
          "hover:bg-blue-600 transition-colors",
        )}
      >
        통합 관리로 이동 <ArrowRight size={12} />
      </Link>
    </div>
  );
}
