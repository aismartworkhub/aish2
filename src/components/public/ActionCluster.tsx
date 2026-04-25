"use client";

import FloatingCta from "./FloatingCta";
import AiCounselor from "./AiCounselor";

/**
 * 우하단 플로팅 위젯 통합 클러스터.
 * - 모바일(< lg): BottomTabNav(z-50) 위로 FloatingCta(z-40) → AiCounselor(z-45) 순서로 스택.
 *   각 컴포넌트의 컨테이너에서 bottom 오프셋을 별도로 관리.
 * - 데스크톱(lg+): 원래 우하단 위치(bottom-6 right-6) 유지.
 *
 * 별도 wrapper로 분리한 이유:
 * 1) 공개 layout.tsx에서 단일 import로 묶어 관리하기 쉬움.
 * 2) 향후 단일 토글 버튼으로 통합하거나 위젯 추가 시 진입점 일원화.
 */
export default function ActionCluster() {
  return (
    <>
      <FloatingCta />
      <AiCounselor />
    </>
  );
}
