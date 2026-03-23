import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** 관리자 페이지 로딩 스켈레톤 */
export function AdminLoading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 헤더 스켈레톤 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-72 bg-gray-100 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>
      {/* 테이블 스켈레톤 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-12 bg-gray-50 border-b border-gray-100" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={cn("flex items-center gap-4 px-4 py-4", i < rows - 1 && "border-b border-gray-50")}>
            <div className="h-4 w-1/4 bg-gray-100 rounded" />
            <div className="h-4 w-1/6 bg-gray-100 rounded" />
            <div className="h-4 w-1/6 bg-gray-50 rounded" />
            <div className="flex-1" />
            <div className="h-4 w-16 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 관리자 페이지 에러 표시 */
export function AdminError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-12 flex flex-col items-center gap-3">
      <AlertCircle className="text-red-400" size={40} />
      <p className="text-sm text-gray-600 text-center max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <RefreshCw size={14} /> 다시 시도
        </button>
      )}
    </div>
  );
}
