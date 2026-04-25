"use client";

import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** 이 페이지의 표시 이름 (예: "게시판 관리", "영상 관리") */
  legacyName: string;
  /** 이 페이지가 사용하는 레거시 컬렉션명 (예: "posts", "videos") */
  legacyCollection?: string;
  /** 통합 콘텐츠로 이전할 보드 키 (예: "community-notice", "media-lecture") */
  targetBoardKey?: string;
  /** 통합 콘텐츠로 이전했을 때 노출되는 공개 페이지 (예: "/community", "/media") */
  publicPath?: string;
};

export default function LegacyMigrationBanner({
  legacyName,
  legacyCollection,
  targetBoardKey,
  publicPath,
}: Props) {
  const href = targetBoardKey
    ? `/admin/contents?board=${targetBoardKey}`
    : "/admin/contents";

  return (
    <div className={cn(
      "mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3",
    )}>
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="flex-1 text-sm text-amber-800 space-y-1">
          <p>
            <strong>{legacyName}</strong>은 레거시 페이지입니다.
            {legacyCollection && (
              <> 이 화면의 데이터는 <code className="rounded bg-amber-100 px-1 text-xs">{legacyCollection}</code> 컬렉션에 저장되며, 통합 콘텐츠(<code className="rounded bg-amber-100 px-1 text-xs">contents</code>)로 자동 동기화되지 않습니다.</>
            )}
          </p>
          <p>
            신규 글은 <Link href={href} className="font-semibold underline">통합 콘텐츠 관리
            {targetBoardKey && <> → <code className="rounded bg-amber-100 px-1 text-xs">{targetBoardKey}</code> 보드</>}
            </Link>에서 작성하세요.
            {publicPath && (
              <> 작성한 글은 <a href={publicPath} target="_blank" rel="noopener noreferrer" className="font-medium underline">{publicPath}</a>에 노출됩니다.</>
            )}
          </p>
          <p className="text-xs opacity-75">
            기존 데이터는 <Link href="/admin/boards" className="underline">/admin/boards</Link>의 <strong>&quot;데이터 마이그레이션&quot;</strong> 버튼으로 일괄 이전 가능합니다. 이전 후 운영 검증을 거쳐 <strong>곧 이 페이지의 작성·수정 버튼이 비활성화될 예정</strong>입니다.
          </p>
        </div>
        <Link
          href={href}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white",
            "hover:bg-amber-700 transition-colors",
          )}
        >
          통합 관리로 이동 <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
