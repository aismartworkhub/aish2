import Link from "next/link";
import { Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="max-w-md text-center">
        <p className="text-6xl font-bold text-brand-blue mb-2">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          요청하신 페이지가 삭제되었거나 주소가 변경되었습니다.<br />
          홈 또는 콘텐츠 허브에서 다시 찾아보세요.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition-colors"
          >
            <Home size={16} />
            메인으로
          </Link>
          <Link
            href="/media"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Compass size={16} />
            콘텐츠 허브
          </Link>
        </div>
      </div>
    </div>
  );
}
