# AISH 로컬 개발 환경 설정 가이드

## 1. 저장소 클론

```bash
git clone https://github.com/aismartworkhub/aish2.git
cd aish2
```

## 2. 의존성 설치

```bash
npm install
```

## 3. 환경변수 설정

### 3.1 `.env.local` 파일 생성

프로젝트 루트에 `.env.local` 파일을 생성하고 아래의 환경변수를 입력합니다.

```bash
# Firebase Configuration (필수)
NEXT_PUBLIC_FIREBASE_API_KEY=<Firebase API Key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=aish-web-v2.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=aish-web-v2
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=aish-web-v2.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<Firebase Messaging Sender ID>
NEXT_PUBLIC_FIREBASE_APP_ID=<Firebase App ID>

# Runmoa API Key (권장)
NEXT_PUBLIC_RUNMOA_API_KEY=<Runmoa API Key>

# Gemini API Key (선택, AI 기능 사용 시)
NEXT_PUBLIC_GEMINI_API_KEY=<Gemini API Key>

# Claude Cloud Function URL (선택, Cloud Functions 배포 후)
NEXT_PUBLIC_CLAUDE_FUNCTION_URL=
```

## 4. 환경변수 & API 키 획득 방법

### 4.1 Firebase 설정값

**방법:**
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 "aish-web-v2" 선택
3. 좌측 **"프로젝트 설정"** → **"일반"** 탭
4. **"웹 앱" 섹션**에서 아래 정보 복사:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`

### 4.2 Runmoa API Key

**방법:**
1. [Runmoa 관리자 페이지](https://aish.runmoa.com/admin)에서 API 설정 섹션 확인
2. 또는 담당자에게 요청

### 4.3 Gemini API Key

**방법:**
1. [Google AI Studio](https://aistudio.google.com/app/apikey) 접속
2. "API 키 생성" 클릭
3. 프로젝트 선택 후 키 복사

## 5. Git 설정 (GitHub 동기화)

### 5.1 Git 사용자 설정

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 5.2 GitHub Personal Access Token 설정 (Recommended)

**HTTPS를 사용하는 경우:**
1. [GitHub Settings → Tokens (classic)](https://github.com/settings/tokens) 접속
2. "Generate new token (classic)" 클릭
3. 아래 권한 선택:
   - `repo` (저장소 전체 접근)
   - `workflow` (GitHub Actions)
4. 토큰 복사 후 로컬에 안전하게 보관

**Git Credential 저장:**
```bash
git config --global credential.helper store
# 이후 HTTPS push 시 올라는 프롬프트에서 토큰 입력
```

**또는 SSH 키 설정 (권장):**
```bash
# SSH 키 존재 확인
ls -la ~/.ssh/id_rsa

# 없으면 생성
ssh-keygen -t rsa -b 4096 -C "your.email@example.com"

# GitHub에 공개 키(id_rsa.pub) 추가: https://github.com/settings/keys
cat ~/.ssh/id_rsa.pub
```

SSH 설정 후 저장소를 SSH로 클론하면 매번 인증 불필요:
```bash
git clone git@github.com:aismartworkhub/aish2.git
```

## 6. 로컬 개발 서버 실행

```bash
# 개발 서버 시작 (localhost:3000)
npm run dev

# 또는
npm run dev -- --port 3001  # 다른 포트 지정
```

브라우저에서 `http://localhost:3000` 접속

## 7. 빌드 & 린트

```bash
# 빌드 테스트
npm run build

# ESLint 검사
npm run lint

# 함께 실행
npm run build && npm run lint
```

## 8. GitHub 커밋 & 푸시 워크플로우

```bash
# 변경사항 확인
git status

# 파일 추가
git add .

# 커밋 (Conventional Commits 스타일)
git commit -m "feat: 새 기능 추가" 
# 또는
git commit -m "fix: 버그 수정"
git commit -m "refactor: 코드 개선"

# 브랜치 확인 (main)
git branch

# GitHub에 푸시
git push origin main

# GitHub Actions 배포 자동 실행 (main push 시)
```

**커밋 메시지 규칙:**
- `feat:` 새로운 기능
- `fix:` 버그 수정
- `refactor:` 코드 구조 개선
- `docs:` 문서 수정
- `chore:` 설정 변경, 의존성 업데이트
- `ci:` CI/CD 관련

## 9. 배포 현황 확인

```bash
# GitHub Actions 실행 상태 확인
gh run list -R aismartworkhub/aish2 --limit 5

# 최근 배포 상세 확인
gh run view <run-id> --log
```

## 10. 환경변수 체크리스트

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ | Firebase API 키 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ | Firebase 인증 도메인 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ | Firebase 프로젝트 ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ | Firebase 스토리지 버킷 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase 메시징 발신자 ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ✅ | Firebase 앱 ID |
| `NEXT_PUBLIC_RUNMOA_API_KEY` | ⭕ | 런모아 API 키 (콘텐츠 동기화용) |
| `NEXT_PUBLIC_GEMINI_API_KEY` | ⭕ | Google Gemini API 키 (AI 기능) |

**필수**: ✅ (앱 정상 작동에 필요)  
**권장**: ⭕ (특정 기능이 안 될 수 있음)

## 11. 주요 폴더 구조

```
aish2/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── (public)/     # 공개 페이지
│   │   └── admin/        # 관리자 페이지
│   ├── components/       # React 컴포넌트
│   ├── lib/              # 유틸리티 및 API
│   │   ├── firebase.ts   # Firebase 설정
│   │   ├── runmoa-api.ts # Runmoa API
│   │   └── gemini.ts     # Gemini API
│   ├── types/            # TypeScript 타입
│   └── contexts/         # React Context (AuthContext 등)
├── .env.example          # 환경변수 템플릿
├── .env.local            # 로컬 환경변수 (커밋하지 않음)
├── firebase.json         # Firebase 설정
├── firestore.rules       # Firestore 보안 규칙
└── package.json          # 의존성
```

## 12. 문제 해결

### 빌드 실패
```bash
# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Firebase 연결 오류
- `.env.local` 의 Firebase 설정값 확인
- Firebase Console에서 프로젝트 활성화 확인

### Runmoa API 오류
- `NEXT_PUBLIC_RUNMOA_API_KEY` 입력 확인
- API 키가 유효한지 확인

---

**필요한 추가 정보:** 환경 변수나 API 키 설정 중 문제가 발생하면 담당자(aismartworkhub@gmail.com)에게 연락하세요.
