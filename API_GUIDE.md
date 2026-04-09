# AISH 외부 API & 환경변수 목록

## 1. Firebase (구글 생태계 - 필수)

### 용도
- 사용자 인증 (Google 로그인)
- 실시간 데이터베이스 (Firestore)
- 호스팅 (정적 사이트 배포)

### 필요한 환경변수
| 변수명 | 여기서 얻기 | 예시 |
|--------|-----------|------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console > 프로젝트 설정 | `AIzaS...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Console > 프로젝트 설정 | `aish-web-v2.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console > 프로젝트 설정 | `aish-web-v2` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Console > 프로젝트 설정 | `aish-web-v2.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console > 프로젝트 설정 | `123456789` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Console > 프로젝트 설정 | `1:123...:web:abc...` |

### 획득 방법
```
1. https://console.firebase.google.com/ 접속
2. 프로젝트 "aish-web-v2" 선택
3. ⚙️ 프로젝트 설정 > 일반 탭
4. "웹 앱" 섹션에서 firebaseConfig 복사
```

### 사용 코드
- 파일: `src/lib/firebase.ts`
- 용도: 사용자 인증, Firestore 데이터베이스 접근

---

## 2. Runmoa API (콘텐츠 연동 - 선택사항)

### 용도
- 런모아 플랫폼에서 제공하는 강의 정보 조회
- 강사별 담당 강의 목록 동기화

### 필요한 환경변수
| 변수명 | 설명 |
|--------|------|
| `NEXT_PUBLIC_RUNMOA_API_KEY` | Runmoa 공개 API 키 |

### API 엔드포인트
```
Base URL: https://aish.runmoa.com/api/public/v1

인증: Authorization: Bearer {NEXT_PUBLIC_RUNMOA_API_KEY}
또는 (키가 없으면) 익명 호출 가능
```

### 주요 API
| 엔드포인트 | 설명 | 필수 파라미터 |
|-----------|------|-------------|
| `GET /contents` | 강의 목록 조회 | `page`, `limit` |
| `GET /contents/{id}` | 강의 상세 조회 | `id` |
| `GET /content-categories` | 카테고리 목록 | - |

### 사용 코드
- 파일: `src/lib/runmoa-api.ts`
- 함수: `getRunmoaContents()`, `getRunmoaContentById()`, `getRunmoaCategories()`
- 페이지: `src/app/(public)/instructors/page.tsx` (강사 수업 내역)

### 획득 방법
1. Runmoa 관리자 패널 접속
2. API 설정 섹션에서 공개 API 키 확인
3. 또는 담당자(aismartworkhub@gmail.com)에게 요청

---

## 3. Google Gemini API (AI 분석 - 선택사항)

### 용도
- AI 기반 콘텐츠 자동 분석
- 이벤트, 갤러리, 리소스 설명 자동 생성

### 필요한 환경변수
| 변수명 | 설명 |
|--------|------|
| `NEXT_PUBLIC_GEMINI_API_KEY` | Google Gemini API 키 |

### API 엔드포인트
```
Base URL: https://generativelanguage.googleapis.com/v1beta/models/

모델: gemini-1.5-flash (또는 gemini-2.0-flash)
```

### 주요 기능
- 텍스트 생성 (generativeModels.generateContent)
- 약 1000자 설명 자동 생성 가능

### 사용 코드
- 파일: `src/lib/gemini.ts`
- 함수: `analyzeImageWithGemini()`, `generateDescription()`
- 저장: Firestore siteSettings/gemini에 키 저장 (관리자 페이지에서)

### 획득 방법
```
1. https://aistudio.google.com/app/apikey 접속
2. "API 키 생성" 클릭
3. 프로젝트 선택 (Google Cloud Project 없으면 생성)
4. 키 복사 (매우 주의: 공개되지 않도록)
```

### 주의사항
- 월 일정 사용량까지 무료 (초과 시 과금)
- 보안: 공개 키이므로 클라이언트 SDK에 직접 로드
- 백엔드 사용 불가 (현재는 프론트엔드만 사용)

---

## 4. GitHub (버전 관리 & CI/CD)

### 용도
- 소스 코드 버전 관리
- GitHub Actions을 통한 자동 배포

### 필요한 설정
| 항목 | 설명 |
|-----|------|
| GitHub 계정 | 저장소 접근 권한 필요 |
| Personal Access Token | HTTPS push 시 인증용 |
| SSH 키 | SSH push 시 인증용 (권장) |

### 저장소 정보
```
URL (HTTPS): https://github.com/aismartworkhub/aish2.git
URL (SSH): git@github.com:aismartworkhub/aish2.git
브랜치: main (기본)
```

### GitHub Actions 워크플로우
```
파일: .github/workflows/firebase-deploy.yml
트리거: main 브랜치에 push
작업: 빌드 → 린트 → Firebase 배포
```

### 자동 배포 환경변수 (GitHub Secrets)
```
GitHub Settings > Secrets and variables > Actions

