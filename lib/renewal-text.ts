// 계약갱신 관련 서식의 입력 모델 + 문자·카톡용 요약 텍스트.
//
// ★ 서식(통지서·확인서)의 본문·표 구조는 `renewal-doc.ts` 가 만든다.
//   이 파일은 ①입력 타입 ②문자/카톡 요약 ③메일 제목만 담당한다.
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
  /** 임대인 연락처 */
  landlordPhone?: string;
  /** 갱신 조건 — same: 동일 조건 / negotiate: 협의 희망 */
  condition: "same" | "negotiate";
  /** 통지서·확인서 작성일 YYYY-MM-DD */
  noticeDate: string;

  // ── 아래는 「주택임대차계약 갱신 확인서」에서만 쓴다 ────────────────────
  /**
   * 임차인이 실제로 갱신 요구의 의사를 표시한 날 (YYYY-MM-DD).
   * ★ 서비스가 계산하지 않는다. 실제로 있었던 날을 이용자가 적는다.
   *   (있지도 않은 요구를 '있었던 것으로 간주'하는 문서가 되면 법 제10조로 무효가 될 소지)
   */
  renewalRequestDate?: string;
  /** 갱신 후 임대차기간 시작일 */
  renewedStartDate?: string;
  /** 갱신 후 임대차기간 만료일 */
  renewedEndDate?: string;
  /** 갱신 후 보증금 (원) */
  renewedDeposit?: number;
  /** 갱신 후 월 차임 (원) */
  renewedMonthlyRent?: number;
};

function formatMoney(num: number): string {
  return (num ?? 0).toLocaleString("ko-KR");
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

/**
 * 갱신 확인서용 요약 텍스트 (상대방에게 서명을 요청하며 보낼 때).
 *
 * ★ "서명해야 한다" / "서명하지 않으면 ~된다" 처럼 의무·효과를 단정하지 않는다.
 *   확인서는 양 당사자가 사실을 확인하는 문서이지, 한쪽이 상대에게 부과하는 것이 아니다.
 */
export function buildRenewalConfirmSms(n: RenewalNotice): string {
  const period =
    n.renewedStartDate && n.renewedEndDate
      ? `${formatDotDate(n.renewedStartDate)} ~ ${formatDotDate(n.renewedEndDate)}`
      : "";

  return `[주택임대차계약 갱신 확인서]

${n.propertyAddress} 주택임대차계약의 갱신 확인서를 보내드립니다.

${n.renewalRequestDate ? `계약갱신 요구일 : ${formatDotDate(n.renewalRequestDate)}\n` : ""}기존 임대차기간 : ${formatDotDate(n.startDate)} ~ ${formatDotDate(n.endDate)}
${period ? `갱신 임대차기간 : ${period}\n` : ""}
위 임대차계약이 주택임대차보호법 제6조의3에 따른 임차인의 계약갱신 요구에 따라
갱신되었음을 확인하는 내용입니다. 내용을 확인해 주시기 바랍니다.

(${formatKoreanDate(n.noticeDate)})`;
}

/** 이메일 제목 */
export function buildRenewalNoticeSubject(n: RenewalNotice): string {
  return `[계약갱신 요구 통지] ${n.propertyAddress} — 임차인 ${n.tenantName}`;
}

/** 확인서 이메일 제목 */
export function buildRenewalConfirmSubject(n: RenewalNotice): string {
  return `[주택임대차계약 갱신 확인서] ${n.propertyAddress}`;
}
