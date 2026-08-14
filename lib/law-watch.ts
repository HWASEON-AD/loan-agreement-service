// 법령 변경 감시 — 매일 1회 공식 사이트(법제처)를 그대로 받아서 개정 여부를 확인한다.
//
// ★ 설계 원칙 (중요)
//  1. **API 키를 쓰지 않는다.** 공개 페이지를 HTTP 로 받아 파싱만 한다.
//  2. **감지만 하고 자동 반영하지 않는다.** 법이 바뀌면 계산 로직·경과규정을 사람이 검토해야 한다.
//     크론은 "달라졌다"를 알리는 데까지만 책임진다.
//  3. **파싱 실패를 '이상 없음'으로 표시하지 않는다.** 사이트 구조가 바뀌면 조용히 실패하는데,
//     그때 화면에 "오늘 확인함"이 계속 찍히면 최악이다. 성공/실패를 구분해 저장하고,
//     연속 실패가 쌓이면 알린다. (침묵 실패 방지)

import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "./supabase";

// 감시 대상 — 전부 법제처(공식) 페이지
export const WATCH_TARGETS = {
  // 국가법령정보센터 조문정보 — 정적 HTML 로 조문 전문과 시행일·법률번호가 그대로 나온다.
  article: {
    key: "주택임대차보호법_제6조의3",
    url: "https://law.go.kr/lsLawLinkInfo.do?lsJoLnkSeq=1007847519&chrClsCd=010202&ancYnChk=0",
  },
  // 찾기쉬운 생활법령정보(법제처) — 행사기간 문구가 살아있는지 교차 확인용
  guide: {
    key: "생활법령_임대차계약갱신",
    url: "https://www.easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=629&ccfNo=4&cciNo=4&cnpClsNo=1",
  },
} as const;

// 이 문구들이 사라지면 = 기간 규정이 바뀌었을 가능성 → 사람이 확인해야 한다.
const GUIDE_MUST_CONTAIN = ["6개월 전부터", "2개월", "2020년 12월 10일"];

export type LawSnapshot = {
  /** 시행일 (YYYY-MM-DD) */
  effectiveDate: string | null;
  /** 법률 제NNNNN호 */
  lawNumber: string | null;
  /** 개정 구분 (일부개정 / 타법개정 등) */
  revisionType: string | null;
  /** 조문 본문 해시 — 본문이 한 글자라도 바뀌면 달라진다 */
  bodyHash: string | null;
  /** 조문 본문 앞부분 (사람이 눈으로 확인할 때 쓴다) */
  bodyHead: string | null;
};

export type LawCheckResult = {
  ok: boolean;
  checkedAt: string;
  snapshot: LawSnapshot | null;
  guideOk: boolean;
  guideMissing: string[];
  /** 이전 저장값 대비 달라진 항목 */
  changes: string[];
  error: string | null;
};

// HTML → 공백 정리된 평문
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// 간단한 문자열 해시 (본문 변경 감지용. 암호학적 용도 아님)
function hashText(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return (h1.toString(16) + h2.toString(16)).padStart(16, "0");
}

// "2026. 1. 2." → "2026-01-02"
function normalizeKoreanDate(s: string): string | null {
  const m = s.match(/(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** 조문정보 페이지 HTML → 스냅샷 */
export function parseArticlePage(html: string): LawSnapshot {
  const text = htmlToText(html);

  // 예) [시행 2026. 1. 2.] [법률 제21065호, 2025. 10. 1., 타법개정]
  const header = text.match(
    /\[\s*시행\s*([^\]]+?)\s*\]\s*\[\s*법률\s*제\s*(\d+)\s*호\s*,\s*([^,\]]+?)\s*,\s*([^\]]+?)\s*\]/
  );

  // 조문 본문 — "제6조의3(계약갱신 요구 등)" 이후
  const bodyMatch = text.match(/제6조의3\s*\(\s*계약갱신[^)]*\)([\s\S]{0,4000})/);
  const body = bodyMatch ? bodyMatch[1].trim() : null;

  return {
    effectiveDate: header ? normalizeKoreanDate(header[1]) : null,
    lawNumber: header ? `제${header[2]}호` : null,
    revisionType: header ? header[4] : null,
    bodyHash: body ? hashText(body) : null,
    bodyHead: body ? body.slice(0, 300) : null,
  };
}

/** 생활법령 페이지에서 기간 관련 필수 문구가 살아있는지 */
export function checkGuidePage(html: string): { ok: boolean; missing: string[] } {
  const text = htmlToText(html);
  const missing = GUIDE_MUST_CONTAIN.filter((k) => !text.includes(k));
  return { ok: missing.length === 0, missing };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      // 법제처 페이지는 UA 가 없으면 다른 응답을 주는 경우가 있다
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

// ── 저장 (Supabase). 테이블이 없거나 Mock 이면 조용히 건너뛴다.
export type LawWatchRow = {
  key: string;
  effective_date: string | null;
  law_number: string | null;
  revision_type: string | null;
  body_hash: string | null;
  body_head: string | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_changed_at: string | null;
  consecutive_failures: number;
  last_error: string | null;
};

export async function readLawWatch(key: string): Promise<LawWatchRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.from("law_watch").select("*").eq("key", key).maybeSingle();
  if (error) {
    console.error("[law-watch] 조회 실패:", error.message);
    return null;
  }
  return (data as LawWatchRow) ?? null;
}

