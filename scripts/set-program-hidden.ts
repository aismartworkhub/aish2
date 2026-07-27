/**
 * 자체 프로그램(programs 컬렉션) 문서의 hidden 필드를 일괄 설정하는 유지보수 스크립트.
 *
 * 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY — Firebase 서비스 계정 JSON (GitHub Secret)
 *   PROGRAM_IDS — 대상 문서 id (콤마 구분)
 *   HIDDEN — "true"(숨김) | "false"(노출), 기본 true
 *
 * 실행: npx tsx scripts/set-program-hidden.ts
 */
import * as admin from "firebase-admin";

const SA_KEY = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!SA_KEY) {
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY is required");
  process.exit(1);
}

const ids = (process.env.PROGRAM_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const hidden = (process.env.HIDDEN ?? "true").toLowerCase() === "true";

if (ids.length === 0) {
  console.error("PROGRAM_IDS is required (콤마 구분)");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(SA_KEY)) });
const firestore = admin.firestore();

async function main() {
  for (const id of ids) {
    const ref = firestore.doc(`programs/${id}`);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`skip: programs/${id} 없음`);
      continue;
    }
    await ref.update({ hidden });
    console.log(`updated: programs/${id} hidden=${hidden} (${snap.get("title")})`);
  }
  console.log("완료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
