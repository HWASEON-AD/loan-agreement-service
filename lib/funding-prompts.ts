// 자금조달계획서 AI 프롬프트 + Mock 데이터
import type {
  FundingExtractResult,
  HousingFundingItems,
  LandFundingItems,
} from "./funding-types";

// 시스템 프롬프트: AI는 절대 수치를 만들지 않음
export const SYSTEM_PROMPT = `당신은 주택 또는 토지 취득 자금조달계획서 작성을 보조하는 AI입니다.

[절대 원칙]
1. 사용자가 명확히 언급한 수치만 추출합니다.
2. 사용자가 언급하지 않은 항목은 반드시 null로 남깁니다.
3. 수치를 추정하거나 계산으로 유추하지 않습니다.
4. 불명확한 항목은 itemStatus를 "needs_check"로 표시하고 feedback에 안내합니다.
5. 항목이 전혀 언급되지 않은 경우 itemStatus에 넣지 않습니다.

[항목 분류 기준]
- "예금", "통장", "적금" → deposit (금융기관 예금액)
- "주식", "채권", "펀드 매도" → stocks
- "증여", "선물", "드림" → gift (증여세 신고 여부도 함께 확인)
- "상속" → inheritance
- "현금", "수중에 있는 돈" → cash
- "집 팔아서", "부동산 처분" → realEstateSale
- "대출", "담보대출", "주택담보" → mortgageLoan
- "신용대출", "마이너스 통장" → creditLoan
- "사업자 대출" → businessLoan
- "전세 보증금", "임대보증금" → rentalDeposit
- "사채", "회사 지원" → companySupportOrPrivateLoan
- "가족한테 빌림", "부모님한테", "형한테" → otherLoan (otherLoanRelation에 관계 기재)
- "전매 차익" → transferAmount
- "보증금 승계" → depositSuccession
- "잔금 현금", "직접 지불" → cashPayment

[출력 형식]
반드시 아래 JSON 구조만 출력하세요. 설명 텍스트, 마크다운 코드블럭(\`\`\`) 없이 순수 JSON만 출력합니다.

{
  "items": {
    "deposit": number | null,
    "stocks": number | null,
    "gift": number | null,
    "giftTaxFiled": boolean | null,
    "inheritance": number | null,
    "cash": number | null,
    "realEstateSale": number | null,
    "mortgageLoan": number | null,
    "creditLoan": number | null,
    "businessLoan": number | null,
    "rentalDeposit": number | null,
    "companySupportOrPrivateLoan": number | null,
    "otherLoan": number | null,
    "otherLoanRelation": string | null,
    "transferAmount": number | null,
    "depositSuccession": number | null,
    "cashPayment": number | null,
    "moveInPlan": string | null
  },
  "itemStatus": {
    "<key>": "confirmed" | "needs_check"
  },
  "feedback": [
    "문자열 메시지 1",
    "문자열 메시지 2"
  ]
}`;

// 유저 프롬프트 빌더
export function buildUserPrompt(
  formType: "housing" | "land",
  tradeAmount: number,
  story: string
): string {
  return `서식 종류: ${formType === "housing" ? "주택" : "토지"}
거래금액: ${tradeAmount.toLocaleString("ko-KR")}원

사용자 스토리:
---
${story}
---

위 스토리에서 자금 항목을 추출하여 JSON으로 반환하세요.`;
}

// Mock 추출 결과 (housing)
export const MOCK_EXTRACT_RESULT_HOUSING: FundingExtractResult = {
  formType: "housing",
  items: {
    deposit: 50000000,
    stocks: null,
    gift: null,
    giftTaxFiled: null,
    inheritance: null,
    cash: 30000000,
    realEstateSale: null,
    mortgageLoan: null,
    creditLoan: null,
    businessLoan: null,
    rentalDeposit: 50000000,
    companySupportOrPrivateLoan: null,
    otherLoan: 200000000,
    otherLoanRelation: "어머니",
    transferAmount: null,
    depositSuccession: null,
    cashPayment: null,
    moveInPlan: "2026년 8월",
  },
  itemStatus: {
    deposit: "confirmed",
    cash: "confirmed",
    rentalDeposit: "confirmed",
    otherLoan: "needs_check",
  },
  feedback: [
    "어머니로부터 빌린 자금이 차용인 경우 대여약정서 작성을 권장합니다.",
    "기타 차입금의 상환 조건(이자율, 상환기일)을 확인해주세요.",
  ],
  storyOriginal:
    "예금 5천만원 있고, 어머니한테 2억 빌렸어요. 전세 보증금 5천도 있고 현금 3천만원 있습니다.",
};

