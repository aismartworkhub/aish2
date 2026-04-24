# AISH 기능 설명서

> 각 페이지/메뉴가 하는 일과 읽고 쓰는 데이터 소스 정리.
> 관련 문서: [사이트 맵](./sitemap.md), [관리자 ↔ 공개 점검표](./admin-public-matrix.md)

---

## 1. 공통 아키텍처

### 1.1 인증 · 역할

- **인증**: Firebase Auth (Google 로그인)
- **프로필 저장소**: `users` 컬렉션
- **역할**: `superadmin` · `admin` · `member` · `user` · `premium`
  - `ADMIN_ROLES = ["superadmin", "admin"]` — `/admin` 접근 허용
  - 슈퍼관리자 이메일: `aismartworkhub@gmail.com` (하드코딩)
- **관리자 계정**: `admins` 컬렉션에서 별도로 관리 (활성/비활성, 편집자 등급 포함)

### 1.2 접근 가드

| 컴포넌트/훅 | 용도 |
|-------------|------|
| `AuthGuard` | `/admin/*` 전체 보호. 로딩 → 비활성 안내 → 권한 없음 → 통과 순 상태 머신 |
| `useLoginGuard()` | 공개 페이지 액션 가드. `requireLogin(action, message?)` 호출 시 비로그인은 `LoginModal` 노출 |
| `AuthContext` | 프로필을 localStorage에 24h 캐시, 새로고침 시 빠른 초기화 |

### 1.3 데이터 레이어

- **SDK**: Firestore 클라이언트 SDK (정적 빌드 제약상 서버 API 없음)
- **CRUD 헬퍼** ([src/lib/firestore.ts](../src/lib/firestore.ts)): `getCollection`, `createDoc`, `upsertDoc`, `updateDocFields`, `removeDoc`
- **읽기 훅**: `useFirestoreCollection` — SWR 패턴, **30s TTL 인메모리 캐시**, 정렬 함수 옵션 지원
- **데모 데이터 폴백** ([src/lib/demo-data.ts](../src/lib/demo-data.ts)): Firestore 응답이 비어 있으면 기본 데이터 렌더 (공개 페이지 위주)
- **관리자 공통 UI**: `AdminLoading`, `AdminError` ([src/components/admin/AdminLoadingState.tsx](../src/components/admin/AdminLoadingState.tsx))

### 1.4 사이트 공통 영역

| 영역 | 설정 소스 | 구현 |
|------|-----------|------|
| 헤더/네비 | `siteSettings/features` | `Header` |
| 플로팅 CTA | `siteSettings/cta` | `FloatingCta` + `useSiteCta()` |
| 상단/하단 퀵배너 | `banners` | `QuickBannerDisplay` |
| 홈 히어로 | `siteSettings/hero` | 활성 슬라이드만, 없으면 기본 1슬라이드 |
| 홈 배너 | `siteSettings/banner` | D-day 배너 |
| 프로필 미완 안내 | `users` | `ProfileCompletionBanner` |
| AI 챗 | — | `AiCounselor` 위젯 |

---

## 2. 공개 페이지 기능

### 홈 `/`
- 히어로 슬라이드, 실적 수치, CTA, 배너, 공지/프로그램/영상/후기 요약
- 홈 템플릿 분기 로직 (default / modern / community) 지원

### 소개 `/about`
- 미션 · 가치 · 팀 소개
- `partners` (활성만) 로고 그리드
- `history` 연혁 타임라인 (정렬 순)
- Firestore 비어있으면 `DEMO_HISTORY`, `DEMO_PARTNERS` 폴백

### 교육 프로그램 `/programs`
- `programs` 컬렉션 + **Runmoa(aish.runmoa.com/classes)** 외부 소스 병합
- 공개 정책: `status !== CLOSED`
- 카테고리/상태 필터 + 검색
- CTA "교육과정" 외부 링크

