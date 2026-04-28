# 통합 피드 + 활동순 + Feature Flag 점진 공개 — 작업 계획

## Context

홈 메인 페이지에 **6종 데이터 소스(콘텐츠·커뮤니티·프로그램·강사·이벤트·자료)**를
통합한 피드를 도입한다.

- **기존 vs 신규를 Feature Flag(phase6)로 분기** → 관리자가 시장 반응 보고 본공개
- **활동순 정렬**: 댓글 달리면 최상단으로 이동(고정글 아래)
- **인터리브**: 5번째=프로그램, 8번째=강사, 10번째=이벤트
- **사용자 카테고리 필터**: 전체/콘텐츠/프로그램/강사/이벤트/자료/커뮤니티
- **3-스타일 토글**: X피드(timeline) / 카드(dispatch) / 리스트(list) — 기존 ViewModeToggle 재사용
- **모바일 우선**

## 사용자 확정 사항

| 항목 | 결정 |
|---|---|
| 활동 트리거 | **댓글 작성/삭제만** (좋아요는 제외) |
| 인터리브 패턴 | **5/8/10** (프로그램/강사/이벤트) |
| 진행 범위 | **Phase F → A → E → B → C → D 모두 한 번에** |
| 백필 | 자동 폴백 (`lastActivityAt || createdAt`) — 별도 도구 불필요 |

## 작업 순서 (Feature Flag 먼저)

| Phase | 내용 | 파일 |
|---|---|---|
| **F** | `phase6` Flag 정의 + 관리자 settings UI | `site-settings-public.ts`, `admin/settings/page.tsx` |
| **A** | `/community` 5개 탭 모두에 ViewModeToggle 확장 | `community/page.tsx` |
| **E** | `Content.lastActivityAt` 필드 + `createComment` hook 갱신 | `types/content.ts`, `content-engine.ts` |
| **B** | `useUniversalFeed` + `FeedItem` 타입 (6 소스 병합·인터리브·핀) | `types/feed.ts`, `hooks/useUniversalFeed.ts` |
| **C** | 신규 카드 (`ProgramCard`/`EventCard`/`InstructorCard`) + `FeedCategoryChips` | `components/feed/*` |
| **D** | 홈 통합 섹션 + flag 분기 | `home/RecentActivityFeed.tsx` 또는 새 컴포넌트 |

각 Phase 종료 시 build·lint·commit·push·deploy success 확인.

## 핵심 인프라 변경

### `phase6` Flag 모양
```ts
phase6: {
  enabled: false,
  unifiedFeedHome: true,
  audienceLevel: "admin",  // "admin" | "all"
  enableActivitySort: true,
  interleaveProgram: 5,
  interleaveInstructor: 8,
  interleaveEvent: 10,
}
```

### 활동순 정렬
- `Content.lastActivityAt` 옵션 필드 추가
- `createComment(input)` 호출 시 부모 콘텐츠의 `lastActivityAt = serverTimestamp()` 갱신
- 무한 스크롤 쿼리는 `orderBy("lastActivityAt", "desc")`. 미존재 doc은 자동으로 정렬 마지막에 가지만, **클라이언트에서 `lastActivityAt ?? createdAt`** 폴백 정렬도 추가 적용

### 인터리브
- contents를 활동순 정렬로 페치
- 결과 배열에서 5/8/10번째 슬롯에 program/instructor/event 1개씩 삽입 (round-robin)
- 핀 항목은 항상 최상단

### 카테고리 필터
- 칩 클릭 시 그 종류만 표시 (인터리브 미적용)
- "전체" = 인터리브 적용된 6종 혼합

## Verification

각 Phase 완료마다:
```
npm run lint && npm run build
git add ... && git commit && git push origin main
gh run list --limit 1 → success 확인
```

최종:
- Flag OFF: 홈 화면 변화 없음 (기존 RecentActivityFeed 유지)
- Flag ON + audienceLevel:"admin": 관리자에게만 신규 통합 피드
- 카테고리 칩·뷰모드 토글·활동순·인터리브 동작
- 댓글 작성 → 해당 콘텐츠 최상단 이동 (새로고침 후)
