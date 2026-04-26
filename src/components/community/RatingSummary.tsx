"use client";

import { cn } from "@/lib/utils";

export type RatingItem = { rating: number };

/**
 * 평점 평균(★) + 5단계 분포 막대그래프 + 총 건수.
 * /community 후기 탭과 홈 매거진 양쪽에서 재사용.
 */
export default function RatingSummary({
  items,
  className,
}: {
  items: RatingItem[];
  className?: string;
}) {
  const count = items.length;
  if (count === 0) return null;

  const sum = items.reduce((s, r) => s + (r.rating || 0), 0);
  const avg = sum / count;
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: items.filter((r) => r.rating === star).length,
  }));
  const maxDist = Math.max(1, ...dist.map((d) => d.n));

  return (
    <div className={cn("flex flex-col gap-4 rounded-xl bg-gray-50 px-5 py-4 sm:flex-row sm:items-center", className)}>
      <div className="text-center sm:border-r sm:border-gray-200 sm:pr-6">
        <div className="text-3xl font-bold text-amber-500">
          {avg.toFixed(1)}
          <span className="ml-1 text-sm text-gray-400">/ 5.0</span>
        </div>
        <div className="mt-1 flex justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} className={cn("text-sm", s <= Math.round(avg) ? "text-amber-400" : "text-gray-300")}>★</span>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">총 {count}건</p>
      </div>
      <div className="flex-1 space-y-1">
        {dist.map((d) => (
          <div key={d.star} className="flex items-center gap-2 text-xs">
            <span className="w-5 text-gray-500">{d.star}★</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${(d.n / maxDist) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-gray-500">{d.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
