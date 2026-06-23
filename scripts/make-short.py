#!/usr/bin/env python3
"""
숏폼(9:16) 자동 생성 — 한글 요약 → 2~3 장면(브랜드 카드 + 한글 TTS) → ffmpeg 합성.

원칙: 남의 영상/이미지를 재사용하지 않는다. 텍스트 요약 + 자체 브랜드 카드 + 무료 TTS만 사용.
무료 스톡 B-roll(Pexels)은 PEXELS_API_KEY가 있을 때만 배경으로 사용(선택), 없으면 그라데이션 배경.

출력: out/short.mp4 (드라이런 — 업로드 없음)

필요: Pillow, edge-tts, ffmpeg, 한글 폰트(NanumGothic)
환경변수(선택): CONTENT_TITLE, CONTENT_SUMMARY, CONTENT_URL, PEXELS_API_KEY, PEXELS_QUERY
없으면 Firestore(공개읽기)에서 최신 커뮤니티 글을 가져와 사용.
"""
import asyncio
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
FPS = 30
OUT = Path("out")
OUT.mkdir(exist_ok=True)

FONT_DIR_CANDIDATES = [
    "/usr/share/fonts/truetype/nanum",
    "/usr/share/fonts/opentype/noto",
    "/Library/Fonts",
    "/System/Library/Fonts/Supplemental",
]


def find_font(bold=False):
    names = (
        ["NanumGothicBold.ttf", "NanumGothic.ttf"] if bold else ["NanumGothic.ttf"]
    ) + ["NotoSansCJK-Bold.ttc", "NotoSansCJK-Regular.ttc", "AppleSDGothicNeo.ttc"]
    for d in FONT_DIR_CANDIDATES:
        for n in names:
            p = Path(d) / n
            if p.exists():
                return str(p)
    # 최후: PIL 기본(한글 깨질 수 있음)
    return None


FONT_BOLD = find_font(bold=True)
FONT_REG = find_font(bold=False) or FONT_BOLD


def font(size, bold=True):
    path = FONT_BOLD if bold else FONT_REG
    if path:
        return ImageFont.truetype(path, size)
    return ImageFont.load_default()


# ── 콘텐츠 로드 ──────────────────────────────────────────────
def load_content():
    title = os.environ.get("CONTENT_TITLE")
    summary = os.environ.get("CONTENT_SUMMARY")
    url = os.environ.get("CONTENT_URL", "")
    if title and summary:
        return title, summary, url
    # Firestore 공개읽기 — 최신 커뮤니티 AI글
    try:
        body = json.dumps({
            "structuredQuery": {
                "from": [{"collectionId": "contents"}],
                "where": {"compositeFilter": {"op": "AND", "filters": [
                    {"fieldFilter": {"field": {"fieldPath": "group"}, "op": "EQUAL", "value": {"stringValue": "community"}}},
                    {"fieldFilter": {"field": {"fieldPath": "authorUid"}, "op": "EQUAL", "value": {"stringValue": "ai-collector"}}},
                ]}},
                "orderBy": [{"field": {"fieldPath": "createdAt"}, "direction": "DESCENDING"}],
                "limit": 1,
            }
        }).encode()
        req = urllib.request.Request(
            "https://firestore.googleapis.com/v1/projects/aish-web-v2/databases/(default)/documents:runQuery",
            data=body, headers={"Content-Type": "application/json"},
        )
        rows = json.loads(urllib.request.urlopen(req, timeout=15).read())
        for e in rows:
            f = e.get("document", {}).get("fields", {})
            if not f:
                continue
            t = f.get("titleKo", {}).get("stringValue") or f.get("title", {}).get("stringValue", "")
            s = f.get("bodyKo", {}).get("stringValue") or f.get("body", {}).get("stringValue", "")
            u = f.get("mediaUrl", {}).get("stringValue", "")
            if t:
                return t, s, u
    except Exception as e:
        print(f"[content] Firestore 로드 실패: {e}", file=sys.stderr)
    return ("AI 뉴스 요약", "오늘의 AI 소식을 30초로 정리했습니다.", "https://www.aish.co.kr")


# ── 텍스트 줄바꿈 ────────────────────────────────────────────
def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), "", []
    for w in words:
        trial = (cur and " ".join(cur + [w])) or w
        if draw.textlength(trial, font=fnt) <= max_w:
            cur.append(w)
        else:
            if cur:
                lines.append(" ".join(cur))
            cur = [w]
    if cur:
        lines.append(" ".join(cur))
    return lines


