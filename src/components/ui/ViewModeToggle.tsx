"use client";

import { Rss, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/hooks/useViewMode";

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (next: ViewMode) => void;
  /** 일부 모드를 숨김 (예: 홈은 board-list 미사용) */
  hidden?: ViewMode[];
  /** 추가 클래스 */
  className?: string;
  /** 버튼 작게 (모바일·홈 섹션용) */
  compact?: boolean;
}

const ALL_MODES: { mode: ViewMode; icon: typeof Rss; label: string; hint: string }[] = [
  { mode: "x-feed", icon: Rss, label: "X 피드", hint: "X.com 스타일 타임라인 (아바타·본문·액션바)" },
  { mode: "card-feed", icon: LayoutGrid, label: "카드", hint: "썸네일 카드 그리드" },
  { mode: "board-list", icon: List, label: "리스트", hint: "전통적 게시판 한 줄 리스트" },
];

export default function ViewModeToggle({
  mode,
  onChange,
  hidden = [],
  className,
  compact = false,
}: ViewModeToggleProps) {
  const visible = ALL_MODES.filter((m) => !hidden.includes(m.mode));
  const sizeIcon = compact ? 13 : 15;
  const sizePad = compact ? "px-2 py-1" : "px-2.5 py-1.5";

  return (
    <div
      role="tablist"
      aria-label="보기 방식"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5",
        className,
      )}
    >
      {visible.map((m) => {
        const Icon = m.icon;
        const active = mode === m.mode;
        return (
          <button
            key={m.mode}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(m.mode)}
            title={m.hint}
            className={cn(
              "inline-flex items-center gap-1 rounded-md text-xs font-medium transition-colors",
              sizePad,
              active
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
            )}
          >
            <Icon size={sizeIcon} />
            {!compact && <span className="hidden sm:inline">{m.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
