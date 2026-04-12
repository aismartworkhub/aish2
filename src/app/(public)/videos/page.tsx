"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /videos → /media 리다이렉트 (하위 호환)
 * 기존 URL 북마크/링크가 깨지지 않도록 유지.
 */
export default function VideosRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/media");
  }, [router]);

  return (
    <div className="py-20 text-center text-sm text-gray-400">
      콘텐츠 페이지로 이동 중...
    </div>
  );
}
