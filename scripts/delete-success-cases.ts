/**
 * 성공사례(successCases) 문서를 id로 일괄 삭제하는 유지보수 스크립트.
 *
 * 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY — Firebase 서비스 계정 JSON (GitHub Secret)
 *   CASE_IDS — 삭제할 문서 id (콤마 구분, 필수)
 *
 * 실행: npx tsx scripts/delete-success-cases.ts
 */
import * as admin from "firebase-admin";

const SA_KEY = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!SA_KEY) {
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY is required");
  process.exit(1);
}

const ids = (process.env.CASE_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (ids.length === 0) {
  console.error("CASE_IDS is required (콤마 구분)");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(SA_KEY)) });
const firestore = admin.firestore();

async function main() {
  for (const id of ids) {
    const ref = firestore.doc(`successCases/${id}`);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`skip: successCases/${id} 없음`);
      continue;
    }
    const title = snap.get("title");
    await ref.delete();
    console.log(`deleted: successCases/${id} (${title})`);
  }
  console.log("완료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