### 강사 `/instructors`
- AI실전마스터 프로필 (`instructors`, `isActive !== false`, `displayOrder` 정렬)
- 명함 업로드 기반 강사 지원 폼 (Gemini로 명함 분석 → 프로필 초안 생성)

### 미디어 허브 `/media`
- `contents` 컬렉션 기반 통합 콘텐츠 (강의/인터뷰/홍보/추천자료/교육자료)
- 좋아요(`likes`) / 북마크(`bookmarks`) / 댓글(`contentComments`)
- 로그인 필요 액션은 `useLoginGuard`로 래핑

### 워커톤 `/workathon`
- `events` 중 최신 1건 (`eventDate` 기준)
- 일정 · 참가 · 결과 페이지
- 이벤트 설명 줄바꿈 보존

### 커뮤니티 `/community`
- 게시판 · 공지 · FAQ 탭
- FAQ: `faq` `displayOrder` 정렬, Firestore 우선
- 커뮤니티 글 작성 (로그인 필요)

### 프로필 `/profile`
- 닉네임 · 기수 · 회사 · 관심사 편집
- Gemini API 키 저장 (개인 설정)
- 로그인 필수 (`AuthGuard`)

### 영상 `/videos` *(레거시)*
- `videos` 컬렉션 직접 조회 — 추후 `/media`로 통합

### 로그인 `/login`
- Google OAuth만 지원

---

## 3. 관리자 기능

### 3.1 대시보드 `/admin`
- 주요 지표 요약 (콘텐츠/회원/문의 수 등)

---

### 3.2 콘텐츠 관리

#### 통합 콘텐츠 `/admin/contents`
- `contents` 전체 글 관리 (생성/수정/삭제/복제)
- 게시판(`boards`) 단위 필터
- **승인 플래그**, **핀 고정**, 조회수, 댓글(`contentComments`) 관리
- 제목/본문 한국어 필드(`titleKo`, `bodyKo`) 지원 (미디어 최근 이관)

#### AI 콘텐츠 `/admin/ai-content`
- YouTube 등 외부 소스에서 자동 수집 → 중복 제거 → 큐레이션 → 게시판 발행
- 수집 이력: `aiCollectorHistory` (타임스탬프, 소스, 개수, 중복 제거 수)
- 발행 대상 게시판 선택 (`boards`)

#### 게시판 설정 `/admin/boards`
- `boards` 컬렉션: `key`, `label`, **레이아웃 타입** (`grid` / `list` / `faq`)
- 쓰기 권한 및 승인 워크플로 토글
- 통합 콘텐츠 시스템의 "보드 디폴트 엔진" 역할

#### 교육자료 `/admin/resources`
- `resources` 업로드/관리 (PDF · 문서 · Google Drive 링크)
- 공개 노출은 `/media` "추천자료" / "교육자료" 섹션

---

### 3.3 교육 운영

#### 프로그램 관리 `/admin/programs`
- `programs` CRUD: 카테고리 · 상태(`status`) · 가격 · 설명
- 공개 규칙: `status !== CLOSED` → `/programs` 노출
- Runmoa 외부 강의 메타와 매핑 가능

#### 강사 관리 `/admin/instructors`
- `instructors` 프로필 · 평점 · 자격 편집
- `isActive` / `displayOrder`로 공개 페이지 순서 제어
- `instructorComments` 관리

#### 수료증 `/admin/certificates`
- `certificateCohorts`: 기수/클래스 정의
- `certificateGraduates`: 수료자 목록
- `certificateRequests`: 발급 요청 처리 · 이메일 발송

#### 스마트워크톤 `/admin/workathon`
- `events` 컬렉션 사용 (회차 `edition`, `schedule`, `registrations` 포함)
- Gemini를 활용한 이벤트 설명 분석
- **공개 노출**: `/workathon` 페이지에 `eventDate` 기준 최신 1건

