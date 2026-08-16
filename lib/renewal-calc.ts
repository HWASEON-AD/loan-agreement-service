// 계약갱신요구권 행사기간 계산 — 주택임대차보호법 제6조의3
//
// ★★ 이 모듈은 순수 함수만 둔다. LLM/AI 판단을 절대 넣지 말 것.
//    서비스는 "행사 가능/불가"를 판정하지 않는다. 법령상 기간(날짜)만 계산해서 제시하고,
//    요건 충족 여부의 판단은 이용자 몫이다. (결론형 출력 금지 — 법령정보형 출력만)
//
// 근거
//  - 주택임대차보호법 제6조의3 제1항: 임대차기간이 끝나기 6개월 전부터 2개월 전까지 갱신 요구
//  - 같은 조 제2항: 1회에 한하여 행사, 갱신되는 임대차의 존속기간은 2년
//  - 같은 조 제3항: 차임·보증금은 제7조의 범위(5%)에서 증감
//  - 민법 제111조: 의사표시는 상대방에게 도달한 때 효력 발생 (도달주의)

// 경과규정 기준일 — 법률 제17363호(2020.12.10. 시행)
// 이 날 이후 "최초로 체결되거나 갱신된" 임대차부터 하한이 '2개월 전'으로 변경되었다.
// 그 이전 계약은 '1개월 전'까지가 하한이므로 반드시 분기해야 한다.
export const 경과규정_기준일 = "2020-12-10";

// 행사기간 상한 — 만료일로부터 역산할 개월 수 (개정 전후 공통)
export const 행사기간_시작_개월 = 6;

// 차임·보증금 증액 상한 (제7조) — 5%
export const 증액상한_비율 = 0.05;

export type RenewalWindow = {
  /** 입력한 계약 만료일 (YYYY-MM-DD) */
  endDate: string;
  /** 행사기간 시작일 = 만료일 6개월 전 */
  windowStart: string;
  /** 행사기간 마지막 날 = 만료일 N개월 전 (도달 기준) */
  windowEnd: string;
  /** 적용된 하한 개월 수 (2 = 현행, 1 = 2020.12.10 이전 계약) */
  deadlineMonths: 1 | 2;
  /** 구법(6개월~1개월 전) 적용 여부 */
  isLegacyRule: boolean;
  /** 계산 기준일 (KST 오늘) */
  today: string;
  /** 오늘부터 행사기간 시작일까지 남은 일수 (이미 시작했으면 음수) */
  daysUntilWindowStart: number;
  /** 오늘부터 행사기간 마지막 날까지 남은 일수 (지났으면 음수) */
  daysUntilDeadline: number;
};

// ---------------------------------------------------------------------------
// 날짜 유틸 — 전부 "YYYY-MM-DD" 문자열 기준으로 처리한다.
// Date 객체의 로컬 타임존 영향을 받지 않게 하기 위함 (서버/브라우저 TZ 차이 방지).
// ---------------------------------------------------------------------------

// "YYYY-MM-DD" -> {y, m, d}  (m은 1-based)
function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function toYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// 해당 연/월의 말일 (윤년 반영)
function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// N개월 전 날짜 — 응당일(같은 일자)이 없는 달이면 그 달의 말일로 맞춘다.
// 예) 2027-03-31 의 1개월 전 -> 2027-02-28 (2027-03-03 이 되면 안 됨)
export function subtractMonths(dateStr: string, months: number): string {
  const p = parseYmd(dateStr);
  if (!p) return dateStr;

  // 0-based 월로 환산해서 계산 후 다시 1-based 로 되돌린다
  const totalMonth = p.y * 12 + (p.m - 1) - months;
  const y = Math.floor(totalMonth / 12);
  const m = (totalMonth % 12) + 1;

  const day = Math.min(p.d, lastDayOfMonth(y, m));
  return toYmd(y, m, day);
}

// 하루 전 날짜 — 역산 마감일 계산(초일 불산입)에 사용
export function prevDay(dateStr: string): string {
  const p = parseYmd(dateStr);
  if (!p) return dateStr;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d) - 86400000);
  return toYmd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// 다음 날 날짜 — 갱신 기간 시작일 산정에 사용
export function nextDay(dateStr: string): string {
  const p = parseYmd(dateStr);
  if (!p) return dateStr;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d) + 86400000);
  return toYmd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// 두 날짜 사이의 일수 차 (to - from). UTC 기준으로 계산해 DST/TZ 영향을 배제한다.
