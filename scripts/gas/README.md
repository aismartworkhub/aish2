# Google 트렌드 자동 수집 (Apps Script) — 설치 가이드

브라우저 OAuth 팝업 없이 트렌드 데이터를 채우는 방법입니다.
**GAS(구글 서버)가 BigQuery를 조회 → Firestore `googleTrendsTop`에 저장**하고,
관리자 트렌드 페이지는 그 캐시를 **읽기만** 합니다. 팝업·COOP 문제가 사라집니다.

> 전제: 아래 작업은 **aish-web-v2 GCP 프로젝트의 Owner 계정**(보통 `aismartworkhub@gmail.com`)으로 진행해야 합니다. 그래야 BigQuery 실행 + Firestore 쓰기 권한(IAM)이 자동으로 적용됩니다.

---

## 1. BigQuery API 활성화 (한 번만)

1. https://console.cloud.google.com/apis/library/bigquery.googleapis.com?project=aish-web-v2
2. **사용(Enable)** 클릭 (이미 켜져 있으면 통과)
   - 공개 데이터셋 쿼리는 월 1TB 무료 → 이 작업은 사실상 0원.

## 2. Apps Script 프로젝트 생성

1. https://script.google.com → **새 프로젝트**
2. 좌측 파일 목록에서:
   - `Code.gs`(기본 파일) 내용을 지우고 **`trends-collector.gs`** 내용을 붙여넣기
3. 좌측 **⚙ 프로젝트 설정** →
   - **"appsscript.json 매니페스트 파일을 편집기에 표시"** 체크
4. 편집기에 생긴 **`appsscript.json`** 내용을 이 폴더의 `appsscript.json`으로 교체

## 3. GCP 프로젝트 연결 (중요)

기본값은 임시 프로젝트라 BigQuery가 안 됩니다. **aish-web-v2**로 바꿔야 합니다.

1. **⚙ 프로젝트 설정** → **Google Cloud Platform(GCP) 프로젝트** → **프로젝트 변경**
2. **프로젝트 번호** 입력: `96691437365` (= aish-web-v2) → 설정
   - 번호 확인: https://console.cloud.google.com/home/dashboard?project=aish-web-v2

## 4. 고급 서비스(BigQuery) 추가

- 편집기 좌측 **서비스(+)** → **BigQuery API** 선택 → **추가**
  (appsscript.json을 붙여넣었다면 이미 잡혀 있을 수 있음 — 없으면 수동 추가)

## 5. 1회 실행 + 권한 승인

1. 상단 함수 선택을 **`collectTrends`**로 두고 **실행(▶)**
2. 권한 동의 창이 뜨면 **소유자 계정으로 허용** (BigQuery·Firestore·외부요청 권한)
   - "Google에서 확인하지 않은 앱" 경고가 나오면: **고급 → (안전하지 않음)으로 이동** → 본인 프로젝트이므로 진행
3. 실행 후 **실행 로그**에 `saved KR_2026-..-.. (25 terms)` 식으로 찍히면 성공

## 6. 결과 확인

- Firestore 콘솔: https://console.firebase.google.com/project/aish-web-v2/firestore/data/~2FgoogleTrendsTop
  → `KR_2026-..-..`, `US_2026-..-..` 등 문서가 생겼는지 확인
- 관리자 트렌드 페이지: `https://aish.co.kr/admin/trends/` → **BigQuery 탭** → 하단 **캐시 목록**에 자동으로 표시됨 (조회 버튼/팝업 불필요)

## 7. 매일 자동 갱신 트리거

1. 함수 선택을 **`installDailyTrigger`**로 바꾸고 **실행(▶)** (한 번만)
2. 이후 매일 오전 6시에 `collectTrends`가 자동 실행됩니다.
   - 트리거 확인/수정: 좌측 **⏰ 트리거**

---

## 동작 원리 / 보안 메모
- Firestore `googleTrendsTop` 쓰기 규칙은 `admin only`지만, **GAS는 프로젝트 Owner의 OAuth 토큰**으로 Firestore REST를 호출합니다. IAM 주체(Owner)는 보안 규칙을 우회하므로 별도 서비스계정 키 없이 쓰기가 됩니다.
- 토큰은 `ScriptApp.getOAuthToken()`으로 실행 시점에만 발급 — **어디에도 저장되지 않습니다.**
- 수집 대상 국가는 `trends-collector.gs`의 `COUNTRIES` 배열에서 조정하세요(트렌드 페이지의 지원 국가와 라벨을 맞추면 됨).

## 문제 해결
- `Access Denied: BigQuery`: 3단계(GCP 프로젝트 연결)를 안 했거나 1단계(API 활성화) 누락.
- `Firestore write 403`: 실행 계정이 aish-web-v2의 Owner/Editor가 아님 → 올바른 계정으로 재생성.
- 데이터가 페이지에 안 보임: 트렌드 페이지는 캐시를 30초 캐싱 — 새로고침 후 확인.
