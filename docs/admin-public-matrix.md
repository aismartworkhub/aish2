# 관리자 ↔ 공개 페이지 점검표

`siteSettings` 문서 ID는 `COLLECTIONS.SETTINGS` (`siteSettings`) 기준.

| 관리자 메뉴 | Firestore | 공개 소비처 | 기대 동작 |
|-------------|-----------|-------------|-----------|
| 대시보드 | `siteSettings/stats` (참고) | 홈 통계 블록 | Firestore `stats`와 동일 소스 |
| 사이트 설정 · 히어로 | `siteSettings/hero` | `(public)/page.tsx` 히어로 | 활성 슬라이드만, 없으면 기본 1슬라이드 |
| 사이트 설정 · 실적 | `siteSettings/stats` | 홈 통계 | `items` 배열 반영 |
| 사이트 설정 · CTA | `siteSettings/cta` | 홈 버튼, `FloatingCta` | `buttonUrl`/`buttonText`, `floatingEnabled` |
| 사이트 설정 · 배너 | `siteSettings/banner` | 홈 D-day 배너 영역 | `enabled`/문구/링크 |
| 퀵배너 | `banners` | `QuickBannerDisplay` | `isActive`, 기간, `targetPages` |
| 프로그램 | `programs` | 홈, `/programs` | 공개: `status !== CLOSED` (또는 관리자만 전체) |
| 강사 | `instructors` | `/instructors` | `isActive !== false`, `displayOrder` |
| 게시판 | `posts` | 홈 공지, `/community` | 타입별 필터, 공지는 `NOTICE` |
| 영상 | `videos` | 홈 피처, `/videos` | 공개 정책에 맞는 필터 |
| 후기 | `reviews` | 홈 | `isApproved !== false` |
| 행사 | `events` | 홈, `/workathon` | 기본: 최신 또는 단일 이벤트 정책 |
| FAQ | `faq` | `/community` | Firestore 우선, 정렬 |
| 문의 | `inquiries` | (폼만) | 클라이언트 쓰기 규칙 준수, 목록은 관리자만 |
| 갤러리 | `gallery` | `/about` 등 | 공개 페이지 정책과 일치 |
| 파트너 | `partners` | `/about` | `isActive` |
| 연혁 | `history` | `/about` | 정렬 순 |
| 수료증 | `certificateCohorts`, `certificateGraduates` | `/admin` 전용 조회 위주 | 공개 조회 UI 시 규칙 재검토 |
| 관리자·회원 | `admins`, `users` | 없음 | `AuthGuard`만 |

구현 시 이 표와 코드를 함께 갱신한다.

## 구현 요약 (2026-03)

- `siteSettings`: 공개 홈·`FloatingCta`·`Header`·워크톤 하단 CTA는 `loadSiteCta()` / `useSiteCta()`로 `siteSettings/cta` 반영. 히어로·교육/스페셜 이미지·상단 D-day 배너는 `(public)/page.tsx`에서 `hero`·`banner` 문서 로드.
- 프로그램 목록: `CLOSED` 제외. 강사: `isActive`·`displayOrder`. 홈/워크톤: 이벤트 `eventDate` 기준 최신 1건. 영상: 유튜브 URL 있는 항목 우선·날짜 정렬. FAQ: `displayOrder` 정렬. 갤러리: `date` 내림차순.