def gradient_bg():
    base = Image.new("RGB", (W, H))
    top, bot = (10, 22, 50), (18, 70, 160)  # 네이비 → 블루
    px = base.load()
    for y in range(H):
        r = top[0] + (bot[0] - top[0]) * y // H
        g = top[1] + (bot[1] - top[1]) * y // H
        b = top[2] + (bot[2] - top[2]) * y // H
        for x in range(W):
            px[x, y] = (r, g, b)
    return base


def draw_card(idx, kicker, title, body, footer):
    img = gradient_bg()
    d = ImageDraw.Draw(img)
    margin = 90
    # 상단 브랜드 키커
    d.rounded_rectangle([margin, 150, margin + 360, 240], radius=44, fill=(255, 77, 0))
    d.text((margin + 40, 168), kicker, font=font(46, True), fill=(255, 255, 255))
    # 제목
    y = 520
    tf = font(96, True)
    for line in wrap(d, title, tf, W - margin * 2):
        d.text((margin, y), line, font=tf, fill=(255, 255, 255))
        y += 120
    # 본문
    if body:
        y += 40
        bf = font(58, False)
        for line in wrap(d, body, bf, W - margin * 2):
            d.text((margin, y), line, font=bf, fill=(210, 224, 255))
            y += 84
    # 푸터
    if footer:
        d.text((margin, H - 230), footer, font=font(44, False), fill=(150, 180, 240))
    d.text((margin, H - 150), "AISH · AI Smartwork Hub", font=font(46, True), fill=(255, 255, 255))
    p = OUT / f"card{idx}.png"
    img.save(p)
    return str(p)


# ── TTS ─────────────────────────────────────────────────────
async def tts(text, path):
    import edge_tts
    await edge_tts.Communicate(text, "ko-KR-SunHiNeural").save(path)


def synth(text, idx):
    p = str(OUT / f"nar{idx}.mp3")
    asyncio.run(tts(text, p))
    return p


def duration(path):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", path,
    ]).decode().strip()
    return max(2.0, float(out))


# ── 장면 1개를 mp4로 ────────────────────────────────────────
def make_segment(idx, card_png, narration_mp3):
    dur = duration(narration_mp3) + 0.6
    frames = int(dur * FPS)
    seg = str(OUT / f"seg{idx}.mp4")
    # Ken Burns 줌으로 정적 화면 방지
    vf = (
        f"scale=1350:2400,zoompan=z='min(zoom+0.0006,1.10)':d={frames}:"
        f"s={W}x{H}:fps={FPS},format=yuv420p"
    )
    subprocess.run([
        "ffmpeg", "-y", "-loop", "1", "-i", card_png, "-i", narration_mp3,
        "-vf", vf, "-t", f"{dur:.2f}",
        "-c:v", "libx264", "-c:a", "aac", "-b:a", "128k", "-pix_fmt", "yuv420p",
        "-shortest", seg,
    ], check=True)
    return seg


def concat(segs):
    # cwd=OUT 로 실행하므로 모든 경로는 OUT 기준 상대경로 사용
    (OUT / "list.txt").write_text("".join(f"file '{Path(s).name}'\n" for s in segs))
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "list.txt",
        "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "short.mp4",
    ], cwd=str(OUT), check=True)
    return str(OUT / "short.mp4")


def main():
    title, summary, url = load_content()
    domain = urllib.parse.urlparse(url).netloc.replace("www.", "") if url else ""
    print(f"[short] 제목: {title}")
    print(f"[short] 요약: {summary[:60]}...")

    # 2~3 장면 구성
    scenes = [
        {"kicker": "AI 뉴스", "title": title, "body": "", "footer": "",
         "narr": title},
        {"kicker": "요점", "title": title if len(title) < 18 else "핵심 요약",
         "body": summary, "footer": "",
         "narr": summary or title},
        {"kicker": "더보기", "title": "전체 내용은\n설명란 링크에서",
         "body": (f"출처: {domain}" if domain else ""), "footer": "구독 · 좋아요 환영",
         "narr": "자세한 내용은 설명란의 원문 링크를 확인하세요."},
    ]

    segs = []
    for i, sc in enumerate(scenes):
        card = draw_card(i, sc["kicker"], sc["title"], sc["body"], sc["footer"])
        nar = synth(sc["narr"], i)
        segs.append(make_segment(i, card, nar))

    final = concat(segs)
    dur = duration(final)
    print(f"[short] 완료 → {final} ({dur:.1f}초)")


if __name__ == "__main__":
    main()
