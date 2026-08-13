// 계약갱신 요구 통지서 본문 생성 — 미리보기·인쇄·이메일·문자가 동일 본문을 쓴다.
//
// ★ 톤 원칙 (공인중개사 실무 검토 반영)
//   - 사무적·건조·정중. "법적 조치", "위반 시", "손해배상" 같은 경고성 문구를 절대 넣지 않는다.
//     공격적이면 원래 실거주 의사가 없던 임대인도 실거주 거절(제6조의3 제1항 8호) 카드를 꺼낸다.
//   - 다만 아래 한 문장은 어떤 톤에서도 빠지면 안 된다:
//       "주택임대차보호법 제6조의3에 따라 위 임대차계약의 갱신을 요구합니다."
//     "계속 거주하고 싶습니다" 수준으로 쓰면 나중에 "희망사항이었지 권리행사가 아니었다"고 다퉈진다.
//   - 부드러움은 인사말에서, 명확함은 조문 인용에서 해결한다.

import { formatDotDate, formatKoreanDate } from "./renewal-calc";

export type RenewalNotice = {
  /** 임차주택 소재지 (계약서상 주소, 동·호수 포함) */
  propertyAddress: string;
  /** 임대차기간 시작일 YYYY-MM-DD */
  startDate: string;
  /** 임대차기간 만료일 YYYY-MM-DD (계약서에 인쇄된 날짜 그대로) */
  endDate: string;
  /** 월세 유무 — 전세/월세 분기 */
  hasMonthlyRent: boolean;
  /** 보증금 (원) */
  deposit: number;
  /** 월 차임 (원) — hasMonthlyRent 일 때만 사용 */
  monthlyRent?: number;
  /** 임차인 성명 */
  tenantName: string;
  /** 임차인 연락처 */
  tenantPhone?: string;
  /** 임차인 주소 (통지서 발신인 주소, 보통 임차주택과 동일) */
  tenantAddress?: string;
  /** 임대인 성명 (소유자가 바뀌었으면 현재 등기부상 소유자) */
  landlordName: string;
  /** 임대인 주소 */
  landlordAddress?: string;
  /** 갱신 조건 — same: 동일 조건 / negotiate: 협의 희망 */
  condition: "same" | "negotiate";
  /** 통지서 작성일 YYYY-MM-DD */
  noticeDate: string;
};

function formatMoney(num: number): string {
  return (num ?? 0).toLocaleString("ko-KR");
}

// 보증금/차임 표시 줄 — 전세와 월세를 분기한다
function buildRentLines(n: RenewalNotice): string {
  const deposit = `  - 보증금 : 금 ${formatMoney(n.deposit)}원`;
  if (!n.hasMonthlyRent) return deposit;
  return `${deposit}\n  - 월 차임 : 금 ${formatMoney(n.monthlyRent ?? 0)}원`;
}

// 갱신 조건 문단 — 조건 협의를 원하더라도 '갱신 요구' 자체는 명확히 유지한다.
function buildConditionClause(n: RenewalNotice): string {
  if (n.condition === "negotiate") {
    return (
      `갱신되는 임대차의 존속기간은 같은 법 제6조의3 제2항에 따라 2년이며,\n` +
      `차임 및 보증금에 관하여는 같은 조 제3항이 정한 범위에서 협의를 희망합니다.\n` +
      `조건에 관한 협의 여부와 관계없이 위 갱신 요구의 의사는 변함이 없습니다.`
    );
  }
  return (
    `갱신되는 임대차의 존속기간은 같은 법 제6조의3 제2항에 따라 2년이며,\n` +
    `임대차의 조건은 종전과 동일한 조건으로 갱신되기를 요청드립니다.`
  );
}

/** 통지서 전문 텍스트 (인쇄·PDF·이메일 본문 공통) */
export function buildRenewalNoticeText(n: RenewalNotice): string {
  return `계약갱신 요구 통지서


발신인(임차인) : ${n.tenantName}
${n.tenantAddress ? `                 주소 : ${n.tenantAddress}\n` : ""}${
    n.tenantPhone ? `                 연락처 : ${n.tenantPhone}\n` : ""
  }
수신인(임대인) : ${n.landlordName}
${n.landlordAddress ? `                 주소 : ${n.landlordAddress}\n` : ""}

1. 임차주택의 표시
  ${n.propertyAddress}

2. 임대차계약의 내용
  - 임대차기간 : ${formatDotDate(n.startDate)} ~ ${formatDotDate(n.endDate)}
${buildRentLines(n)}

3. 통지의 내용

  안녕하십니까. 그동안 임대차계약과 관련하여 배려해 주신 점 감사드립니다.

  본인은 위 임차주택의 임차인으로서, 주택임대차보호법 제6조의3에 따라
  위 임대차계약의 갱신을 요구합니다.

  ${buildConditionClause(n).split("\n").join("\n  ")}

  협의가 필요하신 사항이 있으시면 위 연락처로 연락 주시기 바랍니다.


${formatKoreanDate(n.noticeDate)}


발신인 ${n.tenantName}  (서명 또는 날인)
`;
}

/**
 * 문자·카카오톡용 요약 텍스트.
 * 실무상 PDF 파일만 보내면 임대인이 열어보지 않고, 텍스트만 보내면 정형성이 떨어진다.
 * → 파일과 이 요약문을 함께 보내는 것이 정답이므로 별도로 제공한다.
 */
export function buildRenewalNoticeSms(n: RenewalNotice): string {
  const rent = n.hasMonthlyRent
    ? `보증금 ${formatMoney(n.deposit)}원 / 월세 ${formatMoney(n.monthlyRent ?? 0)}원`
    : `보증금 ${formatMoney(n.deposit)}원`;

  const condition =
    n.condition === "negotiate"
      ? "차임 등 조건은 협의를 희망합니다."
      : "종전과 동일한 조건으로 갱신되기를 요청드립니다.";

  return `[계약갱신 요구 통지]

${n.landlordName}님, 안녕하세요. ${n.propertyAddress} 임차인 ${n.tenantName}입니다.

임대차기간 ${formatDotDate(n.startDate)} ~ ${formatDotDate(n.endDate)} (${rent})

본인은 주택임대차보호법 제6조의3에 따라 위 임대차계약의 갱신을 요구합니다.
갱신되는 임대차의 존속기간은 2년이며, ${condition}

협의가 필요하시면 연락 주시기 바랍니다.
${n.tenantPhone ?? ""}

(${formatKoreanDate(n.noticeDate)})`;
}

/** 이메일 제목 */
export function buildRenewalNoticeSubject(n: RenewalNotice): string {
  return `[계약갱신 요구 통지] ${n.propertyAddress} — 임차인 ${n.tenantName}`;
}
