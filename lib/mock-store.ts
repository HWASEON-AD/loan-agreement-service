// 서버 사이드 메모리 스토어 (개발/데모용)
// Mock 모드에서 Supabase 없이 전체 플로우가 작동하도록 메모리에 데이터를 보관한다.
// 주의: 서버 재시작/HMR 시 초기화됨. 실서비스에서는 Supabase 로 교체.

import type {
  Agreement,
  Order,
  OtpCode,
  SignatureRecord,
} from "./types";

// Next.js dev 환경의 HMR 로 모듈이 재평가되어도 같은 스토어를 공유하도록
// globalThis 에 싱글톤으로 저장한다.
interface MockStore {
  agreements: Map<string, Agreement>;
  otpCodes: Map<string, OtpCode>; // key: `${agreementId}:${signerType}`
  orders: Map<string, Order>;
  ordersByAgreement: Map<string, string>; // agreementId -> orderId
  signatures: SignatureRecord[];
}

declare global {
  // eslint-disable-next-line no-var
  var __LOAN_MOCK_STORE__: MockStore | undefined;
}

// 싱글톤 스토어 획득
function getStore(): MockStore {
  if (!globalThis.__LOAN_MOCK_STORE__) {
    globalThis.__LOAN_MOCK_STORE__ = {
      agreements: new Map(),
      otpCodes: new Map(),
      orders: new Map(),
      ordersByAgreement: new Map(),
      signatures: [],
    };
  }
  return globalThis.__LOAN_MOCK_STORE__;
}

// ---------- Agreement ----------

// 약정서 저장 (신규/갱신 공통)
export function saveAgreement(agreement: Agreement): void {
  getStore().agreements.set(agreement.id, agreement);
}

// 약정서 조회
export function getAgreement(id: string): Agreement | undefined {
  return getStore().agreements.get(id);
}

// 차용자 서명 토큰으로 약정서 조회
export function getAgreementByBorrowerToken(
  token: string
): Agreement | undefined {
  const store = getStore();
  for (const agreement of store.agreements.values()) {
    if (agreement.borrowerSignToken === token) return agreement;
  }
  return undefined;
}

// 약정서 일부 필드 갱신
export function updateAgreement(
  id: string,
  patch: Partial<Agreement>
): Agreement | undefined {
  const store = getStore();
  const existing = store.agreements.get(id);
  if (!existing) return undefined;
  const updated: Agreement = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.agreements.set(id, updated);
  return updated;
}

// 전체 약정서 목록 (최신순)
export function listAgreements(): Agreement[] {
  return Array.from(getStore().agreements.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

// ---------- OTP ----------

// OTP 저장 (signerType 별로 최신 1개만 유지)
export function saveOtp(otp: OtpCode): void {
  const key = `${otp.agreementId}:${otp.signerType}`;
  getStore().otpCodes.set(key, otp);
}

// OTP 조회
export function getOtp(
  agreementId: string,
  signerType: string
): OtpCode | undefined {
  return getStore().otpCodes.get(`${agreementId}:${signerType}`);
}

// OTP 사용 처리 (검증 성공 시)
export function markOtpUsed(agreementId: string, signerType: string): void {
  const store = getStore();
  const key = `${agreementId}:${signerType}`;
  const otp = store.otpCodes.get(key);
  if (otp) {
    store.otpCodes.set(key, { ...otp, used: true });
  }
}

// OTP 실패 횟수 증가 (brute force 방지)
export function incrementOtpFailCount(
  agreementId: string,
  signerType: string
): number {
  const store = getStore();
  const key = `${agreementId}:${signerType}`;
  const otp = store.otpCodes.get(key);
  if (!otp) return 0;
  const updated = { ...otp, failCount: (otp.failCount ?? 0) + 1 };
  store.otpCodes.set(key, updated);
  return updated.failCount;
}

// ---------- Order ----------

// 주문 저장
export function saveOrder(order: Order): void {
  const store = getStore();
  store.orders.set(order.id, order);
  store.ordersByAgreement.set(order.agreementId, order.id);
}

// 주문 조회
export function getOrder(id: string): Order | undefined {
  return getStore().orders.get(id);
}

// 약정서 ID 로 주문 조회
export function getOrderByAgreement(agreementId: string): Order | undefined {
  const store = getStore();
  const orderId = store.ordersByAgreement.get(agreementId);
  return orderId ? store.orders.get(orderId) : undefined;
}

// 주문 갱신
export function updateOrder(
  id: string,
  patch: Partial<Order>
): Order | undefined {
  const store = getStore();
  const existing = store.orders.get(id);
  if (!existing) return undefined;
  const updated: Order = { ...existing, ...patch };
  store.orders.set(id, updated);
  return updated;
}

// 전체 주문 목록 (최신순)
export function listOrders(): Order[] {
  return Array.from(getStore().orders.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

// ---------- Signature (감사로그) ----------

// 서명 감사로그 추가
export function addSignature(record: SignatureRecord): void {
  getStore().signatures.push(record);
}

// 특정 약정서의 서명 감사로그 조회
export function getSignaturesByAgreement(
  agreementId: string
): SignatureRecord[] {
  return getStore().signatures.filter((s) => s.agreementId === agreementId);
}
