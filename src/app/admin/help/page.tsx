"use client";

import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";
import { EDIT_TARGETS, IMAGE_GUIDE_STEPS } from "@/lib/admin-help-content";

const TOC = [
  { id: "map", label: "어디서 무엇을 수정하나" },
  { id: "home", label: "메인 페이지 섹션" },
  { id: "image", label: "이미지 넣는 법" },
  { id: "save", label: "저장·반영 규칙" },
  { id: "faq", label: "자주 묻는 문제" },
];

export default function AdminHelpPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">도움말 — 콘텐츠·이미지 편집</h1>
        <p className="text-gray-500 mt-1">페이지와 섹션의 이미지·내용을 어디서 어떻게 바꾸는지 안내합니다.</p>
      </div>

      <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-4 mb-6 flex items-start gap-3">
        <Sparkles size={18} className="text-primary-600 mt-0.5 shrink-0" />
        <div className="text-sm text-primary-900">
          <p className="font-semibold">무엇을 어떻게 바꿀지 모르겠다면?</p>
          <p className="mt-0.5">
            <Link href="/admin/ai-assistant" className="underline font-medium">AI 도우미</Link>에게 “히어로 이미지 어디서 바꿔요?”처럼 물어보세요. 콘텐츠 문구 초안도 써 줍니다.
          </p>
        </div>
      </div>

      {/* 목차 */}
      <nav className="rounded-xl border border-gray-200 bg-white p-4 mb-8">
        <p className="text-xs font-semibold text-gray-400 mb-2">목차</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {TOC.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="text-primary-700 hover:underline">{t.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      {/* 1. 편집 화면 지도 */}
      <section id="map" className="scroll-mt-20 mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-3">1. 어디서 무엇을 수정하나</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">수정하려는 것</th>
                <th className="text-left font-medium px-4 py-2.5">메뉴 (바로가기)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {EDIT_TARGETS.map((t) => (
                <tr key={t.what} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 text-gray-800">
                    {t.what}
                    {t.note && <span className="block text-xs text-gray-400">{t.note}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={t.path} className="inline-flex items-center gap-1 text-primary-700 hover:underline">
                      {t.menu} <ExternalLink size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">현재 라이브 홈 템플릿은 커뮤니티형입니다. 섹션 설명은 커뮤니티형 기준입니다.</p>
      </section>

      {/* 2. 메인 페이지 섹션 */}
      <section id="home" className="scroll-mt-20 mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-3">2. 메인 페이지 — 섹션 표시·순서·제목·여백</h2>
        <p className="text-sm text-gray-600 mb-3">
          메뉴: <Link href="/admin/home-layout" className="text-primary-700 underline">사이트 관리 → 메인 페이지 편집</Link>
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700">
          <li>각 섹션의 <strong>표시/숨김</strong> 토글로 켜고 끄기</li>
          <li><strong>▲▼</strong> 버튼으로 위아래 순서 바꾸기</li>
          <li>일부 섹션은 <strong>제목·설명</strong>을 직접 입력(교육 프로그램, AI실전마스터, 회원 혜택, Insight, 후기, 이벤트 등)</li>
          <li><strong>상단/하단 여백(px)</strong>은 비우면 기본값, 숫자를 넣으면 그만큼 간격 조정</li>
          <li>맨 아래 <strong>저장하기</strong></li>
        </ol>
        <p className="text-sm text-gray-500 mt-3 rounded-lg bg-gray-50 border border-gray-100 p-3">
          여기서는 섹션의 <strong>틀</strong>(표시·순서·헤딩·간격)을 바꿉니다. 섹션 <strong>안의 내용</strong>(강사·프로그램·후기 등)은 위 1번 표의 각 메뉴에서 바꿉니다.
        </p>
      </section>

      {/* 3. 이미지 */}
      <section id="image" className="scroll-mt-20 mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-3">3. 이미지 넣는 법</h2>
        <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-700">
          {IMAGE_GUIDE_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      {/* 4. 저장 */}
      <section id="save" className="scroll-mt-20 mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-3">4. 저장·반영 규칙</h2>
        <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-700">
          <li>각 화면의 <strong>저장하기</strong>를 눌러야 반영됩니다.</li>
          <li>공개 페이지는 약 30초 캐시가 있습니다. 바로 확인하려면 <strong>강제 새로고침</strong>(Cmd/Ctrl+Shift+R).</li>
          <li>모바일은 화면을 아래로 당겨(풀투리프레시) 갱신할 수 있습니다.</li>
        </ul>
      </section>

      {/* 5. FAQ */}
      <section id="faq" className="scroll-mt-20 mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-3">5. 자주 묻는 문제</h2>
        <dl className="space-y-3 text-sm">
          {[
            ["이미지가 안 보임 / '미리보기 불러올 수 없음'", "드라이브 파일을 '링크가 있는 모든 사용자'로 공개했는지 확인. 비공개·삭제·오타 점검."],
            ["저장했는데 공개 화면이 그대로", "강제 새로고침(캐시). 시크릿 창에서도 확인."],
            ["섹션 제목을 페이지 관리에서 바꿨는데 홈에 안 바뀜", "홈 섹션 제목은 '메인 페이지 편집'에서 바꿉니다."],
            ["회원 혜택 항목 내용을 바꾸고 싶음", "항목 자체는 코드 고정 → 개발 반영 필요(제목/설명만 편집 가능)."],
          ].map(([q, a]) => (
            <div key={q} className="rounded-lg border border-gray-200 bg-white p-3">
              <dt className="font-semibold text-gray-800">{q}</dt>
              <dd className="text-gray-600 mt-0.5">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
