import type { Metadata } from "next";
import { BUSINESS_INFO, SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "환불정책",
  description: `${SITE_NAME} 유료 강의 환불 규정 안내`,
};

export default function RefundPage() {
  return (
    <main className="container-custom max-w-3xl py-12 md:py-16">
      <h1 className="mb-2 text-2xl font-bold text-brand-blue md:text-3xl">환불정책</h1>
      <p className="mb-8 text-sm text-gray-500">최종 개정일: 2026-05-26</p>

      <article className="prose prose-sm max-w-none text-gray-700">
        <p>
          {BUSINESS_INFO.companyName}(이하 &quot;회사&quot;)가 제공하는 유료 강의의 환불 규정은
          「전자상거래 등에서의 소비자보호에 관한 법률」 및 관련 법령을 준수합니다.
          실제 결제·수강·환불 처리는 외부 수강 플랫폼{" "}
          <a href="https://aish.runmoa.com/" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">
            aish.runmoa.com
          </a>{" "}
          을 통해 진행됩니다.
        </p>

        <h2>1. 청약 철회 (수강 시작 전)</h2>
        <ul>
          <li>결제일로부터 7일 이내 + 강의를 한 차시도 수강하지 않은 경우: <strong>100% 환불</strong></li>
          <li>강의 콘텐츠가 단방향 다운로드 자료 형태인 경우, 다운로드 시점부터 청약 철회 제한</li>
        </ul>

        <h2>2. 학습 진행 중 환불 (강의 시작 후)</h2>
        <table>
          <thead>
            <tr>
              <th>경과 비율</th>
              <th>환불 금액</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>10% 미만 수강</td>
              <td>결제 금액의 90% 환불</td>
            </tr>
            <tr>
              <td>10% 이상 ~ 30% 미만</td>
              <td>결제 금액의 70% 환불</td>
            </tr>
            <tr>
              <td>30% 이상 ~ 50% 미만</td>
              <td>결제 금액의 50% 환불</td>
            </tr>
            <tr>
              <td>50% 이상</td>
              <td>환불 불가</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-500">
          ※ 라이브·오프라인 강의의 경우 회차별 환불 기준이 별도로 적용될 수 있으며, 각 강의 상세
          페이지의 안내를 우선합니다.
        </p>

        <h2>3. 환불 불가 사유</h2>
        <ul>
          <li>강의를 50% 이상 수강한 경우</li>
          <li>다운로드 가능한 디지털 콘텐츠를 수령한 경우</li>
          <li>강의·자료를 무단으로 복제·배포한 사실이 확인된 경우</li>
          <li>이벤트·할인·쿠폰 등의 부가 혜택으로 무상 또는 할인 제공된 강의</li>
        </ul>

        <h2>4. 환불 신청 방법</h2>
        <ol>
          <li>외부 수강 플랫폼(<a href="https://aish.runmoa.com/" target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">aish.runmoa.com</a>)에 로그인</li>
          <li>마이페이지 → 수강 내역 → 해당 강의 → &quot;환불 신청&quot;</li>
          <li>또는 회사 고객센터로 직접 문의 (이메일·전화)</li>
        </ol>

        <h2>5. 환불 처리 기간</h2>
        <p>
          환불 신청일로부터 영업일 기준 3~7일 이내에 결제 수단별 환불 절차에 따라 처리됩니다.
          카드 결제의 경우 카드사 정책에 따라 환불 반영까지 추가 시일이 소요될 수 있습니다.
        </p>

        <h2>6. 회사의 귀책 사유로 인한 환불</h2>
        <p>
          강의 운영 중단, 강사 변경, 콘텐츠 누락 등 회사의 귀책 사유로 정상 수강이 어려운 경우
          수강 진척률과 무관하게 <strong>잔여 강의에 해당하는 비용을 전액 환불</strong>합니다.
        </p>

        <h2>7. 고객센터</h2>
        <ul>
          <li>이메일: {BUSINESS_INFO.email}</li>
          <li>전화: {BUSINESS_INFO.phone}</li>
          <li>운영 시간: 평일 10:00 ~ 18:00 (주말·공휴일 휴무)</li>
        </ul>

        <p className="mt-8 text-xs text-gray-500">
          본 환불정책은 표준 템플릿을 기반으로 작성되었으며, 운영 전 법무 검토를 거쳐 확정됩니다.
          개별 강의의 환불 규정이 본 정책과 다를 경우 강의 상세 페이지의 안내가 우선합니다.
        </p>
      </article>
    </main>
  );
}
