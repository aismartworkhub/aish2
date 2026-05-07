import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 빈 데이터 상태 공통 컴포넌트.
 * 데이터 0건일 때 헤더만 남고 빈 영역으로 노출되던 곳에 사용 — 의미 있는 안내 + 선택 액션.
 *
 * 사용 예:
 *   {items.length === 0 && (
 *     <EmptyState icon={Star} title="아직 후기가 없습니다" description="첫 후기를 남겨주세요." />
 *   )}
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center",
        className,
      )}
    >
      {Icon && <Icon size={32} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />}
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
