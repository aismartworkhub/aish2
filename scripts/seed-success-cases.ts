/**
 * 데모 성공사례(DEMO_SUCCESS_CASES)를 Firestore(successCases)에 시드한다.
 * 공개 페이지에 데모로만 보이던 사례를 실제 문서로 만들어 관리자에서 편집·삭제 가능하게 한다.
 *
 * 환경변수:
 *   FIREBASE_SERVICE_ACCOUNT_KEY — Firebase 서비스 계정 JSON (GitHub Secret)
 *   FORCE — "true"면 기존 데이터가 있어도 덮어씀(기본: 비어 있을 때만 시드)
 *
 * 실행: npx tsx scripts/seed-success-cases.ts
 */
import * as admin from "firebase-admin";
import { DEMO_SUCCESS_CASES } from "../src/lib/demo-data";

const SA_KEY = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!SA_KEY) {
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY is required");
  process.exit(1);
}
const force = (process.env.FORCE ?? "").toLowerCase() === "true";

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(SA_KEY)) });
const firestore = admin.firestore();

async function main() {
  const col = firestore.collection("successCases");
  const existing = await col.limit(1).get();
  if (!existing.empty && !force) {
    console.log("successCases에 이미 데이터가 있습니다. FORCE=true 없이는 시드하지 않습니다.");
    return;
  }
  for (const item of DEMO_SUCCESS_CASES) {
    const { id, ...data } = item;
    await col.doc(id).set(data);
    console.log(`seeded: successCases/${id} (${data.title})`);
  }
  console.log(`완료 — ${DEMO_SUCCESS_CASES.length}건`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