export function diffDays(from: string, to: string): number {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) return 0;
  const t1 = Date.UTC(a.y, a.m - 1, a.d);
  const t2 = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((t2 - t1) / 86400000);
}

// KST 기준 오늘 날짜 (YYYY-MM-DD)
export function todayKst(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 날짜 문자열 유효성 (달력상 실재하는 날짜인지까지 확인)
export function isValidDate(dateStr: string): boolean {
  const p = parseYmd(dateStr);
  if (!p) return false;
  return p.d <= lastDayOfMonth(p.y, p.m);
}

// ---------------------------------------------------------------------------
// 본체
// ---------------------------------------------------------------------------

// 경과규정 판정 — 최초 계약 체결일이 2020-12-10 이상이면 현행(2개월), 미만이면 구법(1개월)
// ※ '최초로 체결되거나 갱신된' 시점 기준이므로, 그 이후 갱신이 있었다면
//    갱신일이 기준이 된다. 어느 날짜를 넣을지는 이용자가 폼에서 선택한다.
export function resolveDeadlineMonths(firstContractDate: string): 1 | 2 {
  if (!isValidDate(firstContractDate)) return 2; // 판별 불가 시 현행 기준
  return diffDays(경과규정_기준일, firstContractDate) >= 0 ? 2 : 1;
}

/**
 * 행사기간 계산.
 * @param endDate           계약서상 임대차기간 만료일 (계약서에 인쇄된 날짜 그대로)
 * @param firstContractDate 최초로 계약을 체결(또는 갱신)한 날 — 경과규정 판정용
 * @param baseDate          기준일. 생략 시 KST 오늘 (테스트 주입용)
 */
export function calcRenewalWindow(
  endDate: string,
  firstContractDate: string,
  baseDate?: string
): RenewalWindow | null {
  if (!isValidDate(endDate)) return null;

  const deadlineMonths = resolveDeadlineMonths(firstContractDate);

  // 기간 개시 = 만료일의 6개월 전 응당일 0시
  const windowStart = subtractMonths(endDate, 행사기간_시작_개월);

  // ★ 기간 마감 = 만료일의 N개월 전 응당일의 "전날" 24시까지 도달
  //   민법 제157조(초일 불산입)를 역산에도 유추적용한 결과다.
  //   (대법원이 민법 제71조 '총회 1주간 전' 통지 사안에서 역산에 초일불산입을 적용한 법리)
  //   응당일이 없는 달은 subtractMonths 가 이미 말일로 맞춘다(제160조③ 유추).
  //
  //   ⚠️ 마감을 "응당일 당일 24시"로 보는 견해도 실무에 있다. 우리는 둘 중
  //      이용자가 하루 손해 보는 쪽(= 더 이른 마감)을 채택했다.
  //      늦은 마감을 표시했다가 틀리면 권리 상실이고, 이른 마감은 하루 일찍 보낸 것에 그친다.
  //   ⚠️ 민법 제161조(말일이 공휴일이면 익일 만료)는 역산 마감에 적용된다고 보장할 수 없으므로
  //      적용하지 않는다. 마감이 일요일이어도 연장 표시 금지.
  const windowEnd = prevDay(subtractMonths(endDate, deadlineMonths));

  const today = baseDate && isValidDate(baseDate) ? baseDate : todayKst();

  return {
    endDate,
    windowStart,
    windowEnd,
    deadlineMonths,
    isLegacyRule: deadlineMonths === 1,
    today,
    daysUntilWindowStart: diffDays(today, windowStart),
    daysUntilDeadline: diffDays(today, windowEnd),
  };
}

// 갱신 후 만료일 — 존속기간 2년 (제6조의3 제2항)
//
// ★ 만료일은 계약서 표기 방식과 무관하게 "종전 만료일 + 2년"으로 같다.
//   - 당일형 : 2024.11.14 ~ 2026.11.14  →  2026.11.14 ~ 2028.11.14   (= 만료일 + 2년)
//   - 익일형 : 2024. 8.25 ~ 2026. 8.24  →  2026. 8.25 ~ 2028. 8.24   (= 만료일 + 2년)
//   달라지는 건 **시작일**뿐이다. 그건 calcRenewedTerm 이 판별한다.
export function calcRenewedEndDate(endDate: string): string {
  const p = parseYmd(endDate);
  if (!p) return endDate;
  const day = Math.min(p.d, lastDayOfMonth(p.y + 2, p.m));
  return toYmd(p.y + 2, p.m, day);
}

/**
 * 갱신 후 임대차기간(시작일·만료일)의 기본값.
 *
 * 🚨 왜 필요한가 — 계약서의 기간 표기 방식이 두 가지로 갈리고, 그에 따라 갱신 시작일이 하루 달라진다.
 *
 *   | 계약서 표기                    | 판별              | 갱신 시작일       |
 *   |--------------------------------|-------------------|-------------------|
 *   | 2024. 11. 14. ~ 2026. 11. 14.  | 만료일 == 응당일  | 2026. 11. 14. (당일) |
 *   | 2024.  8. 25. ~ 2026.  8. 24.  | 만료일+1 == 응당일| 2026.  8. 25. (다음 날) |
 *
 *   시작일을 무조건 "만료일 당일"로 두면 두 번째 계약에서 **하루가 겹치고 기간이 2년 1일**이 된다.
 *   반대로 무조건 "다음 날"로 두면 첫 번째 계약에서 하루가 비고 만료일이 어긋난다.
 *   → 시작일의 '일(日)'과 맞춰 보면 어느 방식인지 기계적으로 판별된다. 해석이 아니라 산술이다.
 *
 * ★ 그래도 이 값은 **기본값일 뿐**이며, 화면에서 이용자가 계약서를 보고 고칠 수 있게 열어 둔다.
 *   판별이 안 되는 표기(convention === "unknown")면 화면에서 확인을 요청한다.
 */
export type RenewedTerm = {
  start: string;
  end: string;
  /** same-day: 만료일 당일 시작 / day-after: 만료일 다음 날 시작 / unknown: 판별 불가 */
  convention: "same-day" | "day-after" | "unknown";
};

export function calcRenewedTerm(startDate: string, endDate: string): RenewedTerm | null {
  if (!isValidDate(endDate)) return null;

  const end = calcRenewedEndDate(endDate);
  const s = parseYmd(startDate);
  const e = parseYmd(endDate);

  // 시작일이 없거나 이상하면 판별하지 않는다 — 임의로 고르지 말고 이용자에게 확인을 받는다.
  if (!s || !e || !isValidDate(startDate)) {
    return { start: nextDay(endDate), end, convention: "unknown" };
  }

  // ① 만료일의 '일'이 시작일과 같다 → 당일형
  if (e.d === s.d) return { start: endDate, end, convention: "same-day" };

  // ①-b 양쪽이 모두 그 달의 말일이면 당일형으로 본다.
  //     예) 2024. 2. 29. ~ 2026. 2. 28.  — 2월에 29일이 없어 28일로 적힌 것이지 익일형이 아니다.
  //     (익일형이면 만료일 다음 날이 응당일이라 ② 에서 잡히므로 여기에 오지 않는다)
  if (s.d === lastDayOfMonth(s.y, s.m) && e.d === lastDayOfMonth(e.y, e.m)) {
    return { start: endDate, end, convention: "same-day" };
  }

  // ② 만료일 다음 날의 '일'이 시작일과 같다 → 익일형
  const nd = parseYmd(nextDay(endDate));
  if (nd && nd.d === s.d) return { start: nextDay(endDate), end, convention: "day-after" };

  // ③ 어느 쪽도 아니면 판별 불가. 기간이므로 '다음 날'을 잠정값으로 두되 화면에서 확인을 요청한다.
  return { start: nextDay(endDate), end, convention: "unknown" };
}

// 증액 상한액 계산 (제7조, 5%) — "올려야 하는 금액"이 아니라 "올릴 수 있는 최대치"
export function calcMaxIncrease(amount: number): number {
  if (!amount || amount <= 0) return 0;
  return Math.floor(amount * 증액상한_비율);
}

// YYYY-MM-DD -> "YYYY년 M월 D일"
export function formatKoreanDate(dateStr: string): string {
  const p = parseYmd(dateStr);
  if (!p) return dateStr;
  return `${p.y}년 ${p.m}월 ${p.d}일`;
}

// YYYY-MM-DD -> "YYYY. M. D."  (통지서 본문용 간결 표기)
export function formatDotDate(dateStr: string): string {
  const p = parseYmd(dateStr);
  if (!p) return dateStr;
  return `${p.y}. ${p.m}. ${p.d}.`;
}

// 계약 기간 개월 수 (시작일~만료일) — 1년 계약 감지용 보조 검증
export function contractMonths(startDate: string, endDate: string): number | null {
  const a = parseYmd(startDate);
  const b = parseYmd(endDate);
  if (!a || !b) return null;
  return (b.y - a.y) * 12 + (b.m - a.m);
}
