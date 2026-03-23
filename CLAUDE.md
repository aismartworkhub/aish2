# CLAUDE.md — AISH 프로젝트 개발 지침

이 파일은 모든 Claude 세션에서 자동 로드됩니다.
세션 시작 시 "CLAUDE.md 로드 완료. Cursor 스타일 Composer 준비됨. 작업 지시 주세요."라고 답변한다.

---

## 절대 원칙

- **구글 생태계 + 무료 사용**이 절대 불변의 원칙이다.
- Vercel, AWS, 유료 SaaS 절대 금지. Cloud Run 등 종량제도 금지.
- Firebase 무료 할당량 내에서 모든 것을 해결한다.

## 기술 스택

| 항목 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 15 + React 19 + TypeScript (strict) | |
| 빌드 | `output: "export"` (정적 빌드) | SSR/미들웨어/Server Actions/Route Handlers 불가 |
| 호스팅 | Firebase Hosting (`out/` 디렉토리) | |
| DB | Firestore (클라이언트 SDK) | 구글 생태계 외 DB 사용 금지 |
| 인증 | Firebase Auth (Google 로그인) | |
| 파일 저장 | Firebase Storage | |
| 서버리스 | Cloud Functions (Node 20, `functions/`) | Server Actions 대체 |
| 스타일 | Tailwind CSS v4 + `cn()` 유틸 | 문자열 className 직접 쓰지 않기 |
| 아이콘 | lucide-react | |
| 상태관리 | React Context (AuthContext 등) | 필요 시 Zustand 허용 |
| CI/CD | GitHub Actions → Firebase 배포 | |
| 린팅 | ESLint (변경 후 auto-fix 적극 제안) | |

## 아키텍처 패턴

- 클라이언트 사이드 AuthGuard (미들웨어 사용 불가 - static export)
- LoginModal + `useLoginGuard` 훅으로 공개 페이지 기능 보호
- Firestore 데이터 없으면 데모 데이터 폴백
- `COLLECTIONS` 상수로 컬렉션명 관리 (`src/lib/firestore.ts`)
- CRUD 헬퍼: `getCollection`, `createDoc`, `upsertDoc`, `updateDocFields`, `removeDoc`
- 관리자 레이아웃: 왼쪽 사이드바 + 상단 헤더
- 타입: type alias 선호, Zod 스키마 적극 활용
- `use client`는 Firestore/Auth 등 클라이언트 API가 필요한 컴포넌트에만 사용
- 에러/로딩 상태: Suspense + 인라인 로딩 UI (static export이므로 `loading.tsx` 미지원)

## UI/UX 규칙

- 한국어 인터페이스
- 사이트명: AISH (AI Smart Hub)
- 관리자/공개 페이지 분리 (`/admin/*`, `/(public)/*`)
- 공개 페이지 CTA: "교육과정" (외부 링크 aish.runmoa.com/classes)

## 배포 규칙

- `main` 브랜치 push 시 자동 배포
- Firestore Rules / Cloud Functions 배포 실패해도 Hosting 배포 진행 (`continue-on-error: true`)
- 프로젝트 ID: `aish-web-v2`
- 커밋 메시지: Conventional Commits 스타일 (`feat:`, `fix:`, `refactor:` 등)

## 검증 명령어

- 빌드 & 검증: `npm run build && npm run lint`
- 개발 서버: `npm run dev`
- 컨텍스트 압축: `/compact` 사용 권장

---

## Composer / Agent 워크플로우

### 1. 큰 작업 시작 시 Plan First

- 관련 파일/폴더 구조 요약 먼저 보여주기
- Step-by-step 계획 (번호 매김) 작성
- 계획 끝에 "이 계획으로 진행할까요? (go / 수정 / 취소)" 물어보기
- "go", "승인", "실행", "OK" 같은 긍정 답변 시에만 실제 파일 편집 시작

### 2. 파일 편집 방식

- 변경은 항상 diff 형식으로 보여주기 (파일별 또는 그룹화)
- 적용 후 바로 "변경 완료. 다음?" 확인
- 빌드/린트 명령 자동 제안 (`npm run build && npm run lint`)
- 문제 발생 시 자동 fix 시도 또는 rollback 제안

