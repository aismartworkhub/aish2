# Claude Chrome 익스텐션용 지침 — Google 트렌드 GAS 자동수집 설치

아래 "작업 지시" 블록을 Claude Chrome 익스텐션에 그대로 전달하면, 브라우저를 조작해
Apps Script 프로젝트를 만들고 트렌드 자동수집을 설치합니다.

> **전제**
> - Chrome이 `aismartworkhub@gmail.com`(aish-web-v2 소유자)로 로그인돼 있어야 함.
> - 같은 브라우저에서 GitHub `aismartworkhub/aish2` 저장소를 볼 수 있어야 함(코드 복사용).
>
> **사람 개입 지점**: 6단계 OAuth 동의 / "확인되지 않은 앱" 경고는 보안상 사람이 직접 승인해야 할 수 있음. 익스텐션이 멈추면 사용자가 **허용**을 눌러줄 것.

---

## ▼ 작업 지시 (이 블록 전체를 익스텐션에 전달)

너는 브라우저를 조작해 Google Apps Script로 트렌드 자동수집을 설치한다. 아래 순서를 정확히 따른다. 각 단계 후 화면을 확인하고, 예상과 다르면 멈추고 사람에게 현재 화면을 보고한다. 비밀번호 입력·결제·삭제 같은 위험 동작은 하지 말고 사람에게 넘긴다.

### 1단계 — BigQuery API 활성화
1. 새 탭: `https://console.cloud.google.com/apis/library/bigquery.googleapis.com?project=aish-web-v2`
2. 파란 **"사용"(Enable)** 버튼이 있으면 클릭. 이미 **"관리"(Manage)**면 그대로 둔다.

### 2단계 — 코드 원본 2개를 미리 확보
GitHub에서 두 파일을 열어 둔다(복사용). 각 파일 화면 우상단의 **"Copy raw file"**(또는 raw 보기) 기능을 쓴다.
- 파일 A: `https://github.com/aismartworkhub/aish2/blob/main/scripts/gas/trends-collector.gs`
- 파일 B: `https://github.com/aismartworkhub/aish2/blob/main/scripts/gas/appsscript.json`

### 3단계 — Apps Script 새 프로젝트 + 코드(A) 붙여넣기
1. 새 탭: `https://script.google.com/home/projects/create`
2. 편집기가 뜨면 기본 파일 `Code.gs` 안을 클릭 → 전체 선택(Cmd/Ctrl+A) → 삭제.
3. **파일 A**(trends-collector.gs) 전체를 복사해 붙여넣기.
4. 상단 프로젝트 이름을 `AISH 트렌드 수집`으로 변경. **저장(Cmd/Ctrl+S)**.

### 4단계 — 매니페스트(appsscript.json) 표시 + 교체(B)
1. 왼쪽 **⚙ 프로젝트 설정** → **"appsscript.json 매니페스트 파일을 편집기에 표시"** 체크.
2. 왼쪽 **편집기(<>)** → 파일 목록의 **`appsscript.json`** 클릭.
3. 내용 전체 선택 후 삭제 → **파일 B** 내용 붙여넣기. **저장**.

### 5단계 — GCP 프로젝트 연결 (중요, 누락 시 BigQuery 실패)
1. 왼쪽 **⚙ 프로젝트 설정** → **"Google Cloud Platform(GCP) 프로젝트"** → **"프로젝트 변경"**.
2. 프로젝트 번호 `96691437365` 입력 → **프로젝트 설정**. 확인 문구가 보이면 성공.

### 6단계 — BigQuery 고급 서비스 추가
1. 왼쪽 **편집기(<>)** → 파일 목록 위 **서비스(+)** 클릭.
2. **BigQuery API** 선택 → **추가**. (이미 "BigQuery"가 있으면 통과)

### 7단계 — 1회 실행 + 권한 승인  ⚠ 사람 개입 가능
1. 상단 함수 드롭다운에서 **`collectTrends`** 선택 → **실행(▶)**.
2. "권한 검토" → 계정 `aismartworkhub@gmail.com` 선택.
3. "확인되지 않은 앱" 경고 시: **고급** → **"AISH 트렌드 수집(안전하지 않음)으로 이동"**.
   - 막히면 멈추고 "OAuth 동의에서 허용이 필요합니다"라고 사람에게 보고.
4. 권한 목록에서 **허용**.
5. 실행 후 하단 **"실행 로그"** 확인. `saved KR_...`, `saved US_...` 가 보이면 성공.
   - `Access Denied`/`403`이면 멈추고 메시지를 사람에게 보고(보통 5단계 미완 또는 계정 권한).

### 8단계 — 매일 자동 트리거
1. 함수 드롭다운에서 **`installDailyTrigger`** 선택 → **실행(▶)**.
2. 로그에 "일간 트리거 설치 완료"가 보이면 끝.

### 9단계 — 검증 및 보고
1. 새 탭: `https://console.firebase.google.com/project/aish-web-v2/firestore/data/~2FgoogleTrendsTop`
2. `KR_..`, `US_..` 등 문서 생성 확인.
3. 저장된 국가 목록과 Firestore 문서 목록을 사람에게 보고하고 종료.

---

## 코드가 복사가 안 될 때 (대체 경로)
GitHub "Copy raw file"이 안 되면, 각 파일 페이지에서 **Raw** 버튼을 눌러 순수 텍스트 화면으로 간 뒤 전체 선택·복사한다. 그래도 안 되면 사람에게 "코드 두 파일을 직접 붙여달라"고 요청한다.

## 안전 수칙 (익스텐션에 함께 전달)
- 결제수단 등록, 프로젝트 삭제, 권한 범위 확대 등 **위험·비가역 동작은 하지 않는다.**
- OAuth 동의 화면에서 판단이 필요하면 **사람에게 넘긴다.**
- 단계마다 결과를 짧게 보고하고, 에러 화면은 원문 그대로 전달한다.
