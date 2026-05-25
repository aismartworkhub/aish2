import type { Metadata } from "next";
import { BUSINESS_INFO, SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: `${SITE_NAME} 개인정보처리방침 — 수집·이용·보관·파기 절차 안내`,
};

export default function PrivacyPage() {
  return (
    <main className="container-custom max-w-3xl py-12 md:py-16">
      <h1 className="mb-2 text-2xl font-bold text-brand-blue md:text-3xl">개인정보처리방침</h1>
      <p className="mb-8 text-sm text-gray-500">최종 개정일: 2026-05-26</p>

      <article className="prose prose-sm max-w-none text-gray-700">
        <p>
          {BUSINESS_INFO.companyName}(이하 &quot;회사&quot;)는 정보주체의 자유와 권리 보호를 위해
          「개인정보 보호법」 및 관계 법령이 정한 바를 준수하여, 적법하게 개인정보를 처리하고
          안전하게 관리하고 있습니다. 이에 「개인정보 보호법」 제30조에 따라 정보주체에게
          개인정보 처리에 관한 절차 및 기준을 안내합니다.
        </p>

        <h2>1. 수집하는 개인정보 항목</h2>
        <ul>
          <li>회원가입·로그인 시: 이메일, 이름(또는 닉네임), 프로필 이미지(Google 계정 연동 시 자동 수집)</li>
          <li>프로필 보완 시(선택): 기수, 연락처</li>
          <li>커뮤니티 글 작성 시: 작성자명, 작성 내용, 첨부 파일</li>
          <li>자동 수집 항목: 접속 IP, 접속 일시, 서비스 이용 기록, 브라우저·OS 정보(쿠키, 신고 기능 사용 시 화면 캡처·DOM 스냅샷)</li>
        </ul>

        <h2>2. 개인정보의 수집·이용 목적</h2>
        <ul>
          <li>회원 식별·인증, 본인 확인</li>
          <li>교육 프로그램 안내, 강의·자료·이벤트 제공</li>
          <li>커뮤니티 운영, 댓글·후기·문의 처리</li>
          <li>서비스 개선을 위한 통계 분석 및 버그 신고 처리</li>
          <li>법령상 의무 이행, 분쟁 해결, 부정 이용 방지</li>
        </ul>

        <h2>3. 개인정보의 보관 및 이용 기간</h2>
        <ul>
          <li>회원 탈퇴 시 즉시 파기. 단, 관계 법령에 따라 보관해야 하는 경우 해당 기간 동안 보관 후 파기.</li>
          <li>전자상거래법: 계약·청약철회 기록 5년, 대금 결제 및 재화 공급 기록 5년, 소비자 불만·분쟁 처리 기록 3년</li>
          <li>통신비밀보호법: 로그 기록 3개월</li>
        </ul>

        <h2>4. 개인정보의 제3자 제공</h2>
        <p>
          회사는 정보주체의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 법령에 특별한
          규정이 있거나 수사 목적으로 법령에 따른 절차와 방법에 따라 수사기관의 요구가 있는 경우는
          예외입니다.
        </p>

        <h2>5. 개인정보 처리의 위탁</h2>
        <p>회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.</p>
        <ul>
          <li>Google LLC (Firebase Authentication, Firebase Hosting, Firestore) — 회원 인증·데이터 저장</li>
          <li>Google LLC (Google Workspace) — 이메일 송수신</li>
          <li>aish.runmoa.com — 유료 교육 수강 결제·콘텐츠 제공</li>
        </ul>

        <h2>6. 정보주체의 권리·의무 및 행사 방법</h2>
        <p>
          정보주체는 언제든지 자신의 개인정보 열람·정정·삭제·처리 정지를 요청할 수 있습니다.
          요청은 아래 개인정보 보호책임자에게 서면, 전화 또는 이메일로 하실 수 있으며 회사는
          지체 없이 조치합니다.
        </p>

        <h2>7. 개인정보의 파기 절차 및 방법</h2>
        <ul>
          <li>전자적 파일: 복구·재생할 수 없는 방법으로 영구 삭제</li>
          <li>종이 문서: 분쇄기로 분쇄하거나 소각</li>
        </ul>

        <h2>8. 개인정보의 안전성 확보 조치</h2>
        <ul>
          <li>관리적 조치: 내부 관리계획 수립·시행, 정기적 직원 교육</li>
          <li>기술적 조치: 접근권한 관리, 접근통제 시스템, 비밀번호 암호화, 보안 프로그램 설치·갱신</li>
          <li>물리적 조치: 전산실 등 출입통제</li>
        </ul>

        <h2>9. 개인정보 보호책임자</h2>
        <ul>
          <li>책임자: {BUSINESS_INFO.privacyManager}</li>
          <li>이메일: {BUSINESS_INFO.email}</li>
          <li>전화: {BUSINESS_INFO.phone}</li>
        </ul>

        <h2>10. 권익침해 구제 방법</h2>
        <p>
          정보주체는 개인정보침해로 인한 구제를 받기 위하여 개인정보분쟁조정위원회,
          한국인터넷진흥원 개인정보침해신고센터 등에 분쟁 해결이나 상담을 신청할 수 있습니다.
        </p>
        <ul>
          <li>개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)</li>
          <li>개인정보침해신고센터: 118 (privacy.kisa.or.kr)</li>
          <li>대검찰청: 1301 (www.spo.go.kr)</li>
          <li>경찰청: 182 (ecrm.cyber.go.kr)</li>
        </ul>

        <h2>11. 정책 변경에 관한 사항</h2>
        <p>
          본 개인정보처리방침은 시행일로부터 적용되며, 변경 시 변경 사항의 7일 전부터
          본 페이지를 통하여 고지합니다.
        </p>

        <p className="mt-8 text-xs text-gray-500">
          본 약관은 표준 템플릿을 기반으로 작성되었으며, 운영 전 법무 검토를 거쳐 확정됩니다.
        </p>
      </article>
    </main>
  );
}
