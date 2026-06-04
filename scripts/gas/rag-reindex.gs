/**
 * AISH — 상담 AI RAG 색인 자동 재생성 (Google Apps Script · 선택)
 *
 * 목적: 매일(또는 트리거) 콘텐츠를 임베딩 색인해 siteSettings/ai-index 갱신.
 *   앱의 "재색인" 버튼과 동일 결과(text-embedding-004 · 256차원). 상담 AI가 그대로 사용.
 *
 * 참고: 과정·강사 등 변동 데이터는 상담 AI가 평소에도 자동 주입하므로, 이 자동화는 "보강"입니다.
 *   AI 지식 저장 시에는 앱이 자동 재색인하므로, 이 GAS는 "그 외 변경(FAQ·강사 등)을 매일 반영"용입니다.
 *
 * 설치(요약):
 *   1) script.google.com 새 프로젝트(소유자 = aish-web-v2 Owner 계정)
 *   2) 이 파일 붙여넣기 + appsscript.json 의 oauthScopes 에 datastore/script.external_request 포함
 *   3) 프로젝트 설정 → GCP 프로젝트를 aish-web-v2(번호 96691437365)로 변경
 *   4) 프로젝트 설정 → 스크립트 속성:
 *        GEMINI_API_KEY = (siteSettings/gemini 의 키)
 *        RUNMOA_API_KEY = (선택, 있으면 과정도 색인)
 *   5) reindex 1회 실행(권한 승인) → installDailyTrigger 1회 실행
 */

var GCP_PROJECT = 'aish-web-v2';
var FS = 'https://firestore.googleapis.com/v1/projects/' + GCP_PROJECT + '/databases/(default)/documents';
var EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents';
var DIMS = 256;
var MAX_CHUNKS = 120;
var CHUNK_CHARS = 700;
var BATCH = 100;

function prop(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }

/* ── 메인 ── */
function reindex() {
  var gemKey = prop('GEMINI_API_KEY');
  if (!gemKey) throw new Error('스크립트 속성 GEMINI_API_KEY 가 없습니다.');

  var sources = gatherSources_();
  if (!sources.length) throw new Error('색인할 콘텐츠가 없습니다.');
  sources = sources.slice(0, MAX_CHUNKS);

  var vectors = embedAll_(gemKey, sources.map(function (s) { return s.text; }));
  var chunks = sources.map(function (s, i) {
    return { id: String(i), text: s.text, source: s.source, vector: (vectors[i] || []).map(round6_) };
  });

  writeIndex_(chunks);
  Logger.log('색인 완료: %s개 조각', chunks.length);
}

/* ── 소스 수집 (Firestore + 선택적 Runmoa) ── */
function gatherSources_() {
  var out = [];

  var kn = fsGetDoc_('siteSettings/ai-knowledge');
  if (kn) {
    [['관리자지식', kn.manual], ['드라이브자료', kn.drive], ['유튜브', kn.youtube]].forEach(function (p) {
      if (p[1]) chunkText_(p[1]).forEach(function (c) { out.push({ text: c, source: p[0] }); });
    });
  }

  var rk = prop('RUNMOA_API_KEY');
  if (rk) {
    try {
      var res = UrlFetchApp.fetch('https://aish.runmoa.com/api/public/v1/contents?status=publish&limit=100', {
        headers: { Authorization: 'Bearer ' + rk, Accept: 'application/json' }, muteHttpExceptions: true,
      });
      if (res.getResponseCode() < 300) {
        var data = JSON.parse(res.getContentText()).data || [];
        data.forEach(function (c) {
          var cats = (c.categories || []).map(function (x) { return x.name; }).filter(String).join(', ');
          var price = c.is_free ? '무료' : (c.is_on_sale && c.sale_price > 0 ? c.sale_price + '원' : (c.base_price > 0 ? c.base_price + '원' : ''));
          var desc = stripHtml_(c.description_html || '').slice(0, 400);
          out.push({ text: '[교육과정] ' + c.title + (cats ? ' · ' + cats : '') + (price ? ' · ' + price : '') + (desc ? '\n' + desc : ''), source: '과정' });
        });
      }
    } catch (e) { Logger.log('Runmoa skip: %s', e.message); }
  }

  fsGetCollection_('faq').forEach(function (f) {
    if (f.question) out.push({ text: '[FAQ] Q: ' + f.question + '\nA: ' + (f.answer || ''), source: 'FAQ' });
  });

  fsGetCollection_('instructors').forEach(function (i) {
    if (i.isActive === false || !i.name) return;
    var org = [i.title, i.organization].filter(String).join(' · ');
    var sp = (i.specialties && i.specialties.length) ? '\n전문: ' + i.specialties.join(', ') : '';
    var bio = i.bio ? '\n' + String(i.bio).slice(0, 300) : '';
    out.push({ text: '[강사] ' + i.name + (org ? ' (' + org + ')' : '') + sp + bio, source: '강사' });
  });

  var biz = fsGetDoc_('siteSettings/business');
  if (biz) {
    var lines = [biz.companyName && '상호 ' + biz.companyName, biz.address && '주소 ' + biz.address, biz.phone && '고객센터 ' + biz.phone, biz.email && '이메일 ' + biz.email].filter(String).join(' · ');
    if (lines) out.push({ text: '[사업자정보] ' + lines, source: '사업자' });
  }
  return out;
}

