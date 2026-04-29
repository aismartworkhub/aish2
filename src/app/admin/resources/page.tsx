"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderOpen, Sparkles } from "lucide-react";
import Link from "next/link";

const TARGET = "/admin/contents?boardKey=media-resource";
const REDIRECT_AFTER_MS = 3000;

/**
 * /admin/resources 는 `/admin/contents?boardKey=media-resource`로 통합되었습니다.
 * 짧은 안내 후 자동 리다이렉트. 직접 클릭 가능한 버튼도 제공.
 */
export default function AdminResourcesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const t = window.setTimeout(() => {
      router.replace(TARGET);
    }, REDIRECT_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-8 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
          <FolderOpen size={28} className="text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          교육자료 관리가 통합 콘텐츠로 이전됐습니다
        </h1>
        <p className="text-sm text-gray-600 mb-1">
          이제 <strong>통합 콘텐츠 관리</strong> 화면에서 보드 필터로 자료를 관리합니다.
        </p>
        <p className="text-xs text-gray-500 mb-6">
          Google Drive 직접 업로드 기능은 그대로 사용 가능합니다.
        </p>

        <Link
          href={TARGET}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Sparkles size={14} />
          지금 이동
          <ArrowRight size={14} />
        </Link>
        <p className="mt-4 text-xs text-gray-400">
          {Math.ceil(REDIRECT_AFTER_MS / 1000)}초 후 자동 이동됩니다…
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 space-y-2">
        <p className="font-semibold text-gray-900">왜 통합되었나요?</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>레거시 <code className="rounded bg-gray-100 px-1">resources</code> 컬렉션의 자료가 이미 통합 콘텐츠(<code className="rounded bg-gray-100 px-1">contents</code>, boardKey: <code className="rounded bg-gray-100 px-1">media-resource</code>)로 마이그레이션되었습니다.</li>
          <li>한 곳에서 영상·이미지·자료·게시글을 모두 관리할 수 있습니다.</li>
          <li>Drive 업로드는 통합 화면의 자료 보드 선택 시 자동 노출됩니다.</li>
        </ul>
      </div>
    </div>
  );
}