#### 일반 행사 `/admin/event`
- `adminEvents` 컬렉션 사용 (외부·일반 이벤트, AI 자동분석 지원)
- 필드: 제목·태그·`startDate`/`endDate`·주관사·담당자·썸네일·요약
- **공개 노출**: 홈 페이지 "진행 예정 행사" 섹션 (최대 6건, `status !== COMPLETED && status !== CANCELLED`)

> 두 메뉴는 서로 다른 Firestore 컬렉션을 사용하며 공개 노출 영역도 분리되어 있다.

---

### 3.4 커뮤니티

#### 문의 관리 `/admin/inquiries`
- `inquiries` 목록 (상태: `NEW` / `IN_PROGRESS` / `RESOLVED` / `CLOSED`)
- 답변 처리 · 알림 설정
- 공개 측은 폼만 제공, 목록 조회는 관리자 전용 (Firestore Rules)

---

### 3.5 사이트 관리

#### 사이트 설정 `/admin/settings`
단일 페이지의 탭 구성 — 쿼리 `?tab=...`

| 탭 | 문서 | 효과 |
|----|------|------|
| 섹션 표시 (`sections`) | `siteSettings/features` | 홈 섹션 ON/OFF (히어로/실적/CTA/배너) |
| 히어로 섹션 (`hero`) | `siteSettings/hero` | 슬라이드 배열 (활성 슬라이드만 노출, 없으면 기본 1개) |
| 실적 수치 (`stats`) | `siteSettings/stats` | 홈 통계 블록 `items` |
| CTA 설정 (`cta`) | `siteSettings/cta` | `buttonUrl` · `buttonText` · `floatingEnabled` (헤더/홈/플로팅 공통) |
| 배너 관리 (`banner`) | `siteSettings/banner` | 홈 상단 D-day 배너 `enabled` · 문구 · 링크 |
| 홈 테마 (`theme`) | `siteSettings/theme` | 홈 템플릿 전환 (`default` / `modern` / `community`) |
| AI 수집 (`ai`) | `siteSettings/ai-collector` | YouTube API 키, 자동 수집 파라미터 |
| 외부 연동 (`integrations`) | `siteSettings/integrations` | Google API · 이메일 · Drive · Calendar 설정 |
| 기능 플래그 (`phases`) | `siteSettings/featureFlags` | Phase 1~5 개발 단계별 기능 ON/OFF (알림/공유/AI 상담 등) |

> `siteSettings/features` 는 섹션 ON/OFF 전용 문서, `siteSettings/featureFlags` 는 Phase 플래그 전용 문서이다. 두 문서는 독립.
> 구 URL `?tab=features` 는 `?tab=phases` 로 자동 리다이렉트된다(하위 호환).

#### 퀵배너 관리 `/admin/banners`
- `banners` 컬렉션 기반
- 스타일 · 위치(상/하/팝업) · 기간(`startAt`/`endAt`) · 타깃 페이지(`targetPages`) · 닫기 가능 여부
- 공개 측 `QuickBannerDisplay`는 `isActive`, 기간, 타깃 페이지 필터로 렌더

#### 페이지 관리 `/admin/pages`
- `siteSettings` 내 `page_*` 문서로 커스텀 정적 페이지 본문(리치 텍스트) 관리
- 정적 빌드 제약상 라우트 수는 고정, 본문만 편집

#### 파트너 `/admin/partners`
- `partners`: 공개 파트너 목록 (`isActive`)
- `partnerApplications`: 파트너 지원 접수/승인 워크플로
- 공개 노출은 `/about`

#### 연혁 `/admin/history`
- `history`: 연도 · 제목 · 설명 타임라인
- 정렬 순으로 `/about` 공개

---

### 3.6 사용자 관리

#### 관리자 `/admin/admins`
- `admins` 컬렉션 CRUD
- 역할: `superadmin` / `admin` / `editor`, `isActive` 플래그

#### 회원관리 `/admin/users`
- `users` 전체 회원 (이메일, 이름, 역할, 기수, 회사, 관심사)
- 역할 변경 (`user` / `member` / `premium`), 비활성화

