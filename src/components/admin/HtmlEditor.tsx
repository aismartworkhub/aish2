"use client";

import { useState } from "react";
import DOMPurify from "dompurify";
import { Eye, Code } from "lucide-react";
import { cn } from "@/lib/utils";

type HtmlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
};

export function HtmlEditor({
  value,
  onChange,
  placeholder = "HTML을 입력하세요...",
  rows = 6,
  label,
}: HtmlEditorProps) {
  const [preview, setPreview] = useState(false);

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1 mb-1">
        <button
          type="button"
          onClick={() => setPreview(false)}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
            !preview ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Code size={12} /> 편집
        </button>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
            preview ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Eye size={12} /> 미리보기
        </button>
      </div>
      {preview ? (
        <div
          className="w-full min-h-[120px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-y"
        />
      )}
      <p className="mt-1 text-xs text-gray-400">
        HTML 태그를 사용할 수 있습니다. 미리보기에서 DOMPurify로 안전하게 렌더링됩니다.
      </p>
    </div>
  );
}
