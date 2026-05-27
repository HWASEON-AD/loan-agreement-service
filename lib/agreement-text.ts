// 약정서 표준 양식 텍스트 생성 — 미리보기와 PDF 가 동일한 본문을 사용한다.

import type { Agreement } from "./types";
import {
  numberToKorean,
  formatNumber,
  calcMonthlyInterest,
} from "./interest-calc";

// 날짜를 한국식 표기로 변환 (YYYY-MM-DD -> YYYY년 MM월 DD일)
function formatKoreanDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

// 생년월일 6자리 표기 (YYMMDD -> YY.MM.DD)
function formatBirth(birth: string): string {
  if (!birth || birth.length !== 6) return birth;
  return `${birth.slice(0, 2)}.${birth.slice(2, 4)}.${birth.slice(4, 6)}`;
}

// 약정서 전문 텍스트 생성
export function buildAgreementText(a: Agreement): string {
  const amountKorean = numberToKorean(a.amount);
  const amountNumber = formatNumber(a.amount);
  const isFree = a.interestRate <= 0;
  const monthlyInterest = calcMonthlyInterest(a.amount, a.interestRate);

  // 제3조 이자 조항
  const interestClause = isFree
    ? `본 대여금에 대한 이자는 없는 것으로 한다.`
    : `이자율은 연 ${(a.interestRate * 100).toFixed(1)}%로 하며, "을"은 매월 ${a.interestDay ?? 1}일에 금 ${formatNumber(
        monthlyInterest
      )}원을 "갑"의 지정 계좌로 이체한다.`;

  // 제4조 상환 방법 조항
  const repaymentClause =
    a.repaymentMethod === "installment"
      ? `"을"은 만기일(${formatKoreanDate(
          a.endDate
        )})까지 매월 ${a.interestDay ?? 1}일에 원금을 분할하여 "갑"에게 상환한다.`
      : `"을"은 만기일(${formatKoreanDate(
          a.endDate
        )})에 원금 전액을 "갑"에게 일시 상환한다.`;

  const today = formatKoreanDate(new Date().toISOString().slice(0, 10));

  return `대 여 약 정 서


대여자(갑) : ${a.lender.name} (생년월일 : ${formatBirth(a.lender.birth)})
             주소 : ${a.lender.address}

차용자(을) : ${a.borrower.name} (생년월일 : ${formatBirth(a.borrower.birth)})
             주소 : ${a.borrower.address}


위 당사자 간에 다음과 같이 금전 대여 약정을 체결합니다.


제1조 (대여 금액)
"갑"은 "을"에게 금 ${amountKorean}원(${amountNumber}원)을 대여한다.

제2조 (대여 기간)
대여 기간은 ${formatKoreanDate(a.startDate)}부터 ${formatKoreanDate(
    a.endDate
  )}까지로 한다.

제3조 (이자)
${interestClause}

제4조 (상환 방법)
${repaymentClause}

제5조 (기한이익 상실)
"을"이 이자 또는 원금을 2회 이상 연속하여 지급하지 아니하거나 기타 본 약정을
위반한 경우, "갑"은 즉시 원금 전액의 반환을 청구할 수 있다.

제6조 (기타)
본 약정에 명시되지 않은 사항은 민법 및 관련 법령에 따른다.


${today}


대여자(갑) : ${a.lender.name}  (서명)

차용자(을) : ${a.borrower.name}  (서명)
`;
}
