/**
 * Google Apps Script 웹 앱 — AISH 백엔드 미들웨어
 *
 * 이 파일은 Google Apps Script 프로젝트에 붙여넣기 합니다.
 * (Next.js 빌드에 포함되지 않음)
 *
 * 배포 방법:
 * 1. https://script.google.com 에서 새 프로젝트 생성
 * 2. 아래 코드를 코드.gs에 붙여넣기
 * 3. "배포 → 새 배포" → 유형: 웹 앱
 * 4. 실행 사용자: 본인, 액세스: 모든 사용자
 * 5. 배포 URL을 AISH 관리자 패널 > 기능 관리 > Phase 2 > Apps Script URL에 입력
 */

// ─── 설정 (본인 환경에 맞게 수정) ───
const ADMIN_EMAIL = "aismartworkhub@gmail.com";
const DRIVE_FOLDER_NAME = "AISH_BusinessCards";
const SHEET_NAME = "AISH_BusinessCards_Log";

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var type = payload.type;

    switch (type) {
      case "welcome-email":
        return handleWelcomeEmail(payload);
      case "admin-notify":
        return handleAdminNotify(payload);
      case "business-card":
        return handleBusinessCard(payload);
      case "fetch-og-image":
        return handleFetchOgImage(payload);
      default:
        return jsonResponse({ success: false, error: "Unknown type: " + type });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doGet() {
  return jsonResponse({ status: "ok", message: "AISH GAS Web App is running" });
}

// ─── 환영 이메일 ───
function handleWelcomeEmail(payload) {
  var email = payload.email;
  var displayName = payload.displayName || "회원";

  var subject = "[AISH] 가입을 환영합니다!";
  var htmlBody =
    '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">' +
    '<div style="background:#1e3a5f;color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0">' +
    '<h1 style="margin:0;font-size:24px">AISH</h1>' +
    '<p style="margin:8px 0 0;opacity:0.8">AI Smart Hub</p></div>' +
    '<div style="padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">' +
    '<h2 style="color:#1e3a5f;margin-top:0">안녕하세요, ' + displayName + '님!</h2>' +
    '<p style="color:#6b7280;line-height:1.8">' +
    'AISH(AI Smart Hub)에 가입해주셔서 감사합니다.<br>' +
    '체계적인 AI 교육과 활발한 커뮤니티 활동으로 함께 성장해 나가요.</p>' +
    '<div style="margin:24px 0">' +
    '<a href="https://aish-web-v2.web.app" ' +
    'style="display:inline-block;background:#1e3a5f;color:white;padding:12px 32px;' +
    'text-decoration:none;border-radius:6px;font-weight:bold">AISH 방문하기</a></div>' +
    '<p style="color:#9ca3af;font-size:12px;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:16px">' +
    '본 메일은 AISH 가입 시 자동 발송됩니다.</p></div></div>';

  GmailApp.sendEmail(email, subject, "", { htmlBody: htmlBody, name: "AISH" });
  return jsonResponse({ success: true, action: "welcome-email" });
}

// ─── 관리자 알림 ───
function handleAdminNotify(payload) {
  var subject = "[AISH] " + (payload.subject || "새 알림");
  var body = payload.body || JSON.stringify(payload.data, null, 2);

  GmailApp.sendEmail(ADMIN_EMAIL, subject, body, { name: "AISH System" });
  return jsonResponse({ success: true, action: "admin-notify" });
}

// ─── 명함 → Drive 저장 ───
function handleBusinessCard(payload) {
  var imageBase64 = payload.imageBase64;
  var fileName = payload.fileName || "businesscard_" + new Date().getTime() + ".jpg";
  var userEmail = payload.userEmail || "unknown";
  var userName = payload.userName || "unknown";

  var folder = getOrCreateFolder(DRIVE_FOLDER_NAME);
  var blob = Utilities.newBlob(Utilities.base64Decode(imageBase64), "image/jpeg", fileName);
  var file = folder.createFile(blob);

  logToSheet(SHEET_NAME, [new Date(), userEmail, userName, file.getUrl(), fileName]);

  return jsonResponse({
    success: true,
    action: "business-card",
    fileUrl: file.getUrl(),
    fileId: file.getId(),
  });
}

// ─── og:image 추출 (외부 URL → 메타 이미지) ───
// CORS 회피용. 클라이언트(/admin/contents)에서 외부 기사 URL을 등록할 때 호출됨.
function handleFetchOgImage(payload) {
  var url = payload.url;
  if (!url || !/^https?:\/\//.test(url)) {
    return jsonResponse({ ok: false, error: "Invalid URL" });
  }
  try {
    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AISH-bot/1.0)" },
    });
    var code = res.getResponseCode();
    if (code >= 400) {
      return jsonResponse({ ok: false, error: "Fetch failed: HTTP " + code });
    }
    var html = res.getContentText().slice(0, 200000); // 200KB cap — 대부분의 사이트 head는 이 안에 들어감
    var headMatch = html.match(/<head[\s\S]*?<\/head>/i);
    var head = headMatch ? headMatch[0] : html;
    // og:image (property 순서 양방향) + twitter:image (name 순서 양방향) 4종 패턴
    var patterns = [
      /<meta\s+[^>]*property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /<meta\s+[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:image["']/i,
      /<meta\s+[^>]*name\s*=\s*["']twitter:image["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /<meta\s+[^>]*content\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']twitter:image["']/i,
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = head.match(patterns[i]);
      if (m && m[1]) {
        var img = m[1].trim();
        // 상대 URL → 절대 URL
        if (img.indexOf("//") === 0) {
          img = "https:" + img;
        } else if (img.charAt(0) === "/") {
          var origin = url.match(/^(https?:\/\/[^/]+)/);
          if (origin) img = origin[1] + img;
        }
        return jsonResponse({ ok: true, ogImage: img });
      }
    }
    return jsonResponse({ ok: false, error: "No og:image found" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

// ─── 유틸 ───
function getOrCreateFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function logToSheet(sheetName, rowData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    ss = SpreadsheetApp.create(sheetName);
  }
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(["일시", "이메일", "이름", "파일URL", "파일명"]);
  }
  sheet.appendRow(rowData);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
