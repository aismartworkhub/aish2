# UI z-index 매트릭스

AISH 공개 페이지의 모든 fixed/absolute 컴포넌트의 z-index 계층. 새 모달·플로팅 위젯 추가 시 이 표를 보고 충돌 없이 배치할 것.

## 계층표 (낮음 → 높음)

| z | 컴포넌트 | 위치 | 파일 |
|---:|---|---|---|
| 30 | `/media` Pull-to-refresh 인디케이터 | fixed top-16 (모바일) | [src/app/(public)/media/page.tsx](../src/app/(public)/media/page.tsx) |
| 40 | FloatingCta (스크롤-업 버튼·모바일 CTA 링크) | fixed bottom-24 right-4 / lg+ bottom-6 | [src/components/public/FloatingCta.tsx](../src/components/public/FloatingCta.tsx) |
| 45 | AiCounselor 토글 버튼 (닫힘 상태) | fixed bottom-44 right-4 / lg+ bottom-6 | [src/components/public/AiCounselor.tsx](../src/components/public/AiCounselor.tsx) |
| 50 | Header (상단 네비) | fixed top-0 (모바일 스크롤 다운 시 자동 숨김) | [src/components/public/Header.tsx](../src/components/public/Header.tsx) |
| 50 | BottomTabNav (모바일 5슬롯) | fixed bottom-0 (모바일 스크롤 다운 시 자동 숨김) | [src/components/public/BottomTabNav.tsx](../src/components/public/BottomTabNav.tsx) |
| 50 | Header 알림 드롭다운 / 사용자 메뉴 | absolute (Header 내) | [src/components/public/Header.tsx](../src/components/public/Header.tsx) |
| 55 | BottomTabNav 글쓰기 시트 | fixed inset-0 (모바일) | [src/components/public/BottomTabNav.tsx](../src/components/public/BottomTabNav.tsx) |
| 60 | ContentDetailModal | fixed inset-0 | [src/components/content/ContentDetailModal.tsx](../src/components/content/ContentDetailModal.tsx) |
| 65 | AiCounselor 채팅 모달 | fixed inset-0 (Sprint A에서 z-60→65 상향) | [src/components/public/AiCounselor.tsx](../src/components/public/AiCounselor.tsx) |
| 100 | LoginModal | fixed inset-0 | [src/components/public/LoginModal.tsx](../src/components/public/LoginModal.tsx) |
| 9999 | Toast | fixed (글로벌) | [src/components/ui/Toast.tsx](../src/components/ui/Toast.tsx) |

## 설계 원칙

1. **30~45**: 비차단 플로팅 위젯 (스크롤·클릭 가능)
2. **50**: 페이지 네비 (Header, BottomTabNav). 모바일에서 자동 숨김.
3. **55**: 네비 위로 확장되는 시트 (글쓰기 시트 등)
4. **60~65**: 콘텐츠 모달 (영상·이미지·AI 챗). 화면 가운데 또는 우하단.
5. **100**: 인증 모달 — 다른 모든 모달 위에서 로그인 유도
6. **9999**: Toast — 어떤 인터랙션도 가리지 않도록 최상위

## 주의사항

- **새 모달 추가 시**: 60(데이터 콘텐츠) / 65(AI·기능 모달) 중 의미에 맞게 선택
- **스크롤 자동 숨김 대상**: Header·BottomTabNav만. 모달이 열린 상태에서는 nav 자동 숨김 비활성 (글쓰기 시트는 BottomTabNav 내부에서 처리, 다른 모달은 nav z=50 위 z=60+이라 자연 가려짐)
- **모바일 우하단 클러스터**: BottomTabNav(z-50, bottom-0) → FloatingCta(z-40, bottom-24) → AiCounselor 버튼(z-45, bottom-44) 수직 스택. 데스크톱(lg+)에서는 FloatingCta·AiCounselor 모두 bottom-6으로 단일 위치.

## 변경 이력

- **2026-04-26**: AiCounselor 모달 z-60 → z-65 (Sprint A). ContentDetailModal과 분리.
- 동일 시점 신규: BottomTabNav z-50, ActionCluster wrapper, /media PTR 인디케이터 z-30.
