// 전화번호 자동 하이픈 (공용)
//
// 왜 공용으로 빼는가: 같은 함수가 Step2Parties / FundingStep1Basic 에 각각 복사돼 있었고,
//   계약갱신 서식·세무상담·구독 폼에는 아예 없어서 "-" 없이 치면 그대로 저장됐다.
//   문서(통지서·약정서)에 그대로 인쇄되는 값이라 표기가 갈리면 안 된다.
//
// 하이픈을 사용자가 직접 치지 않아도 되게 하는 것이 목적이므로,
//   입력값에서 숫자만 뽑아낸 뒤 자릿수 규칙으로 다시 끼워 넣는다.

/** 숫자만 남긴다. 국가번호(+82)로 시작하면 국내 표기(0…)로 바꾼다. */
export function phoneDigits(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  // +82 10 1234 5678 / 0082… → 010 1234 5678
  if (d.startsWith("0082")) d = d.slice(4);
  if (d.startsWith("82") && d.length >= 11) d = d.slice(2);
  if (!d.startsWith("0") && d.length >= 9) d = "0" + d;
  return d.slice(0, 11);
}

/**
 * 입력 중에도 자연스럽게 하이픈을 붙인다.
 *  - 02 (서울 지역번호): 02-123-4567 / 02-1234-5678
 *  - 그 외 0XX: 0XX-123-4567 / 0XX-1234-5678
 *  - 010/011 등 휴대전화: 010-1234-5678
 * 아직 자릿수가 모자란 중간 입력 상태에서도 깨지지 않게 앞부분만 끼운다.
 */
export function formatPhone(raw: string): string {
  const d = phoneDigits(raw);
  if (!d) return "";

  // 서울(02)은 지역번호가 두 자리다
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }

  // 휴대전화(01X)는 자릿수가 3-4-4 로 정해져 있으니 중간 입력에서도 그 자리로 끊는다.
  //   (그렇게 안 하면 010-123-45 처럼 잠깐 3-3-4 로 보였다가 다시 튀어서 거슬린다)
  if (d.startsWith("01")) {
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
  }

  // 나머지 지역번호·대표번호(031, 070, 0505 …)
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

/** 휴대전화인가 (010 계열 11자리 또는 구 01X 10~11자리) */
export function isMobilePhone(raw: string): boolean {
  const d = phoneDigits(raw);
  return /^01[016789]\d{7,8}$/.test(d);
}

/** 연락처로 쓸 만한 번호인가 — 휴대전화 또는 유선(9~11자리) */
export function isValidPhone(raw: string): boolean {
  const d = phoneDigits(raw);
  if (!/^0\d{8,10}$/.test(d)) return false;
  return isMobilePhone(raw) || /^0(2|[3-6]\d|70|50\d)/.test(d);
}