async function writeLawWatch(row: Partial<LawWatchRow> & { key: string }): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from("law_watch").upsert(row, { onConflict: "key" });
  if (error) console.error("[law-watch] 저장 실패:", error.message);
}

/**
 * 법령 확인 1회 실행.
 * - 성공: 스냅샷 저장 + 이전값과 비교해 changes 반환
 * - 실패: consecutive_failures 증가, 기존 스냅샷은 보존 (덮어쓰지 않는다)
 */
export async function runLawCheck(nowIso: string): Promise<LawCheckResult> {
  const key = WATCH_TARGETS.article.key;
  const prev = await readLawWatch(key);
  const changes: string[] = [];

  try {
    const [articleHtml, guideHtml] = await Promise.all([
      fetchText(WATCH_TARGETS.article.url),
      fetchText(WATCH_TARGETS.guide.url),
    ]);

    const snapshot = parseArticlePage(articleHtml);
    const guide = checkGuidePage(guideHtml);

    // 파싱 자체가 실패한 경우(구조 변경)를 성공으로 처리하면 안 된다.
    if (!snapshot.effectiveDate || !snapshot.lawNumber || !snapshot.bodyHash) {
      throw new Error(
        `조문 페이지 파싱 실패 (시행일=${snapshot.effectiveDate} 법률번호=${snapshot.lawNumber} 본문=${
          snapshot.bodyHash ? "있음" : "없음"
        })`
      );
    }

    if (prev?.effective_date && prev.effective_date !== snapshot.effectiveDate) {
      changes.push(`시행일 ${prev.effective_date} → ${snapshot.effectiveDate}`);
    }
    if (prev?.law_number && prev.law_number !== snapshot.lawNumber) {
      changes.push(`법률번호 ${prev.law_number} → ${snapshot.lawNumber}`);
    }
    if (prev?.body_hash && prev.body_hash !== snapshot.bodyHash) {
      changes.push("제6조의3 본문이 변경됨");
    }
    if (!guide.ok) {
      changes.push(`생활법령 페이지에서 기간 문구 누락: ${guide.missing.join(", ")}`);
    }

    await writeLawWatch({
      key,
      effective_date: snapshot.effectiveDate,
      law_number: snapshot.lawNumber,
      revision_type: snapshot.revisionType,
      body_hash: snapshot.bodyHash,
      body_head: snapshot.bodyHead,
      last_checked_at: nowIso,
      last_success_at: nowIso,
      last_changed_at: changes.length > 0 ? nowIso : (prev?.last_changed_at ?? null),
      consecutive_failures: 0,
      last_error: null,
    });

    return {
      ok: true,
      checkedAt: nowIso,
      snapshot,
      guideOk: guide.ok,
      guideMissing: guide.missing,
      changes,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // ★ 실패 시 스냅샷은 덮어쓰지 않는다. 마지막으로 성공한 값이 화면에 남아야 한다.
    await writeLawWatch({
      key,
      last_checked_at: nowIso,
      consecutive_failures: (prev?.consecutive_failures ?? 0) + 1,
      last_error: msg,
    });
    return {
      ok: false,
      checkedAt: nowIso,
      snapshot: null,
      guideOk: false,
      guideMissing: [],
      changes: [],
      error: msg,
    };
  }
}

/**
 * 화면 표시용 — 마지막으로 성공한 확인 결과.
 *
 * 🚨 반드시 noStore() 를 호출할 것.
 *   supabase-js 는 내부적으로 fetch 를 쓰는데, Next.js 가 그 응답을 **디스크 Data Cache**
 *   (.next/cache/fetch-cache)에 저장한다. 페이지에 `dynamic = "force-dynamic"` 을 걸어도
 *   이 캐시는 살아남아서 **서버를 재시작해도 옛날 DB 값이 계속 나온다.**
 *   (2026-08-13 실측: 변경 플래그를 DB에서 지웠는데도 경고 배너가 계속 표시됨.
 *    .next/cache/fetch-cache 를 지워야 반영됐다.)
 */
export async function getLawStatusForDisplay(): Promise<{
  effectiveDate: string | null;
  lawNumber: string | null;
  lastSuccessAt: string | null;
  stale: boolean;
  changedPending: boolean;
} | null> {
  noStore(); // 위 주석 참조 — 이거 없으면 옛 DB 값이 캐시되어 계속 나온다
  const row = await readLawWatch(WATCH_TARGETS.article.key);
  if (!row) return null;

  // 3일 넘게 확인에 성공하지 못했으면 '오래됨' 으로 표시한다 (침묵 실패 방지)
  let stale = true;
  if (row.last_success_at) {
    const days = (Date.now() - new Date(row.last_success_at).getTime()) / 86400000;
    stale = days > 3;
  }

  // 변경이 감지됐고 아직 사람이 반영하지 않은 상태인지
  const changedPending = Boolean(
    row.last_changed_at &&
      row.last_success_at &&
      new Date(row.last_changed_at).getTime() >= new Date(row.last_success_at).getTime() - 1000
  );

  return {
    effectiveDate: row.effective_date,
    lawNumber: row.law_number,
    lastSuccessAt: row.last_success_at,
    stale,
    changedPending,
  };
}
