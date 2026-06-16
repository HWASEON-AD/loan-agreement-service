// 서버 사이드 메모리 스토어 (개발/데모용)
// Mock 모드에서 Supabase 없이 전체 플로우가 작동하도록 메모리에 데이터를 보관한다.
// 주의: 서버 재시작/HMR 시 초기화됨. 실서비스에서는 Supabase 로 교체.

import type {
  Agreement,
  ExpiryNotification,
  ExpiryNotifyType,
  InterestRecord,
  Order,
  OtpCode,
  SignatureRecord,
  Subscription,
  TaxConsultation,
  TransferEvidence,
} from "./types";

// Next.js dev 환경의 HMR 로 모듈이 재평가되어도 같은 스토어를 공유하도록
// globalThis 에 싱글톤으로 저장한다.
interface MockStore {
  agreements: Map<string, Agreement>;
  otpCodes: Map<string, OtpCode>; // key: `${agreementId}:${signerType}`
  orders: Map<string, Order>;
  ordersByAgreement: Map<string, string>; // agreementId -> orderId
  signatures: SignatureRecord[];
  taxConsultations: Map<string, TaxConsultation>;
  expiryNotifications: ExpiryNotification[];
  transferEvidences: TransferEvidence[];
  subscriptions: Map<string, Subscription>;
  interestRecords: InterestRecord[];
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
      taxConsultations: new Map(),
      expiryNotifications: [],
      transferEvidences: [],
      subscriptions: new Map(),
      interestRecords: [],
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

export function deleteAgreement(id: string): void {
  getStore().agreements.delete(id);
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

// ---------- 세무상담 (tax_consultations) ----------

// 세무상담 신청 저장
export function createTaxConsultation(data: TaxConsultation): void {
  getStore().taxConsultations.set(data.id, data);
}

// 세무상담 신청 전체 조회 (최신순)
export function getTaxConsultations(): TaxConsultation[] {
  return Array.from(getStore().taxConsultations.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

// 세무상담 상태 업데이트
export function updateTaxConsultStatus(id: string, status: string): void {
  const store = getStore();
  const item = store.taxConsultations.get(id);
  if (item) store.taxConsultations.set(id, { ...item, status: status as TaxConsultation["status"] });
}

// ---------- 만기 알림 (expiry_notifications) ----------

// 특정 약정서에 대해 이미 발송한 알림 타입 목록
export function getSentExpiryNotifyTypes(
  agreementId: string
): ExpiryNotifyType[] {
  return getStore()
    .expiryNotifications.filter((n) => n.agreementId === agreementId)
    .map((n) => n.notifyType);
}

// 만기 알림 발송 기록 저장
export function recordExpiryNotification(record: ExpiryNotification): void {
  getStore().expiryNotifications.push(record);
}

// 만기 알림 기록 전체 조회 (최신순)
export function listExpiryNotifications(): ExpiryNotification[] {
  return [...getStore().expiryNotifications].sort((a, b) =>
    b.sentAt.localeCompare(a.sentAt)
  );
}

// ---------- 이체 증빙 (transfer_evidences) ----------

// 이체 증빙 추가
export function createTransferEvidence(data: TransferEvidence): void {
  getStore().transferEvidences.push(data);
}

// 특정 약정서의 이체 증빙 목록 (오래된 순)
export function getTransferEvidences(agreementId: string): TransferEvidence[] {
  return getStore()
    .transferEvidences.filter((e) => e.agreementId === agreementId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------- 이자 관리 구독 (subscriptions) ----------

// 구독 저장
export function saveSubscription(sub: Subscription): void {
  getStore().subscriptions.set(sub.id, sub);
}

// 구독 단건 조회
export function getSubscription(id: string): Subscription | undefined {
  return getStore().subscriptions.get(id);
}

// 약정서 ID 로 구독 조회 (최신 1건)
export function getSubscriptionByAgreement(
  agreementId: string
): Subscription | undefined {
  const list = Array.from(getStore().subscriptions.values())
    .filter((s) => s.agreementId === agreementId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return list[0];
}

// 구독 갱신
export function updateSubscription(
  id: string,
  patch: Partial<Subscription>
): Subscription | undefined {
  const store = getStore();
  const existing = store.subscriptions.get(id);
  if (!existing) return undefined;
  const updated: Subscription = { ...existing, ...patch };
  store.subscriptions.set(id, updated);
  return updated;
}

// 전체 구독 목록 (최신순)
export function listSubscriptions(): Subscription[] {
  return Array.from(getStore().subscriptions.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

// 특정 billing_day(매월 납부일)의 active 구독 목록
export function getActiveSubscriptionsByBillingDay(
  billingDay: number
): Subscription[] {
  return Array.from(getStore().subscriptions.values()).filter(
    (s) => s.status === "active" && s.billingDay === billingDay
  );
}

// ---------- 이자 납부 기록 (interest_records) ----------

// 이자 납부 기록 추가
export function createInterestRecord(record: InterestRecord): void {
  getStore().interestRecords.push(record);
}

// 특정 구독의 이자 납부 기록 목록 (납부일 순)
export function getInterestRecords(subscriptionId: string): InterestRecord[] {
  return getStore()
    .interestRecords.filter((r) => r.subscriptionId === subscriptionId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// 이자 납부 기록 갱신
export function updateInterestRecord(
  id: string,
  patch: Partial<InterestRecord>
): InterestRecord | undefined {
  const store = getStore();
  const idx = store.interestRecords.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  const updated: InterestRecord = { ...store.interestRecords[idx], ...patch };
  store.interestRecords[idx] = updated;
  return updated;
}

// ---------- Mock 시드 데이터 (데모/대시보드 시연용) ----------

// KST(한국시간) 기준 오늘 날짜 ISO 문자열 생성 (todayCount 검증용)
// new Date() 는 서버 로컬타임 기준이지만, 시드는 "오늘 생성" 카운트를 맞추기 위해
// 대시보드의 today 계산과 동일한 방식(toLocaleDateString ko-KR)을 사용한다.
function kstTodayDate(): string {
  // YYYY-MM-DD (Asia/Seoul)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 며칠 전 날짜의 ISO 문자열 (KST 기준)
function daysAgoIso(days: number, hour = 10): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() - days);
  const ymd = kst.toISOString().slice(0, 10);
  const hh = String(hour).padStart(2, "0");
  // KST 기준 시각을 UTC ISO 로 표기 (대시보드는 createdAt.slice(0,10) 으로만 비교하므로
  // 날짜만 정확하면 충분하나, 표시 일관성을 위해 KST 자정+hour 를 그대로 ISO 문자열로 둔다)
  return `${ymd}T${hh}:00:00.000Z`;
}

// Mock 시드 약정서 5건 생성 (상태 다양화)
function buildSeedAgreements(): Agreement[] {
  const today = kstTodayDate();
  // 이체 증빙 필드(v3) 기본값을 일괄 주입하기 위해 Omit 후 map 으로 보강
  const seeds: Omit<
    Agreement,
    "transferConfirmed" | "transferDate" | "transferNote"
  >[] = [
    // 1) 서명완료 (오늘 생성)
    {
      id: "mock-001-0000-0000-0000-000000000001",
      status: "borrower_signed",
      amount: 50000000,
      interestRate: 0,
      startDate: "2026-05-01",
      endDate: "2027-05-01",
      repaymentMethod: "lump_sum",
      interestDay: null,
      lender: {
        name: "김철수",
        birth: "700101",
        phone: "010-1234-5678",
        email: "chulsoo@example.com",
        address: "서울시 강남구 테헤란로 1",
      },
      borrower: {
        name: "김영희",
        birth: "950215",
        phone: "010-9876-5432",
        email: "younghee@example.com",
        address: "서울시 서초구 서초대로 2",
      },
      familyRelation: "parent_to_child",
      lenderSignToken: "mock-lender-token-001",
      borrowerSignToken: "mock-borrower-token-001",
      borrowerTokenExpiresAt: null,
      parentAgreementId: null,
      pdfBase64: null,
      documentHash: "seedhash001abcdef",
      lenderSigned: true,
      borrowerSigned: true,
      createdAt: `${today}T10:00:00.000Z`,
      updatedAt: `${today}T14:00:00.000Z`,
    },
    // 2) 서명대기 (대여자만 서명, 형제자매) — 오늘 생성
    {
      id: "mock-002-0000-0000-0000-000000000002",
      status: "lender_signed",
      amount: 30000000,
      interestRate: 0,
      startDate: "2026-05-20",
      endDate: "2027-11-20",
      repaymentMethod: "installment",
      interestDay: 25,
      lender: {
        name: "이민준",
        birth: "880303",
        phone: "010-2222-3333",
        email: "minjun@example.com",
        address: "경기도 성남시 분당구 판교로 3",
      },
      borrower: {
        name: "이소연",
        birth: "920808",
        phone: "010-4444-5555",
        email: "soyeon@example.com",
        address: "경기도 용인시 수지구 4",
      },
      familyRelation: "sibling",
      lenderSignToken: "mock-lender-token-002",
      borrowerSignToken: "mock-borrower-token-002",
      borrowerTokenExpiresAt: null,
      parentAgreementId: null,
      pdfBase64: null,
      documentHash: "seedhash002abcdef",
      lenderSigned: true,
      borrowerSigned: false,
      createdAt: `${today}T09:00:00.000Z`,
      updatedAt: `${today}T09:30:00.000Z`,
    },
    // 3) 서명완료 (배우자) — 며칠 전
    {
      id: "mock-003-0000-0000-0000-000000000003",
      status: "borrower_signed",
      amount: 15000000,
      interestRate: 0.046,
      startDate: "2026-04-10",
      endDate: "2027-04-10",
      repaymentMethod: "lump_sum",
      interestDay: null,
      lender: {
        name: "박지훈",
        birth: "850707",
        phone: "010-6666-7777",
        email: "jihoon@example.com",
        address: "부산시 해운대구 5",
      },
      borrower: {
        name: "박수진",
        birth: "870909",
        phone: "010-8888-9999",
        email: "sujin@example.com",
        address: "부산시 수영구 6",
      },
      familyRelation: "spouse",
      lenderSignToken: "mock-lender-token-003",
      borrowerSignToken: "mock-borrower-token-003",
      borrowerTokenExpiresAt: null,
      parentAgreementId: null,
      pdfBase64: null,
      documentHash: "seedhash003abcdef",
      lenderSigned: true,
      borrowerSigned: true,
      createdAt: daysAgoIso(2, 11),
      updatedAt: daysAgoIso(2, 15),
    },
    // 4) 서명대기 (작성 중, 자녀→부모) — 며칠 전
    {
      id: "mock-004-0000-0000-0000-000000000004",
      status: "draft",
      amount: 20000000,
      interestRate: 0,
      startDate: "2026-05-25",
      endDate: "2028-05-25",
      repaymentMethod: "lump_sum",
      interestDay: null,
      lender: {
        name: "최현우",
        birth: "600505",
        phone: "010-1010-2020",
        email: "hyunwoo@example.com",
        address: "대구시 수성구 7",
      },
      borrower: {
        name: "최미래",
        birth: "900101",
        phone: "010-3030-4040",
        email: "mirae@example.com",
        address: "대구시 중구 8",
      },
      familyRelation: "child_to_parent",
      lenderSignToken: "mock-lender-token-004",
      borrowerSignToken: "mock-borrower-token-004",
      borrowerTokenExpiresAt: null,
      parentAgreementId: null,
      pdfBase64: null,
      documentHash: null,
      lenderSigned: false,
      borrowerSigned: false,
      createdAt: daysAgoIso(3, 16),
      updatedAt: daysAgoIso(3, 16),
    },
    // 5) 만료 (취소, 기타) — 28일 전
    {
      id: "mock-005-0000-0000-0000-000000000005",
      status: "cancelled",
      amount: 8000000,
      interestRate: 0,
      startDate: "2026-04-01",
      endDate: "2026-05-01",
      repaymentMethod: "lump_sum",
      interestDay: null,
      lender: {
        name: "정태양",
        birth: "750606",
        phone: "010-5050-6060",
        email: "taeyang@example.com",
        address: "인천시 연수구 9",
      },
      borrower: {
        name: "정달빛",
        birth: "980404",
        phone: "010-7070-8080",
        email: "dalbit@example.com",
        address: "인천시 남동구 10",
      },
      familyRelation: "other",
      lenderSignToken: "mock-lender-token-005",
      borrowerSignToken: "mock-borrower-token-005",
      borrowerTokenExpiresAt: null,
      parentAgreementId: null,
      pdfBase64: null,
      documentHash: "seedhash005abcdef",
      lenderSigned: false,
      borrowerSigned: false,
      createdAt: daysAgoIso(28, 10),
      updatedAt: daysAgoIso(28, 10),
    },
  ];
  // v3 이체 증빙 기본값 보강
  return seeds.map((s) => ({
    ...s,
    transferConfirmed: false,
    transferDate: null,
    transferNote: null,
  }));
}

// Mock 시드 서명 감사로그 생성
function buildSeedSignatures(): SignatureRecord[] {
  return [
    // mock-001: 대여자 + 차용자 서명 (이미지 null)
    {
      id: "sig-001-lender",
      agreementId: "mock-001-0000-0000-0000-000000000001",
      signerType: "lender",
      signerName: "김철수",
      signerPhoneMasked: "010-****-5678",
      signedAt: daysAgoIso(0, 10),
      ipAddress: "123.123.123.1",
      userAgent: "Mozilla/5.0 (Seed)",
      otpVerified: true,
      signatureImageBase64: null,
      documentHash: "seedhash001abcdef",
    },
    {
      id: "sig-001-borrower",
      agreementId: "mock-001-0000-0000-0000-000000000001",
      signerType: "borrower",
      signerName: "김영희",
      signerPhoneMasked: "010-****-5432",
      signedAt: daysAgoIso(0, 14),
      ipAddress: "123.123.123.2",
      userAgent: "Mozilla/5.0 (Seed)",
      otpVerified: true,
      signatureImageBase64: null,
      documentHash: "seedhash001abcdef",
    },
    // mock-003: 대여자 + 차용자 서명
    {
      id: "sig-003-lender",
      agreementId: "mock-003-0000-0000-0000-000000000003",
      signerType: "lender",
      signerName: "박지훈",
      signerPhoneMasked: "010-****-7777",
      signedAt: daysAgoIso(2, 11),
      ipAddress: "210.210.210.1",
      userAgent: "Mozilla/5.0 (Seed)",
      otpVerified: true,
      signatureImageBase64: null,
      documentHash: "seedhash003abcdef",
    },
    {
      id: "sig-003-borrower",
      agreementId: "mock-003-0000-0000-0000-000000000003",
      signerType: "borrower",
      signerName: "박수진",
      signerPhoneMasked: "010-****-9999",
      signedAt: daysAgoIso(2, 15),
      ipAddress: "210.210.210.2",
      userAgent: "Mozilla/5.0 (Seed)",
      otpVerified: true,
      signatureImageBase64: null,
      documentHash: "seedhash003abcdef",
    },
    // mock-002: 대여자만 서명
    {
      id: "sig-002-lender",
      agreementId: "mock-002-0000-0000-0000-000000000002",
      signerType: "lender",
      signerName: "이민준",
      signerPhoneMasked: "010-****-3333",
      signedAt: daysAgoIso(0, 9),
      ipAddress: "1.1.1.1",
      userAgent: "Mozilla/5.0 (Seed)",
      otpVerified: true,
      signatureImageBase64: null,
      documentHash: "seedhash002abcdef",
    },
    // mock-004, mock-005: 서명 레코드 없음
  ];
}

// Mock 초기 시드 데이터 주입 (대시보드 시연용)
// /api/admin/agreements GET 핸들러 최상단에서 Mock 모드일 때 호출.
// 이미 데이터가 있으면 중복 주입을 방지한다.
export function initMockSeedData(): void {
  const store = getStore();
  if (store.agreements.size > 0) return;

  buildSeedAgreements().forEach(saveAgreement);
  buildSeedSignatures().forEach(addSignature);
}
