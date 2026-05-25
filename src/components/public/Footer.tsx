"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SITE_NAME, SITE_FULL_NAME, NAV_ITEMS, BUSINESS_INFO } from "@/lib/constants";
import { isExternalHref } from "@/lib/utils";
import { useSiteCta } from "@/hooks/useSiteCta";

export default function Footer() {
  const { buttonUrl: CTA_URL, buttonText: CTA_TEXT } = useSiteCta();
  const ctaOpensNewTab = isExternalHref(CTA_URL);
  return (
    <footer className="bg-brand-dark text-gray-300">
      <div className="max-w-[1440px] mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Info — 로고 이미지에 이미 'AISH' 글자가 들어 있어서
              별도 텍스트는 시각 중복. 이미지 로드 실패 시에만 텍스트 fallback. */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img
                src="/images/logo-aish-white.png"
                alt={SITE_NAME}
                className="h-8"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = "none";
                  const sibling = img.nextElementSibling as HTMLElement | null;
                  if (sibling) sibling.style.display = "inline";
                }}
              />
              <span className="hidden text-xl font-bold text-white">{SITE_NAME}</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              {SITE_FULL_NAME} - 미래를 선도하는 AI 교육 플랫폼.
              체계적인 교육과 실무 중심 연구로 AI 시대의 인재를 양성합니다.
            </p>

            {/* 사업자 정보 — 전자상거래법·개인정보보호법 필수 고지 */}
            <dl className="mt-4 space-y-1 text-[11px] leading-relaxed text-gray-500">
              <div className="flex flex-wrap gap-x-3">
                <dt className="shrink-0 text-gray-600">상호</dt>
                <dd>{BUSINESS_INFO.companyName}</dd>
                <dt className="shrink-0 text-gray-600">대표</dt>
                <dd>{BUSINESS_INFO.ceo}</dd>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <dt className="shrink-0 text-gray-600">사업자등록번호</dt>
                <dd>{BUSINESS_INFO.businessNumber}</dd>
                <dt className="shrink-0 text-gray-600">통신판매업</dt>
                <dd>{BUSINESS_INFO.mailOrderNumber}</dd>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <dt className="shrink-0 text-gray-600">주소</dt>
                <dd>{BUSINESS_INFO.address}</dd>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <dt className="shrink-0 text-gray-600">고객센터</dt>
                <dd>{BUSINESS_INFO.phone}</dd>
                <dt className="shrink-0 text-gray-600">이메일</dt>
                <dd>{BUSINESS_INFO.email}</dd>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <dt className="shrink-0 text-gray-600">개인정보 보호책임자</dt>
                <dd>{BUSINESS_INFO.privacyManager}</dd>
              </div>
            </dl>

            {/* 정책 링크 — 법적 필수 + 환불정책 */}
            <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <li>
                <Link href="/privacy" className="font-semibold text-gray-300 hover:text-white transition-colors">
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/refund" className="text-gray-400 hover:text-white transition-colors">
                  환불정책
                </Link>
              </li>
            </ul>

            <p className="mt-4 text-xs text-gray-500">
              © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">바로가기</h4>
            <ul className="space-y-2">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">수강 신청</h4>
            <p className="text-sm text-gray-400 leading-relaxed mb-5">
              AI 시대를 준비하는 가장 스마트한 방법, AISH와 함께 시작하세요.
            </p>
            <Link
              href={CTA_URL}
              target={ctaOpensNewTab ? "_blank" : undefined}
              rel={ctaOpensNewTab ? "noopener noreferrer" : undefined}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-sm bg-brand-blue text-white text-sm font-semibold hover:bg-brand-lightBlue uppercase tracking-widest transition-colors"
            >
              {CTA_TEXT}
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