필수 시크릿:
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID
- NEXT_PUBLIC_RUNMOA_API_KEY
- NEXT_PUBLIC_GEMINI_API_KEY
```

### 설정 방법
```bash
# GitHub CLI로 시크릿 저장 (권장)
gh secret set NEXT_PUBLIC_FIREBASE_API_KEY --body "your-key-here"
gh secret set NEXT_PUBLIC_RUNMOA_API_KEY --body "your-key-here"
# ... 나머지 설정

# 또는 GitHub 웹 UI
Settings > Secrets and variables > Actions > New repository secret
```

---

## 5. 로컬 개발 환경변수 설정 요약

### 최소 필수 환경변수
```bash
# .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=aish-web-v2.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=aish-web-v2
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=aish-web-v2.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 권장 추가 환경변수
```bash
# .env.local (추가)
NEXT_PUBLIC_RUNMOA_API_KEY=...     # 강의 연동 기능
NEXT_PUBLIC_GEMINI_API_KEY=...      # AI 분석 기능
```

---

## 6. API 호출 흐름

### 강사 페이지 - 강의 연동 (ClassHistorySection)
```
사용자 접속
  ↓
instructors/page.tsx (ClassHistorySection)
  ↓
runmoa-api.ts: getRunmoaContents({ search: instructorName })
  ↓
런모아 API: GET /api/public/v1/contents?search=...
  ↓
강의 목록 필터링 및 렌더링
```

### 관리자 콘텐츠 분석 (Gemini)
```
관리자 페이지 > 이벤드/갤러리/리소스 추가
  ↓
이미지 업로드
  ↓
gemini.ts: analyzeImageWithGemini()
  ↓
Google Gemini API: generativeModels.generateContent()
  ↓
Firestore: siteSettings/gemini에 API 키 저장
  ↓
자동 설명 생성 및 폼 자동완성
```

---

## 7. 문제 해결

### Firebase 키가 없으면
- ❌ 앱이 정상 작동하지 않음
- 로그인 불가
- Firestore 데이터 조회 실패

### Runmoa API 키가 없으면
- ⚠️ 강사 페이지에서 강의 목록이 안 보임 (우아한 실패)
- 익명 요청으로 폴백 (`Authorization` 헤더 생략)

### Gemini API 키가 없으면
- ⚠️ AI 자동 분석 기능 사용 불가
- 관리자가 수동 입력 필요

### 배포 환경 (GitHub Actions)
- 모든 시크릿이 `.github/workflows/firebase-deploy.yml`에 명시되어야 함
- 시크릿 누락 시 Actions 실패

---

## 8. 보안 주의사항

### 절대 하지 말 것
❌ 환경변수를 소스 코드에 하드코딩  
❌ `.env.local` 파일을 커밋  
❌ API 키를 README나 주석에 첨부  
❌ 공개 저장소에 개인 키 업로드  

### 권장 사항
✅ `.env.local`과 `.env.*.local` 모두 `.gitignore`에 포함  
✅ 팀원과 환경변수 공유 시 `.env.example` 업데이트  
✅ 프로덕션 환경변수는 GitHub Secrets에서 관리  
✅ 정기적으로 API 키 로테이션  

---

## 9. 참고 문서

| 서비스 | 문서 |
|--------|------|
| Firebase | https://firebase.google.com/docs |
| Runmoa | 담당자 문의 |
| Google Gemini API | https://ai.google.dev/docs |
| GitHub Actions | https://docs.github.com/actions |
| Next.js | https://nextjs.org/docs |

---

## 10. 연락처

- **프로젝트 담당자**: aismartworkhub@gmail.com
- **GitHub 저장소**: https://github.com/aismartworkhub/aish2
- **Firebase 프로젝트 ID**: aish-web-v2
