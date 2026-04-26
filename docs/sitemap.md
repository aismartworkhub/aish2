# AISH 사이트 맵

> 사이트명: **AISH (AI Smart Hub)** · 한국어 인터페이스 · 정적 빌드(`output: "export"`) + Firebase Hosting
> 관련 문서: [기능 설명서](./features.md), [관리자 ↔ 공개 점검표](./admin-public-matrix.md)

---

## 1. 공개 페이지 (`src/app/(public)`)

| 경로 | 파일 | 설명 |
|------|------|------|
| `/` | [src/app/(public)/page.tsx](../src/app/(public)/page.tsx) | 홈. 히어로 · 실적 · CTA · 배너 · 공지/프로그램/영상/후기 요약 |
| `/about` | [src/app/(public)/about/page.tsx](../src/app/(public)/about/page.tsx) | 미션/가치, 팀, 파트너, 연혁 |
| `/programs` | [src/app/(public)/programs/page.tsx](../src/app/(public)/programs/page.tsx) | 교육 프로그램 목록/필터 (Runmoa 연동) |
| `/instructors` | [src/app/(public)/instructors/page.tsx](../src/app/(public)/instructors/page.tsx) | AI실전마스터(강사) 소개 + 강사 지원 |
| `/media` | [src/app/(public)/media/page.tsx](../src/app/(public)/media/page.tsx) | 통합 콘텐츠 허브 (강의/인터뷰/홍보/영상) |
| `/workathon` | [src/app/(public)/workathon/page.tsx](../src/app/(public)/workathon/page.tsx) | 스마트 워커톤 상세/일정/결과 |
| `/community` | [src/app/(public)/community/page.tsx](../src/app/(public)/community/page.tsx) | 커뮤니티 게시판 · 공지 · FAQ |
| `/profile` | [src/app/(public)/profile/page.tsx](../src/app/(public)/profile/page.tsx) | 내 프로필 (기수/회사/관심사/Gemini API 키) |
| `/videos` | [src/app/(public)/videos/page.tsx](../src/app/(public)/videos/page.tsx) | 레거시 영상 목록 (통합 예정) |
| `/login` | [src/app/login/page.tsx](../src/app/login/page.tsx) | Firebase 구글 로그인 |

### 공개 레이아웃 구성 ([src/app/(public)/layout.tsx](../src/app/(public)/layout.tsx))

- `Header` (네비/로그인)
- `QuickBannerDisplay` (활성 배너)
- `ProfileCompletionBanner` (프로필 미완 안내)
- 본문
- `FloatingCta` (`siteSettings/cta` 기반 고정 CTA)
- `AiCounselor` (AI 챗 위젯)
- `Footer`
- `LoginModal` (Providers에서 렌더)

---

## 2. 관리자 페이지 (`src/app/admin`)

> 진입: `/admin` · `AuthGuard`로 `superadmin` / `admin` 역할만 접근
> 레이아웃: 좌측 `AdminSidebar` + 상단 `AdminHeader` ([src/app/admin/layout.tsx](../src/app/admin/layout.tsx))
> 메뉴 정의 원본: [src/components/admin/AdminSidebar.tsx](../src/components/admin/AdminSidebar.tsx) `NAV_GROUPS`

### 대시보드

| 메뉴 | 경로 | 파일 | 주요 컬렉션 |
|------|------|------|-------------|
| 대시보드 | `/admin` | [src/app/admin/page.tsx](../src/app/admin/page.tsx) | (요약 통계) |

### 콘텐츠 관리

| 메뉴 | 경로 | 파일 | 주요 컬렉션 |
|------|------|------|-------------|
| 통합 콘텐츠 | `/admin/contents` | [src/app/admin/contents/page.tsx](../src/app/admin/contents/page.tsx) | `contents`, `boards`, `contentComments` |
| AI 콘텐츠 | `/admin/ai-content` | [src/app/admin/ai-content/page.tsx](../src/app/admin/ai-content/page.tsx) | `contents`, `aiCollectorHistory`, `boards` |
| 게시판 설정 | `/admin/boards` | [src/app/admin/boards/page.tsx](../src/app/admin/boards/page.tsx) | `boards`, `contents` |
| 교육자료 | `/admin/resources` | [src/app/admin/resources/page.tsx](../src/app/admin/resources/page.tsx) | `resources` |

### 교육 운영

| 메뉴 | 경로 | 파일 | 주요 컬렉션 |
|------|------|------|-------------|
| 프로그램 관리 | `/admin/programs` | [src/app/admin/programs/page.tsx](../src/app/admin/programs/page.tsx) | `programs` |
| 강사 관리 | `/admin/instructors` | [src/app/admin/instructors/page.tsx](../src/app/admin/instructors/page.tsx) | `instructors`, `instructorComments` |
| 수료증 | `/admin/certificates` | [src/app/admin/certificates/page.tsx](../src/app/admin/certificates/page.tsx) | `certificateCohorts`, `certificateGraduates`, `certificateRequests` |
| 스마트워크톤 | `/admin/workathon` | [src/app/admin/workathon/page.tsx](../src/app/admin/workathon/page.tsx) | `events` (→ /workathon 공개 1건) |
| 일반 행사 | `/admin/event` | [src/app/admin/event/page.tsx](../src/app/admin/event/page.tsx) | `adminEvents` (→ 홈 "진행 예정 행사") |