/* ── 임베딩 (Gemini REST) ── */
function embedAll_(key, texts) {
  var out = [];
  for (var i = 0; i < texts.length; i += BATCH) {
    var batch = texts.slice(i, i + BATCH);
    var body = {
      requests: batch.map(function (t) {
        return { model: 'models/text-embedding-004', content: { parts: [{ text: t }] }, outputDimensionality: DIMS };
      }),
    };
    var res = UrlFetchApp.fetch(EMBED_URL + '?key=' + key, {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 300) throw new Error('임베딩 실패 ' + res.getResponseCode() + ': ' + res.getContentText());
    (JSON.parse(res.getContentText()).embeddings || []).forEach(function (e) { out.push(e.values || []); });
  }
  return out;
}

/* ── Firestore REST 읽기/쓰기 (소유자 토큰 = IAM 우회) ── */
function fsHeaders_() { return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }; }

function fsGetDoc_(path) {
  var res = UrlFetchApp.fetch(FS + '/' + path, { headers: fsHeaders_(), muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) return null;
  return fromFields_(JSON.parse(res.getContentText()).fields || {});
}
function fsGetCollection_(name) {
  var res = UrlFetchApp.fetch(FS + '/' + name + '?pageSize=100', { headers: fsHeaders_(), muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) return [];
  return (JSON.parse(res.getContentText()).documents || []).map(function (d) { return fromFields_(d.fields || {}); });
}
function writeIndex_(chunks) {
  var payload = { fields: toFields_({ chunks: chunks, count: chunks.length, dims: DIMS, model: 'text-embedding-004' }) };
  var res = UrlFetchApp.fetch(FS + '/siteSettings/ai-index', {
    method: 'patch', contentType: 'application/json', headers: fsHeaders_(), payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error('ai-index 쓰기 실패 ' + res.getResponseCode() + ': ' + res.getContentText());
}

/* ── Firestore 타입 변환 ── */
function fromVal_(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(fromVal_);
  if (v.mapValue !== undefined) return fromFields_(v.mapValue.fields || {});
  return null;
}
function fromFields_(f) { var o = {}; Object.keys(f).forEach(function (k) { o[k] = fromVal_(f[k]); }); return o; }

function toVal_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Object.prototype.toString.call(v) === '[object Array]') return { arrayValue: { values: v.map(toVal_) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields_(v) } };
  return { stringValue: String(v) };
}
function toFields_(o) { var f = {}; Object.keys(o).forEach(function (k) { if (o[k] !== undefined) f[k] = toVal_(o[k]); }); return f; }

/* ── 유틸 ── */
function stripHtml_(h) { return String(h).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }
function round6_(n) { return Math.round(n * 1e6) / 1e6; }
function chunkText_(text) {
  var clean = String(text).replace(/\r/g, '').trim();
  if (clean.length <= CHUNK_CHARS) return clean ? [clean] : [];
  var out = [], buf = '';
  clean.split(/\n{2,}/).forEach(function (p) {
    if ((buf + '\n\n' + p).length > CHUNK_CHARS) {
      if (buf) out.push(buf.trim());
      if (p.length > CHUNK_CHARS) { for (var i = 0; i < p.length; i += CHUNK_CHARS) out.push(p.slice(i, i + CHUNK_CHARS).trim()); buf = ''; }
      else buf = p;
    } else buf = buf ? buf + '\n\n' + p : p;
  });
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/* ── 트리거 ── */
function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'reindex') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('reindex').timeBased().everyDays(1).atHour(5).create();
  Logger.log('일간 트리거 설치 완료 (매일 05시)');
}
