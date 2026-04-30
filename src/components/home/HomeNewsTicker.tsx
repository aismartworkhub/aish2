"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Newspaper, ChevronRight } from "lucide-react";

type Notice = { id: string; tag: string; title: string; date: string };

/**
 * 히어로 직하에 배치되는 얇은 NewsRoom 헤드라인 띠.
 * - 최신 1건을 회전 노출(items.length > 1일 때 5초 간격)
 * - 클릭 시 동일 페이지의 #newsroom 앵커로 부드러운 스크롤
 * - 모바일에서도 1줄 컴팩트
 */
export default function HomeNewsTicker({ items }: { items: Notice[] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;

  const current = items[idx] ?? items[0];
  const targetHref = current.id
    ? `/community?tab=notice&postId=${current.id}`
    : "/community?tab=notice";

  return (
    <div className="relative z-20 border-b border-brand-border bg-white/95 backdrop-blur">
      <div className="container-custom flex items-center gap-3 py-3">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-bold text-brand-blue">
          <Newspaper className="h-3.5 w-3.5" />
          최신 소식
        </span>
        <Link
          href={targetHref}
          className="group flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-700 hover:text-brand-blue transition-colors"
        >
          <span className="shrink-0 font-medium text-brand-blue">[{current.tag}]</span>
          <span className="truncate">{current.title}</span>
          <span className="ml-auto hidden shrink-0 text-xs text-gray-400 sm:inline">{current.date}</span>
        </Link>
        <a
          href="#newsroom"
          aria-label="NewsRoom 섹션으로 이동"
          className="hidden shrink-0 items-center gap-1 text-xs text-gray-500 hover:text-brand-blue md:inline-flex"
        >
          모두 보기 <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
