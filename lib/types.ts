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

  // 갱신(재신청) — 원본 약정서 ID (갱신본일 때만 값 존재)
  parentAgreementId: string | null;

  // 문서
  pdfBase64: string | null; // Mock 모드에서는 base64 로 메모리 보관
  documentHash: string | null; // SHA-256

  // 서명 여부 플래그 (UI 진행 제어용)
  lenderSigned: boolean;
  borrowerSigned: boolean;

  // 이체 증빙 (v3)
  transferConfirmed: boolean; // 이체 확인증 1건 이상 등록 여부
  transferDate: string | null; // 실제 이체일 (YYYY-MM-DD)
  transferNote: string | null; // 이체 관련 메모

  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────
// 이체 증빙 (transfer_evidences) — v3
// ─────────────────────────────────────────────

// 업로드 주체 구분
export type TransferUploader = "lender" | "borrower";

// 이체 확인증 1건
export interface TransferEvidence {
  id: string;
  agreementId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  uploadedBy: TransferUploader;
  createdAt: string;
}

// ─────────────────────────────────────────────
// 이자 관리 구독 (subscriptions / interest_records) — v3
// ─────────────────────────────────────────────

// 구독 상태
export type SubscriptionStatus = "active" | "paused" | "cancelled";

// 이자 관리 구독 1건
export interface Subscription {
  id: string;
  agreementId: string;
  email: string;
  phone: string | null;
  status: SubscriptionStatus;
  billingDay: number; // 매월 이자 납부일 알림 기준일 (1~28)
  interestAmount: number; // 월 이자 금액 (원)
  nextDueDate: string; // YYYY-MM-DD
  createdAt: string;
  cancelledAt: string | null;
}

// 이자 납부 기록 상태
export type InterestRecordStatus = "pending" | "paid" | "overdue";

// 이자 납부 기록 1건
export interface InterestRecord {
  id: string;
  subscriptionId: string;
  dueDate: string; // YYYY-MM-DD
  paidDate: string | null; // YYYY-MM-DD
  amount: number;
  status: InterestRecordStatus;
  note: string | null;
  createdAt: string;
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
  trackingNumber: string | null; // 우체국 등기번호
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

// ─────────────────────────────────────────────
// 세무상담 신청 (tax_consultations)
// ─────────────────────────────────────────────

// 상담 처리 상태
export type TaxConsultStatus = "pending" | "contacted" | "closed";

// 세무상담 신청 1건
export interface TaxConsultation {
  id: string;
  name: string;
  phone: string;
  email?: string;
  content: string;
  status: TaxConsultStatus;
  contactedAt: string | null;
  createdAt: string;
}

// 세무상담 신청 입력 (POST /api/tax-consult/submit)
export interface CreateTaxConsultationInput {
  name: string;
  phone: string;
  email?: string;
  content: string;
}

// ─────────────────────────────────────────────
// 만기 알림 (expiry_notifications)
// ─────────────────────────────────────────────

// 만기 알림 발송 시점 구분
export type ExpiryNotifyType = "30d" | "7d" | "0d";

// 만기 알림 발송 기록 1건
export interface ExpiryNotification {
  id: string;
  agreementId: string;
  notifyType: ExpiryNotifyType;
  sentAt: string;
  emailTo: string;
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