// Mock 추출 결과 (land)
export const MOCK_EXTRACT_RESULT_LAND: FundingExtractResult = {
  formType: "land",
  items: {
    ...MOCK_EXTRACT_RESULT_HOUSING.items,
    landParcels: [
      {
        location: "경기도 성남시 분당구 백현동 123",
        area: "200㎡",
        tradeAmount: 180000000,
      },
      {
        location: "경기도 성남시 분당구 백현동 124",
        area: "150㎡",
        tradeAmount: 150000000,
      },
    ],
    landCompensation: null,
    landUsePlan: "주거지역",
  } as LandFundingItems,
  itemStatus: { ...MOCK_EXTRACT_RESULT_HOUSING.itemStatus },
  feedback: [...MOCK_EXTRACT_RESULT_HOUSING.feedback],
  storyOriginal: MOCK_EXTRACT_RESULT_HOUSING.storyOriginal,
};

// 응답 JSON에서 알려지지 않은 키 필터링 + 타입 보정
import {
  KNOWN_NUMERIC_KEYS,
  emptyHousingItems,
} from "./funding-types";

// 안전한 숫자 변환 (null/undefined/문자열 → number | null)
function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").trim();
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return isNaN(n) ? null : n;
  }
  return null;
}

// 안전한 boolean 변환
function toBooleanOrNull(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const lower = v.toLowerCase().trim();
    if (lower === "true" || lower === "yes" || lower === "예") return true;
    if (lower === "false" || lower === "no" || lower === "아니오") return false;
  }
  return null;
}

// 안전한 문자열 변환
function toStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return null;
}

// Claude 응답 JSON을 안전하게 정규화한 추출 결과로 변환
export function normalizeExtractResponse(
  raw: unknown,
  formType: "housing" | "land",
  storyOriginal: string
): FundingExtractResult {
  const safe = (raw ?? {}) as Record<string, unknown>;
  const rawItems = (safe.items ?? {}) as Record<string, unknown>;
  const rawStatus = (safe.itemStatus ?? {}) as Record<string, unknown>;
  const rawFeedback = safe.feedback;

  // 빈 항목으로 시작 후 알려진 키만 채움
  const items: HousingFundingItems = emptyHousingItems();

  for (const key of KNOWN_NUMERIC_KEYS) {
    if (key in rawItems) {
      (items as unknown as Record<string, unknown>)[key] = toNumberOrNull(
        rawItems[key]
      );
    }
  }

  // 특수 필드
  if ("giftTaxFiled" in rawItems) {
    items.giftTaxFiled = toBooleanOrNull(rawItems.giftTaxFiled);
  }
  if ("otherLoanRelation" in rawItems) {
    items.otherLoanRelation = toStringOrNull(rawItems.otherLoanRelation);
  }
  if ("moveInPlan" in rawItems) {
    items.moveInPlan = toStringOrNull(rawItems.moveInPlan);
  }

  // 항목 상태 (알려진 키만)
  const itemStatus: FundingExtractResult["itemStatus"] = {};
  const allowedStatuses = new Set([
    "confirmed",
    "needs_check",
    "missing",
  ]);
  for (const k of Object.keys(rawStatus)) {
    const v = rawStatus[k];
    if (typeof v === "string" && allowedStatuses.has(v)) {
      (itemStatus as Record<string, string>)[k] = v;
    }
  }

  // 피드백 배열
  const feedback: string[] = Array.isArray(rawFeedback)
    ? rawFeedback
        .filter((m) => typeof m === "string" && m.trim() !== "")
        .map((m) => String(m))
    : [];

  // 토지면 토지 전용 필드 빈 값으로 추가
  let finalItems: HousingFundingItems | LandFundingItems = items;
  if (formType === "land") {
    const landItems: LandFundingItems = {
      ...items,
      landParcels: [],
      landCompensation: null,
      landUsePlan: null,
    };

    // raw에 토지 필드가 있으면 흡수 (방어적)
    const rawLandParcels = rawItems.landParcels;
    if (Array.isArray(rawLandParcels)) {
      landItems.landParcels = rawLandParcels
        .map((p) => {
          const obj = (p ?? {}) as Record<string, unknown>;
          return {
            location: toStringOrNull(obj.location) ?? "",
            area: toStringOrNull(obj.area) ?? "",
            tradeAmount: toNumberOrNull(obj.tradeAmount),
          };
        })
        .slice(0, 3);
    }
    if ("landCompensation" in rawItems) {
      landItems.landCompensation = toNumberOrNull(rawItems.landCompensation);
    }
    if ("landUsePlan" in rawItems) {
      landItems.landUsePlan = toStringOrNull(rawItems.landUsePlan);
    }
    finalItems = landItems;
  }

  return {
    formType,
    items: finalItems,
    itemStatus,
    feedback,
    storyOriginal,
  };
}
