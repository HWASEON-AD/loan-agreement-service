// 이자 계산기 — 상증세법 제41조의4 적정이자율(연 4.6%) 기준

// 법정 적정 이자율 (연 4.6%)
export const 적정이자율 = 0.046;

// 무이자 한도 (= 1,000만원 / 0.046 = 약 2억 1,739만원)
// 이 금액 이하로 빌려주면 발생 이자가 연 1,000만원 미만이라 별도 이자 약정이 불필요한 구간
export const 무이자한도 = 217390000;

// 월 이자금액 계산 — 연 이자율 기준으로 매월 납부 금액 산출
export function calcMonthlyInterest(amount: number, annualRate: number): number {
  if (amount <= 0 || annualRate <= 0) return 0;
  return Math.round((amount * annualRate) / 12);
}

// 연 이자금액 계산
export function calcAnnualInterest(amount: number, annualRate: number): number {
  if (amount <= 0 || annualRate <= 0) return 0;
  return Math.round(amount * annualRate);
}

// 무이자 한도 이하 여부 판정
export function isInterestFree(amount: number): boolean {
  return amount <= 무이자한도;
}

// 금액에 따른 권장 이자율 반환
// - 무이자 한도 이하: 0% (무이자)
// - 한도 초과: 연 4.6% 자동 적용
export function recommendedRate(amount: number): number {
  return isInterestFree(amount) ? 0 : 적정이자율;
}

// 숫자 금액 → 한글 금액 표기 (예: 50000000 -> "오천만")
// 약정서 본문의 "금 OOO원" 표기에 사용
export function numberToKorean(num: number): string {
  if (num === 0) return "영";

  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const smallUnit = ["", "십", "백", "천"];
  const bigUnit = ["", "만", "억", "조", "경"];

  let result = "";
  let bigIndex = 0;
  let remaining = num;

  while (remaining > 0) {
    const chunk = remaining % 10000; // 4자리씩 끊기
    if (chunk > 0) {
      let chunkStr = "";
      let temp = chunk;
      let smallIndex = 0;
      while (temp > 0) {
        const d = temp % 10;
        if (d > 0) {
          // "일십", "일백" 등에서 앞의 "일"은 생략 (단, 만/억 단위 구분 위해 천 단위는 유지)
          const digitStr = d === 1 && smallIndex > 0 ? "" : digits[d];
          chunkStr = digitStr + smallUnit[smallIndex] + chunkStr;
        }
        temp = Math.floor(temp / 10);
        smallIndex++;
      }
      // 만/억/조 등 큰 단위(bigIndex > 0)에서 chunk가 1이면 앞의 "일" 생략
      // 예: 10000 -> "일만"(X) -> "만"(O)
      if (bigIndex > 0 && chunk === 1) {
        chunkStr = "";
      }
      result = chunkStr + bigUnit[bigIndex] + result;
    }
    remaining = Math.floor(remaining / 10000);
    bigIndex++;
  }

  return result;
}

// 숫자 → 천 단위 콤마 문자열 (예: 50000000 -> "50,000,000")
export function formatNumber(num: number): string {
  return num.toLocaleString("ko-KR");
}

// 다음 납부일(YYYY-MM-DD) 계산 — 오늘(KST) 기준으로 billingDay(1~28)가
// 이번 달에 아직 도래하지 않았으면 이번 달, 이미 지났으면 다음 달로 설정한다.
export function computeNextDueDate(billingDay: number, fromIso?: string): string {
  const base = fromIso ? new Date(fromIso) : new Date();
  // KST 기준 연/월/일
  const kst = new Date(base.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth(); // 0-based
  const day = kst.getUTCDate();

  const safeDay = Math.min(Math.max(billingDay, 1), 28);

  let dueYear = year;
  let dueMonth = month;
  if (day >= safeDay) {
    // 이번 달 납부일이 이미 지났거나 오늘이면 다음 달
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }
  const mm = String(dueMonth + 1).padStart(2, "0");
  const dd = String(safeDay).padStart(2, "0");
  return `${dueYear}-${mm}-${dd}`;
}

// 특정 납부일 다음 달의 같은 날짜(YYYY-MM-DD) — 다음 회차 due_date 계산용
export function addOneMonth(dueDate: string): string {
  const [y, m, d] = dueDate.split("-").map(Number);
  let year = y;
  let month = m; // 1-based; +1 하면 다음 달
  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  const safeDay = Math.min(d, 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}
