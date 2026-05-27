// 전역 TypeScript 타입 정의

// 약정서 상태 (워크플로 진행 단계)
export type AgreementStatus =
  | "draft" // 작성 중
  | "lender_signed" // 대여자 서명 완료
  | "borrower_signed" // 차용자 서명 완료
  | "paid" // 결제 완료
  | "processing" // 내용증명 처리 중
  | "completed" // 완료
  | "cancelled"; // 취소

// 상환 방법
export type RepaymentMethod = "lump_sum" | "installment";

// 서명자 구분
export type SignerType = "lender" | "borrower";

// 가족 관계
export type FamilyRelation =
  | "parent_to_child"
  | "child_to_parent"
  | "sibling"
  | "spouse"
  | "other";

// 가족 관계 라벨 매핑
export const FAMILY_RELATION_LABELS: Record<FamilyRelation, string> = {
  parent_to_child: "부모 → 자녀",
  child_to_parent: "자녀 → 부모",
  sibling: "형제자매",
  spouse: "배우자",
  other: "기타",
};

// 당사자 정보 (대여자/차용자 공통 구조)
export interface Party {
  name: string;
  birth: string; // 생년월일 6자리 (YYMMDD) — 주민번호 수집 금지
  phone: string;
  email: string;
  address: string;
}

// 약정서 본체
export interface Agreement {
  id: string;
  status: AgreementStatus;

  // 금융 정보
  amount: number; // 대여 금액 (원)
  interestRate: number; // 연 이자율 소수값 (예: 4.6% → 0.046, 0이면 무이자)
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  repaymentMethod: RepaymentMethod;
  interestDay: number | null; // 매월 이자 납부일 (1~28)

  // 당사자
  lender: Party;
  borrower: Party;
  familyRelation: FamilyRelation;

  // 서명 토큰
  lenderSignToken: string;
  borrowerSignToken: string;
  borrowerTokenExpiresAt: string | null;

  // 문서
  pdfBase64: string | null; // Mock 모드에서는 base64 로 메모리 보관
  documentHash: string | null; // SHA-256

  // 서명 여부 플래그 (UI 진행 제어용)
  lenderSigned: boolean;
  borrowerSigned: boolean;

  createdAt: string;
  updatedAt: string;
}

// 감사로그 (서명 증거)
export interface SignatureRecord {
  id: string;
  agreementId: string;
  signerType: SignerType;
  signerName: string;
  signerPhoneMasked: string; // 010-****-1234
  signedAt: string;
  ipAddress: string;
  userAgent: string;
  otpVerified: boolean;
  signatureImageBase64: string | null;
  documentHash: string;
}

// 주문 (결제 + 내용증명 발송 관리)
export type OrderStatus = "pending" | "paid" | "failed" | "refunded";
export type CertMailStatus = "pending" | "processing" | "sent";

export interface Order {
  id: string;
  agreementId: string;
  amount: number;
  status: OrderStatus;
  paymentKey: string | null;
  paidAt: string | null;
  certMailStatus: CertMailStatus;
  certMailSentAt: string | null;
  notes: string | null;
  createdAt: string;
}

// OTP 코드
export interface OtpCode {
  id: string;
  agreementId: string;
  signerType: SignerType;
  email: string;
  code: string;
  expiresAt: string;
  used: boolean;
  failCount: number; // 틀린 횟수 (5회 초과 시 잠금)
  createdAt: string;
}

// create API 요청 본문
export interface CreateAgreementRequest {
  amount: number;
  interestRate: number;
  startDate: string;
  endDate: string;
  repaymentMethod: RepaymentMethod;
  interestDay?: number | null;
  lender: Party;
  borrower: Party;
  familyRelation: FamilyRelation;
}

// 작성 마법사에서 클라이언트가 임시 보관하는 폼 데이터
export interface CreateFormData {
  amount: number;
  interestRate: number;
  startDate: string;
  endDate: string;
  repaymentMethod: RepaymentMethod;
  interestDay: number | null;
  lender: Party;
  borrower: Party;
  familyRelation: FamilyRelation;
}