### 커뮤니티

| 메뉴 | 경로 | 파일 | 주요 컬렉션 |
|------|------|------|-------------|
| 문의 관리 | `/admin/inquiries` | [src/app/admin/inquiries/page.tsx](../src/app/admin/inquiries/page.tsx) | `inquiries` |

### 사이트 관리

| 메뉴 | 경로 | 파일 | 주요 컬렉션 |
|------|------|------|-------------|
| 사이트 설정 | `/admin/settings` | [src/app/admin/settings/page.tsx](../src/app/admin/settings/page.tsx) | `siteSettings`, `banners` |
| ├ 섹션 표시 | `/admin/settings?tab=sections` | 〃 | `siteSettings/features` (섹션 ON/OFF) |
| ├ 히어로 섹션 | `/admin/settings?tab=hero` | 〃 | `siteSettings/hero` |
| ├ 실적 수치 | `/admin/settings?tab=stats` | 〃 | `siteSettings/stats` |
| ├ CTA 설정 | `/admin/settings?tab=cta` | 〃 | `siteSettings/cta` |
| ├ 배너 관리 | `/admin/settings?tab=banner` | 〃 | `siteSettings/banner` |
| └ 기능 플래그 (Phase) | `/admin/settings?tab=phases` | 〃 | `siteSettings/featureFlags` |
| 퀵배너 관리 | `/admin/banners` | [src/app/admin/banners/page.tsx](../src/app/admin/banners/page.tsx) | `banners` |
| 페이지 관리 | `/admin/pages` | [src/app/admin/pages/page.tsx](../src/app/admin/pages/page.tsx) | `siteSettings/page_*` |
| 파트너 | `/admin/partners` | [src/app/admin/partners/page.tsx](../src/app/admin/partners/page.tsx) | `partners`, `partnerApplications` |
| 연혁 | `/admin/history` | [src/app/admin/history/page.tsx](../src/app/admin/history/page.tsx) | `history` |

### 사용자 관리

| 메뉴 | 경로 | 파일 | 주요 컬렉션 |
|------|------|------|-------------|
| 관리자 | `/admin/admins` | [src/app/admin/admins/page.tsx](../src/app/admin/admins/page.tsx) | `admins` |
| 회원관리 | `/admin/users` | [src/app/admin/users/page.tsx](../src/app/admin/users/page.tsx) | `users` |

### 레거시 (통합 예정)

| 메뉴 | 경로 | 파일 | 주요 컬렉션 | 이관 방향 |
|------|------|------|-------------|-----------|
| 게시판 (구) | `/admin/posts` | [src/app/admin/posts/page.tsx](../src/app/admin/posts/page.tsx) | `posts`, `postComments` | → 통합 콘텐츠 |
| 공지사항 | `/admin/posts?type=NOTICE` | 〃 | `posts` (NOTICE 타입) | → 통합 콘텐츠 (공지 게시판) |
| 영상 관리 (구) | `/admin/videos` | [src/app/admin/videos/page.tsx](../src/app/admin/videos/page.tsx) | `videos` | → 통합 콘텐츠 (media 타입) |
| 후기 관리 (구) | `/admin/reviews` | [src/app/admin/reviews/page.tsx](../src/app/admin/reviews/page.tsx) | `reviews` | → 통합 콘텐츠 |
| FAQ (구) | `/admin/faq` | [src/app/admin/faq/page.tsx](../src/app/admin/faq/page.tsx) | `faq` | → 게시판(faq 레이아웃) |
| 갤러리 (구) | `/admin/gallery` | [src/app/admin/gallery/page.tsx](../src/app/admin/gallery/page.tsx) | `gallery` | → 통합 콘텐츠 |

---

## 3. 접근 제어 요약

| 대상 | 접근 가능 역할 | 가드 |
|------|----------------|------|
| `/admin/*` | `superadmin`, `admin` | `AuthGuard` (클라이언트) |
| `/profile` | 로그인 사용자 | `AuthGuard` 또는 `useLoginGuard` |
| 공개 페이지 내 보호 액션 (댓글·북마크·문의 등) | 로그인 사용자 | `useLoginGuard` + `LoginModal` |
| 기타 공개 페이지 | 비로그인 포함 | — |

슈퍼관리자 이메일: `aismartworkhub@gmail.com` (하드코딩, 변경 불가)

---

## 4. Firestore 컬렉션 (원본: [src/lib/firestore.ts](../src/lib/firestore.ts) `COLLECTIONS`)

**콘텐츠/게시판**: `contents`, `contentComments`, `boards`, `aiCollectorHistory`, `resources`
**레거시 게시판**: `posts`, `postComments`, `videos`, `reviews`, `faq`, `gallery`
**교육**: `programs`, `instructors`, `instructorComments`, `certificateCohorts`, `certificateGraduates`, `certificateRequests`, `courseProposals`
**행사**: `events`, `adminEvents`
**사이트 설정**: `siteSettings` (문서 ID: `hero`, `stats`, `cta`, `banner`, `features`, `page_*`), `banners`
**관계 콘텐츠**: `partners`, `partnerApplications`, `history`
**커뮤니티/소통**: `inquiries`, `likes`, `bookmarks`, `reactions`, `notifications`
**사용자**: `users`, `admins`

**기업마당 M89uUd**
   


