#!/usr/bin/env node
/**
 * CI/원격 푸시 검증용 최소 스모크 테스트 (외부 러너 없음).
 * `npm test` 로 실행.
 */
import { strict as assert } from "node:assert";

function pageDocId(key) {
  return `page_${key}`;
}

assert.equal(pageDocId("home"), "page_home");
assert.equal(pageDocId("about"), "page_about");
console.log("remote-push-test: ok");
