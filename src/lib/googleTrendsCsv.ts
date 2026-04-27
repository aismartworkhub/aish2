/**
 * Google Trends CSV 파서 (시간별 검색 추이)
 *
 * trends.google.com에서 다운로드하는 CSV는 다음 형식을 따른다:
 *
 *   Category: All categories
 *
 *   Week,keyword: (Worldwide)
 *   2024-01-07,45
 *   2024-01-14,52
 *   ...
 *
 * 첫 줄에 메타정보, 빈 줄, 그 다음 헤더+데이터 라인이 이어진다.
 * "Week" 외에 "Day", "Month" 등 시간 단위 라벨이 가능하다.
 */

export interface TrendsSeriesPoint {
  date: string;
  value: number;
}

export interface ParsedTrendsCsv {
  category: string;
  timeUnit: "Day" | "Week" | "Month" | "Hour" | string;
  keywordHeader: string;
  series: TrendsSeriesPoint[];
}

const BOM = "﻿";
const TIME_UNIT_HEADERS = ["Day", "Week", "Month", "Hour", "시간", "일", "주", "월"];

function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuote = true;
      } else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseValue(raw: string): number {
  const t = raw.trim();
  if (!t) return 0;
  if (t === "<1") return 0.5;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Google Trends CSV 텍스트를 파싱한다.
 * 형식이 맞지 않으면 throw한다.
 */
export function parseGoogleTrendsCsv(text: string): ParsedTrendsCsv {
  const cleaned = stripBom(text).replace(/\r\n/g, "\n").trim();
  const lines = cleaned.split("\n");
  if (lines.length < 2) {
    throw new Error("CSV 형식이 올바르지 않습니다. (라인 부족)");
  }

  let category = "";
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.toLowerCase().startsWith("category:")) {
      category = line.slice(line.indexOf(":") + 1).trim();
      continue;
    }
    const cols = parseCsvLine(line);
    if (cols.length >= 2 && TIME_UNIT_HEADERS.some((u) => cols[0].toLowerCase() === u.toLowerCase())) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    throw new Error(
      "시계열 헤더(Day/Week/Month)를 찾을 수 없습니다. trends.google.com에서 '시간별 추이' CSV를 다운로드했는지 확인해 주세요."
    );
  }

  const headerCols = parseCsvLine(lines[headerIdx]);
  const timeUnit = headerCols[0];
  const keywordHeader = headerCols.slice(1).join(", ");

  const series: TrendsSeriesPoint[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCsvLine(line);
    if (cols.length < 2) continue;
    const date = cols[0];
    const value = parseValue(cols[1]);
    if (!date) continue;
    series.push({ date, value });
  }

  if (series.length === 0) {
    throw new Error("시계열 데이터가 비어있습니다.");
  }

  return { category, timeUnit, keywordHeader, series };
}

export function summarizeSeries(series: TrendsSeriesPoint[]): {
  min: number;
  max: number;
  avg: number;
  latest: number;
} {
  if (series.length === 0) return { min: 0, max: 0, avg: 0, latest: 0 };
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const p of series) {
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
    sum += p.value;
  }
  return {
    min,
    max,
    avg: Math.round((sum / series.length) * 10) / 10,
    latest: series[series.length - 1].value,
  };
}
