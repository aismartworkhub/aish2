"use client";

import { useState } from "react";
import { Bold, Italic, List, Link, Eye, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";

interface SimpleHtmlEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
}

const TOOLBAR_ITEMS = [
  { icon: Bold, tag: "b", label: "굵게" },
  { icon: Italic, tag: "i", label: "기울임" },
  { icon: List, tag: "ul", label: "목록" },
  { icon: Link, tag: "a", label: "링크" },
] as const;

export function SimpleHtmlEditor({
  value,
  onChange,
  placeholder = "내용을 입력하세요...",
  rows = 10,
}: SimpleHtmlEditorProps) {
  const [preview, setPreview] = useState(false);

  const insertTag = (tag: string) => {
    if (tag === "a") {
      const url = prompt("링크 URL을 입력하세요:");
      if (!url) return;
      const text = prompt("링크 텍스트를 입력하세요:") || url;
      onChange(value + `<a href="${url}" target="_blank">${text}</a>`);
      return;
    }
    if (tag === "ul") {
      onChange(value + "\n<ul>\n  <li>항목</li>\n</ul>\n");
      return;
    }
    onChange(value + `<${tag}></${tag}>`);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        {TOOLBAR_ITEMS.map(({ icon: Icon, tag, label }) => (
          <button
            key={tag}
            type="button"
            onClick={() => insertTag(tag)}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
            title={label}
            aria-label={label}
          >
            <Icon size={14} />
          </button>
        ))}

        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setPreview(!preview)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
            preview
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:bg-gray-200",
          )}
          aria-label={preview ? "편집 모드" : "미리보기"}
        >
          {preview ? <Code size={12} /> : <Eye size={12} />}
          {preview ? "편집" : "미리보기"}
        </button>
      </div>

      {preview ? (
        <div
          className="p-4 min-h-[200px] prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(value || "<p class='text-gray-400'>내용이 없습니다.</p>"),
          }}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-4 py-3 text-sm resize-none focus:outline-none placeholder:text-gray-400 font-mono"
        />
      )}
    </div>
  );
}
