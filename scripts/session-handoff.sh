#!/usr/bin/env bash
# 세션 종료 시 git 상태를 .claude/session/handoff.md 에 자동 기록.
# Claude Code Stop hook에서 호출됨.
# 출력 파일은 매번 덮어쓰며, .claude/ 가 gitignore라 로컬 전용.

set -e
cd "$(dirname "$0")/.."

mkdir -p .claude/session
OUT=".claude/session/handoff.md"

{
  echo "# Session Handoff (자동 생성)"
  echo
  echo "_세션 종료 시각: $(date '+%Y-%m-%d %H:%M:%S %Z')_"
  echo "_생성 스크립트: scripts/session-handoff.sh (Stop hook)_"
  echo
  echo "## 최근 커밋 (8건)"
  echo
  echo '```'
  git log --oneline -8 2>/dev/null || echo "(git log 실패)"
  echo '```'
  echo
  echo "## 미커밋 변경 (working tree)"
  echo
  echo '```'
  STATUS=$(git status --short 2>/dev/null || echo "")
  if [ -z "$STATUS" ]; then
    echo "(clean — 미커밋 변경 없음)"
  else
    echo "$STATUS"
  fi
  echo '```'
  echo
  echo "## 브랜치 / 원격 동기화"
  echo
  echo '```'
  git status -sb 2>/dev/null | head -1 || echo "(상태 불명)"
  echo '```'
  echo
  echo "---"
  echo
  echo "**이 파일은 매 세션 종료 시 자동 덮어쓰기됩니다. 직접 편집 X.**"
  echo "**작업 맥락(완료/잔여/대기)은 \`.claude/session/status.md\` 에 별도 관리.**"
} > "$OUT"
