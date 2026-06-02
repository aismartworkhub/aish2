/**
 * AISH — Google 트렌드 인기 검색어 수집 (Google Apps Script)
 *
 * 목적: 브라우저 OAuth 팝업 없이, GAS(구글 서버측)가 BigQuery 공개 데이터셋을
 *       조회해 Firestore `googleTrendsTop` 캐시에 저장한다.
 *       관리자 트렌드 페이지는 이 캐시를 "읽기만" 하므로 팝업/COOP 문제가 사라진다.
 *
 * 동작 계정: 스크립트 소유자는 반드시 aish-web-v2 GCP 프로젝트의 Owner/Editor 여야 한다
 *           (BigQuery 실행 + Firestore 쓰기 IAM 권한). 보통 aismartworkhub@gmail.com.
 *           → Firestore 보안 규칙(admin only)은 IAM 주체에는 적용되지 않아 그대로 쓰기 가능.
 *
 * 설치: scripts/gas/README.md 참고. 한 줄 요약:
 *   1) script.google.com 새 프로젝트(소유자=프로젝트 Owner 계정)
 *   2) 프로젝트 설정 → GCP 프로젝트를 aish-web-v2(번호 96691437365)로 변경
 *   3) 서비스 → BigQuery API(고급 서비스) 추가
 *   4) 이 파일 + appsscript.json 붙여넣기
 *   5) collectTrends 1회 실행(권한 승인) → installDailyTrigger 1회 실행
 */

var GCP_PROJECT = 'aish-web-v2';
var FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/' + GCP_PROJECT + '/databases/(default)/documents';
var COLLECTION = 'googleTrendsTop';
var TERM_LIMIT = 25;

/** 수집 대상 국가 — 라벨은 트렌드 페이지(BIGQUERY_SUPPORTED_COUNTRIES)와 일치시킬 것. */
var COUNTRIES = [
  { code: 'KR', label: '대한민국' },
  { code: 'US', label: '미국' },
  { code: 'JP', label: '일본' },
  { code: 'GB', label: '영국' },
  { code: 'DE', label: '독일' },
  { code: 'FR', label: '프랑스' },
  { code: 'IN', label: '인도' },
  { code: 'BR', label: '브라질' },
  { code: 'CA', label: '캐나다' },
  { code: 'AU', label: '호주' },
  { code: 'ID', label: '인도네시아' },
  { code: 'VN', label: '베트남' },
  { code: 'TH', label: '태국' },
  { code: 'TW', label: '대만' },
];

/** 메인 — 국가별 Top 검색어를 조회해 Firestore에 저장. (트리거가 호출) */
function collectTrends() {
  var ok = 0;
  for (var i = 0; i < COUNTRIES.length; i++) {
    var c = COUNTRIES[i];
    try {
      var terms = c.code === 'US' ? fetchUsTopTerms_() : fetchInternationalTopTerms_(c.code);
      if (!terms.length) {
        Logger.log('skip %s (빈 결과)', c.code);
        continue;
      }
      var refreshDate = terms[0].refreshDate || 'unknown';
      var docId = c.code + '_' + refreshDate;
      writeFirestoreDoc_(docId, {
        countryCode: c.code,
        countryLabel: c.label,
        refreshDate: refreshDate,
        fetchedAt: Date.now(),
        terms: terms,
      });
      ok++;
      Logger.log('saved %s (%s terms)', docId, terms.length);
    } catch (e) {
      Logger.log('FAIL %s: %s', c.code, e && e.message ? e.message : e);
    }
  }
  Logger.log('완료: %s/%s 국가 저장', ok, COUNTRIES.length);
}

/* ── BigQuery ── */

function runBq_(sql) {
  var resp = BigQuery.Jobs.query({ query: sql, useLegacySql: false, timeoutMs: 30000 }, GCP_PROJECT);
  if (!resp.jobComplete) throw new Error('BigQuery 쿼리가 시간 내에 완료되지 않음');
  var fields = (resp.schema && resp.schema.fields) || [];
  var rows = resp.rows || [];
  return rows.map(function (row) {
    var obj = {};
    fields.forEach(function (f, idx) {
      obj[f.name] = row.f[idx] ? row.f[idx].v : null;
    });
    return obj;
  });
}

/** 국가별 일간 인기 검색어 (international_top_terms). TS fetchInternationalTopTerms 와 동일. */
function fetchInternationalTopTerms_(countryCode) {
  var safe = countryCode.replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 2);
  var sql =
    'SELECT rank, term, refresh_date, country_code, country_name, score, week ' +
    'FROM `bigquery-public-data.google_trends.international_top_terms` ' +
    "WHERE country_code = '" + safe + "' AND refresh_date = (" +
    '  SELECT MAX(refresh_date) FROM `bigquery-public-data.google_trends.international_top_terms`' +
    "  WHERE country_code = '" + safe + "') " +
    'ORDER BY rank ASC LIMIT ' + TERM_LIMIT;
  return runBq_(sql).map(function (r) {
    return {
      rank: Number(r.rank || 0),
      term: r.term || '',
      refreshDate: r.refresh_date || '',
      countryCode: r.country_code || undefined,
      countryName: r.country_name || undefined,
      score: r.score == null ? null : Number(r.score),
      weekIso: r.week || undefined,
    };
  });
}

/** 미국 일간 인기 검색어 (top_terms). TS fetchUsTopTerms 와 동일. */
function fetchUsTopTerms_() {
  var sql =
    'SELECT rank, term, refresh_date, score, week ' +
    'FROM `bigquery-public-data.google_trends.top_terms` ' +
    'WHERE refresh_date = (SELECT MAX(refresh_date) FROM `bigquery-public-data.google_trends.top_terms`) ' +
    'ORDER BY rank ASC LIMIT ' + TERM_LIMIT;
  return runBq_(sql).map(function (r) {
    return {
      rank: Number(r.rank || 0),
      term: r.term || '',
      refreshDate: r.refresh_date || '',
      countryCode: 'US',
      countryName: 'United States',
      score: r.score == null ? null : Number(r.score),
      weekIso: r.week || undefined,
    };
  });
}

/* ── Firestore REST 쓰기 (소유자 OAuth 토큰 → IAM 으로 보안 규칙 우회) ── */

function writeFirestoreDoc_(docId, obj) {
  var url = FIRESTORE_BASE + '/' + COLLECTION + '/' + encodeURIComponent(docId);
  var res = UrlFetchApp.fetch(url, {
    method: 'patch', // PATCH = upsert (문서 ID 지정 생성/덮어쓰기)
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ fields: toFirestoreFields_(obj) }),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code >= 300) throw new Error('Firestore write ' + code + ': ' + res.getContentText());
}

function toFirestoreValue_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Object.prototype.toString.call(v) === '[object Array]') {
    return { arrayValue: { values: v.map(toFirestoreValue_) } };
  }
  if (typeof v === 'object') return { mapValue: { fields: toFirestoreFields_(v) } };
  return { stringValue: String(v) };
}

function toFirestoreFields_(obj) {
  var fields = {};
  Object.keys(obj).forEach(function (k) {
    if (obj[k] === undefined) return; // undefined 필드는 생략
    fields[k] = toFirestoreValue_(obj[k]);
  });
  return fields;
}

/* ── 트리거 ── */

/** 하루 1회(오전 6시) 자동 수집 트리거 설치. 한 번만 실행하면 됨. */
function installDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'collectTrends') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('collectTrends').timeBased().everyDays(1).atHour(6).create();
  Logger.log('일간 트리거 설치 완료 (매일 06시)');
}
