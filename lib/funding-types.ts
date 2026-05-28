// 자금조달계획서 전용 타입 정의

// 자금조달계획서 서식 종류
export type FundingFormType = "housing" | "land";

// 항목별 상태 (AI 추출 결과 신뢰도)
export type FundingItemStatus = "confirmed" | "needs_check" | "missing";

// 주택 자금조달 항목 (금융위원회 공식 서식 기준)
export interface HousingFundingItems {
  // [자기자금]
  deposit: number | null; // 금융기관 예금액
  stocks: number | null; // 주식·채권 매각대금
  gift: number | null; // 증여·상속
  giftTaxFiled: boolean | null; // 증여세 신고 여부
  inheritance: number | null; // 상속금액
  cash: number | null; // 현금 등 기타
  realEstateSale: number | null; // 부동산 처분대금

  // [차입금]
  mortgageLoan: number | null; // 금융기관 대출액 (담보)
  creditLoan: number | null; // 금융기관 대출액 (신용)
  businessLoan: number | null; // 사업자 대출액
  rentalDeposit: number | null; // 임대보증금
  companySupportOrPrivateLoan: number | null; // 회사지원금·사채
  otherLoan: number | null; // 기타 차입금
  otherLoanRelation: string | null; // 기타 차입금 관계

  // [거래 관련]
  transferAmount: number | null; // 전매금액
  depositSuccession: number | null; // 보증금 승계
  cashPayment: number | null; // 현금 직접 지불
  moveInPlan: string | null; // 입주 예정 시기
}

// 토지 필지 정보
export interface LandParcel {
  location: string; // 소재지
  area: string; // 면적 (㎡ 또는 평)
  tradeAmount: number | null; // 거래금액
}

// 토지 자금조달 항목 (주택 항목 + 토지 전용)
export interface LandFundingItems extends HousingFundingItems {
  landParcels: LandParcel[]; // 토지 필지 (최대 3개)
  landCompensation: number | null; // 토지보상금
  landUsePlan: string | null; // 토지이용계획
}

// 기본 인적사항
export interface FundingPersonInfo {
  name: string; // 성명
  idNumberFront: string; // 주민등록번호 앞 6자리
  idNumberBack: string; // 주민등록번호 뒤 7자리
  address: string; // 주소
  phone: string; // 휴대전화
}

// 주택: 거래금액
export interface HousingBaseInfo extends FundingPersonInfo {
  tradeAmount: number | null; // 거래금액
}

// 토지: 필지별 거래금액 (소계 자동 산출)
export interface LandBaseInfo extends FundingPersonInfo {
  landParcels: LandParcel[]; // 필지 목록
}

// Step 1 데이터 (서식 종류 + 기본 정보)
export type FundingStep1Data =
  | { formType: "housing"; baseInfo: HousingBaseInfo }
  | { formType: "land"; baseInfo: LandBaseInfo };

// AI 추출 결과 (항목 + 상태 + 피드백)
export interface FundingExtractResult {
  formType: FundingFormType;
  items: HousingFundingItems | LandFundingItems;
  itemStatus: Partial<
    Record<
      keyof HousingFundingItems | keyof LandFundingItems,
      FundingItemStatus
    >
  >;
  feedback: string[]; // AI 피드백 메시지 목록
  storyOriginal: string; // 원본 스토리 (수정 추적용)
}

// 위자드 전체 세션 데이터 (sessionStorage 저장)
export interface FundingWizardSession {
  step: 1 | 2 | 3;
  step1: FundingStep1Data | null;
  step2Story: string;
  step3Result: FundingExtractResult | null;
}

// API: /api/funding-plan/extract 요청 본문
export interface FundingExtractRequest {
  formType: FundingFormType;
  tradeAmount: number; // 거래금액 (합계 검증용)
  story: string;
}

// API: /api/funding-plan/extract 응답
export interface FundingExtractResponse {
  ok: boolean;
  result?: FundingExtractResult;
  error?: string;
}

// API: /api/funding-plan/pdf 요청 본문
export interface FundingPdfRequest {
  formType: FundingFormType;
  step1: FundingStep1Data;
  result: FundingExtractResult;
}

// API: /api/funding-plan/pdf 응답
export interface FundingPdfResponse {
  ok: boolean;
  pdfBase64?: string; // PDF를 base64로 반환
  error?: string;
}

// 항목 레이블 (UI 표시용)
export const HOUSING_ITEM_LABELS: Record<keyof HousingFundingItems, string> = {
  deposit: "금융기관 예금액",
  stocks: "주식·채권 매각대금",
  gift: "증여·상속",
  giftTaxFiled: "증여세 신고 여부",
  inheritance: "상속금액",
  cash: "현금 등 기타",
  realEstateSale: "부동산 처분대금",
  mortgageLoan: "금융기관 대출액(담보)",
  creditLoan: "금융기관 대출액(신용)",
  businessLoan: "사업자 대출액",
  rentalDeposit: "임대보증금",
  companySupportOrPrivateLoan: "회사지원금·사채",
  otherLoan: "기타 차입금",
  otherLoanRelation: "기타 차입금 관계",
  transferAmount: "전매금액",
  depositSuccession: "보증금 승계",
  cashPayment: "현금 직접 지불",
  moveInPlan: "입주 예정 시기",
};

// 자기자금 항목 키 목록
export const SELF_FUND_KEYS: (keyof HousingFundingItems)[] = [
  "deposit",
  "stocks",
  "gift",
  "inheritance",
  "cash",
  "realEstateSale",
];

// 차입금 항목 키 목록
export const LOAN_KEYS: (keyof HousingFundingItems)[] = [
  "mortgageLoan",
  "creditLoan",
  "businessLoan",
  "rentalDeposit",
  "companySupportOrPrivateLoan",
  "otherLoan",
];

// 거래 관련 항목 키 목록
export const TRADE_KEYS: (keyof HousingFundingItems)[] = [
  "transferAmount",
  "depositSuccession",
  "cashPayment",
];

// 알려진 모든 숫자형 항목 키 (whitelist 필터링용)
export const KNOWN_NUMERIC_KEYS: (keyof HousingFundingItems)[] = [
  ...SELF_FUND_KEYS,
  ...LOAN_KEYS,
  ...TRADE_KEYS,
];

// 빈 주택 항목 객체 생성
export function emptyHousingItems(): HousingFundingItems {
  return {
    deposit: null,
    stocks: null,
    gift: null,
    giftTaxFiled: null,
    inheritance: null,
    cash: null,
    realEstateSale: null,
    mortgageLoan: null,
    creditLoan: null,
    businessLoan: null,
    rentalDeposit: null,
    companySupportOrPrivateLoan: null,
    otherLoan: null,
    otherLoanRelation: null,
    transferAmount: null,
    depositSuccession: null,
    cashPayment: null,
    moveInPlan: null,
  };
}