---

### 3.7 레거시 (통합 예정)

공통 원칙: **통합 콘텐츠(`contents` + `boards`)**로 이관하는 중. 기존 URL은 운영 중이나 쓰기는 점진 중단 권장.

> **공지 작성 정책**: 신규 공지는 반드시 `/admin/contents` → `community-notice` 보드에서 작성한다. `/admin/posts?type=NOTICE`는 **기존 공지 조회·삭제용**으로만 유지하며, 공개 `/community` 는 두 소스를 canonicalId로 병합해 중복 없이 노출한다(`mergeNoticeRowsByCanonicalId`).

| 메뉴 | 경로 | 컬렉션 | 비고 |
|------|------|--------|------|
| 게시판 (구) | `/admin/posts` | `posts` + `postComments` | `type=NOTICE` 쿼리로 공지만 필터 가능 |
| 공지사항 | `/admin/posts?type=NOTICE` | `posts` (NOTICE) | 게시판 (구)의 서브뷰 |
| 영상 관리 (구) | `/admin/videos` | `videos` | `/media`로 이관 예정 (미디어 타입) |
| 후기 관리 (구) | `/admin/reviews` | `reviews` | `isApproved !== false` 공개 |
| FAQ (구) | `/admin/faq` | `faq` | 통합 게시판의 `faq` 레이아웃으로 이관 |
| 갤러리 (구) | `/admin/gallery` | `gallery` | `date` 내림차순 공개 |

---

## 4. 공개 ↔ 관리자 데이터 흐름 요약

| 관리자 메뉴 | 공개 소비처 | 필터/정렬 |
|-------------|-------------|-----------|
| 사이트 설정 · 히어로 | 홈 히어로 | 활성 슬라이드만 |
| 사이트 설정 · 실적 | 홈 통계 | `items` 배열 순 |
| 사이트 설정 · CTA | 홈 버튼 · `FloatingCta` · 헤더 · 워커톤 하단 | `floatingEnabled` |
| 사이트 설정 · 배너 | 홈 D-day 배너 | `enabled` |
| 퀵배너 | 모든 페이지 | `isActive` · 기간 · `targetPages` |
| 프로그램 | 홈 · `/programs` | `status !== CLOSED` |
| 강사 | `/instructors` | `isActive !== false` · `displayOrder` |
| 통합 콘텐츠 | `/media` · 홈 | 보드별 · 승인됨 · 핀 고정 우선 |
| 스마트워크톤 (`events`) | `/workathon` | `eventDate` 기준 최신 1건 |
| 일반 행사 (`adminEvents`) | 홈 "진행 예정 행사" | `status !== COMPLETED/CANCELLED`, 최대 6건 |
| 파트너 / 연혁 | `/about` | `isActive` / 정렬 순 |
| FAQ (구) | `/community` | `displayOrder` |
| 후기 (구) | 홈 | `isApproved !== false` |
| 영상 (구) | 홈 · `/videos` | 유튜브 URL 있는 항목 우선 · 날짜 정렬 |
| 갤러리 (구) | `/about` 등 | `date` 내림차순 |

> 세부 점검표는 [admin-public-matrix.md](./admin-public-matrix.md) 참고.

---

## 5. 외부 의존성

| 용도 | 서비스 | 비고 |
|------|--------|------|
| 호스팅 | Firebase Hosting | `out/` 정적 배포 |
| 인증 | Firebase Authentication | Google OAuth |
| DB | Firestore | 클라이언트 SDK |
| 이미지 | Google Drive 공유 링크 등 URL 직접 입력 | Storage 사용 불가 (Blaze 요구) |
| 교육과정 외부 CMS | **Runmoa** (aish.runmoa.com) | `/programs` 소스 |
| AI | Google Gemini | 명함 분석 · AI 콘텐츠 큐레이션 · AI 상담 |
| CI/CD | GitHub Actions | `main` push → Firebase 자동 배포 |
