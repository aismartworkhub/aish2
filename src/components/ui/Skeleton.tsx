import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-gray-200", className)} />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded overflow-hidden border border-gray-100">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="text-center space-y-2">
      <Skeleton className="w-10 h-10 rounded-full mx-auto" />
      <Skeleton className="h-8 w-20 mx-auto" />
      <Skeleton className="h-3 w-16 mx-auto" />
    </div>
  );
}

export function NoticeListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-5 border-b border-gray-100">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-3 w-20 ml-4" />
        </div>
      ))}
    </div>
  );
}
