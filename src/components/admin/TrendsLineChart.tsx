"use client";

import { useMemo } from "react";
import type { TrendsSeriesPoint } from "@/lib/googleTrendsCsv";

interface TrendsLineChartProps {
  series: TrendsSeriesPoint[];
  height?: number;
  ariaLabel?: string;
}

const W = 720;
const PADDING = { top: 16, right: 16, bottom: 28, left: 36 };

export default function TrendsLineChart({
  series,
  height = 240,
  ariaLabel = "Google Trends 시계열 그래프",
}: TrendsLineChartProps) {
  const view = useMemo(() => {
    if (series.length === 0) return null;
    const innerW = W - PADDING.left - PADDING.right;
    const innerH = height - PADDING.top - PADDING.bottom;
    const max = Math.max(...series.map((p) => p.value), 100);
    const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;

    const points = series.map((p, i) => {
      const x = PADDING.left + i * stepX;
      const y = PADDING.top + innerH - (p.value / max) * innerH;
      return { x, y, value: p.value, date: p.date };
    });

    const path = points.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
    const area = `${path} L${points[points.length - 1].x.toFixed(1)},${(PADDING.top + innerH).toFixed(1)} L${points[0].x.toFixed(1)},${(PADDING.top + innerH).toFixed(1)} Z`;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
      y: PADDING.top + innerH - r * innerH,
      label: Math.round(max * r).toString(),
    }));

    const xTickIndices = pickTickIndices(series.length, 6);
    const xTicks = xTickIndices.map((i) => ({
      x: points[i].x,
      label: series[i].date,
    }));

    return { points, path, area, yTicks, xTicks, max };
  }, [series, height]);

  if (!view) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        데이터 없음
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full max-w-full h-auto"
        role="img"
        aria-label={ariaLabel}
      >
        {view.yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line
              x1={PADDING.left}
              x2={W - PADDING.right}
              y1={t.y}
              y2={t.y}
              stroke="#e5e7eb"
              strokeDasharray="3 3"
            />
            <text x={PADDING.left - 6} y={t.y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">
              {t.label}
            </text>
          </g>
        ))}

        <path d={view.area} fill="rgba(59,130,246,0.1)" />
        <path d={view.path} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />

        {view.points.length <= 80 &&
          view.points.map((pt, i) => (
            <circle key={`pt-${i}`} cx={pt.x} cy={pt.y} r={2.5} fill="#3b82f6">
              <title>{`${pt.date}: ${pt.value}`}</title>
            </circle>
          ))}

        {view.xTicks.map((t, i) => (
          <text
            key={`x-${i}`}
            x={t.x}
            y={height - 8}
            textAnchor="middle"
            fontSize="10"
            fill="#9ca3af"
          >
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function pickTickIndices(total: number, want: number): number[] {
  if (total <= want) return Array.from({ length: total }, (_, i) => i);
  const step = (total - 1) / (want - 1);
  const set = new Set<number>();
  for (let i = 0; i < want; i++) {
    set.add(Math.round(i * step));
  }
  return Array.from(set).sort((a, b) => a - b);
}
