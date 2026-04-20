"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { HELP_TEXTS } from "@/lib/help-texts";

interface HelpTipProps {
  id: string;
  className?: string;
}

export default function HelpTip({ id, className }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const text = HELP_TEXTS[id];

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!text) return null;

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-0.5 rounded-full text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
        aria-label="도움말"
      >
        <HelpCircle size={16} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg text-sm text-gray-700 leading-relaxed animate-in fade-in slide-in-from-top-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 p-1 rounded-lg hover:bg-gray-100 text-gray-400"
            aria-label="닫기"
          >
            <X size={14} />
          </button>
          {text}
        </div>
      )}
    </div>
  );
}