### 3. 멀티파일 & 대규모 리팩토링

- 관련 파일 5~20개 동시에 처리 OK
- 불필요한 질문 최소화 → 합리적인 가정 후 "이렇게 가정했음. 맞나?" 한 번만 확인

### 4. 인라인 / 작은 편집

- 코드 블록이나 특정 함수 지시 시 해당 부분만 빠르게 diff로 수정

---

## 개발 지침

에이전트·기여자는 아래를 따른다.

### 1. 범위와 변경

- 요청된 과업에 **필요한 만큼만** 수정한다. 관련 없는 리팩터, 다른 파일 확장, 스코프 밖 기능 추가는 하지 않는다.
- 수정 전 **주변 코드를 읽고** 네이밍, 타입, 추상화, import 스타일, 문서화 수준을 맞춘다.
- **기존 함수·컴포넌트를 재사용·확장**하고, 유사 로직을 중복 구현하지 않는다.
- diff의 각 변경은 요청에 **직접 기여**해야 한다. 당연한 주석·과한 docstring·불필요한 변수·과한 try/except는 넣지 않는다.
- UI 작업 시 간격·타이포·색·레이아웃은 **기존 디자인 패턴**과 일치시킨다.
- 기존 코드 무시하고 전부 새로 짜지 않기 (점진적 리팩토링 우선)

### 2. 실행과 검증

- 실제 셸·네트워크가 있다고 가정하고, 문제는 **직접 조사·실행**한다.
- 한 번 실패로 중단하지 말고, 원인 분석·대안 시도 후 **재시도**한다.

### 3. 작업 전 절차

1. 요구사항을 **여러 번** 읽고 애매한 점·리스크를 정리한다.
2. 본격 구현 전 **공식·신뢰 문서(API 등)**를 확인해 최신 권장안·제약을 반영한다.
3. 코드 작성 전 **짧고 구체적인 작업 계획**을 공유한다.
4. 변경이 다른 모듈·호출부·데이터 흐름에 미치는 영향을 **여러 각도**에서 검토한다.
5. 예외·실패 시나리오를 **여러 번** 검토하고, 필요한 만큼만 방어 코드를 둔다.

### 4. 코드 품질

- **함수 분리**: 함수 하나는 **한 가지 책임**만. 길어지면 의미 단위로 나눈다.
- **평탄한 제어 흐름**: 3단 이상 깊은 중첩을 피한다. 가드 클로즈·조기 리턴을 쓴다.
- **매직 값 금지**: 의미 없는 숫자·문자열을 직접 쓰지 말고, **이름 있는 상수**로 의도를 드러낸다.
- **이름**: 역할이 드러나게 짓는다. `a`, `temp`, 모호한 `data` 등은 피한다.
- **전역**: 전역 상태는 **최소화**하고, 데이터는 **인자로 전달**하는 것을 원칙으로 한다.
- **죽은 코드**: 사용하지 않는 코드·주석 처리 블록은 **남기지 않는다**.
- **console.log**: 디버그 용도 외 금지.
- **불필요한 useEffect**: 피한다.

### 5. 주력 기술

- 이 프로젝트에서는 **TypeScript + Next.js + Firebase** 스택을 따른다.
- 별도 스크립트 맥락에서는 **Python** 또는 **Google Apps Script**를 우선한다.

### 6. 도구·규칙 파일

- Cursor 규칙(`.cursor/rules`), 스킬(`SKILL.md`), `settings.json` 변경이 과업에 포함되면, 해당 **스킬·문서의 절차**를 먼저 읽고 따른다.

---

## 금지 사항 요약

- 구글 생태계 외 서비스 사용 (Vercel, AWS, Supabase 등)
- `output: "export"`에서 불가능한 기능 (SSR, 미들웨어, Server Actions, Route Handlers, `loading.tsx`)
- 문자열 className 직접 사용 (`cn()` 유틸 사용)
- 불필요한 useEffect, console.log (디버그 외)
- 기존 코드 무시하고 전체 재작성
- 스코프 밖 리팩토링/기능 추가
