#!/usr/bin/env bash
# Ralph loop: lint + build를 최대 N회 반복(기본 3). 성공 후 commit / push / Firebase Hosting(선택).
#
# 로컬 터미널에서 실행하세요. Cursor 샌드박스에서는 git·next가 길게 멈추거나 I/O 타임아웃이 날 수 있습니다.
#
# 환경 변수:
#   RALPH_ROUNDS=3          검증 반복 횟수
#   SKIP_GIT=1              커밋/푸시 생략
#   SKIP_FIREBASE=1         firebase deploy 생략
#   COMMIT_MSG="..."        커밋 메시지
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
export CI="${CI:-true}"

MAX_ROUNDS="${RALPH_ROUNDS:-3}"
COMMIT_MSG="${COMMIT_MSG:-chore(security): user Gemini key in private doc, stricter Firestore rules, GitHub CI}"

echo "== Ralph: $MAX_ROUNDS round(s) of lint + build =="
for i in $(seq 1 "$MAX_ROUNDS"); do
  echo "--- Round $i / $MAX_ROUNDS ---"
  npm run lint
  npm run build
  echo "Round $i OK"
done

if [[ "${SKIP_GIT:-}" == "1" ]]; then
  echo "SKIP_GIT=1: skipping commit/push"
else
  if [[ -n "$(git status --porcelain 2>/dev/null || true)" ]]; then
    git add -A
    git commit -m "$COMMIT_MSG"
  else
    echo "No changes to commit."
  fi

  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if git remote get-url origin >/dev/null 2>&1; then
    if git rev-parse --abbrev-ref "@{u}" >/dev/null 2>&1; then
      git push
    else
      git push -u origin "$CURRENT_BRANCH"
    fi
  else
    echo "No git remote 'origin'; skip push."
  fi
fi

if [[ "${SKIP_FIREBASE:-}" == "1" ]]; then
  echo "SKIP_FIREBASE=1: skipping firebase deploy"
  exit 0
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "firebase CLI not found; skip deploy. Install: npm i -g firebase-tools"
  exit 0
fi

if [[ ! -d "$ROOT/out" ]]; then
  echo "Missing out/ — run npm run build first"
  exit 1
fi

firebase deploy --only firestore:rules,hosting
