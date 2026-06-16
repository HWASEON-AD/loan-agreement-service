// lib/db.ts — 통합 DB 레이어
// Supabase 실모드: getSupabaseAdmin() 클라이언트 사용
// Mock 폴백: NEXT_PUBLIC_MOCK_MODE=true 또는 키 없을 때 mock-store 사용
// 모든 함수는 async — API 라우트에서 await 필수

import { getSupabaseAdmin } from "./supabase";
import * as mock from "./mock-store";
import type {
  Agreement,
  ExpiryNotification,
  ExpiryNotifyType,
  InterestRecord,
  InterestRecordStatus,
  Order,
  OtpCode,
  SignatureRecord,
  SignerType,
  Subscription,
  SubscriptionStatus,
  TaxConsultation,
  TaxConsultStatus,
  TransferEvidence,
  TransferUploader,
} from "./types";

// ─────────────────────────────────────────────
// 내부 변환 함수 (snake_case DB ↔ camelCase TS)
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAgreement(row: any): Agreement {
  return {
    id: row.id,
    status: row.status,
    amount: row.amount,
    interestRate: Number(row.interest_rate),
    startDate: row.start_date,
    endDate: row.end_date,
    repaymentMethod: row.repayment_method,
    interestDay: row.interest_day ?? null,
    lender: row.lender,
    borrower: row.borrower,
    familyRelation: row.family_relation,
    lenderSignToken: row.lender_sign_token,
    borrowerSignToken: row.borrower_sign_token,
    borrowerTokenExpiresAt: row.borrower_token_expires_at ?? null,
    parentAgreementId: row.parent_agreement_id ?? null,
    pdfBase64: row.pdf_base64 ?? null,
    documentHash: row.document_hash ?? null,
    lenderSigned: row.lender_signed,
    borrowerSigned: row.borrower_signed,
    transferConfirmed: row.transfer_confirmed ?? false,
    transferDate: row.transfer_date ?? null,
    transferNote: row.transfer_note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToOrder(row: any): Order {
  return {
    id: row.id,
    agreementId: row.agreement_id,
    amount: row.amount,
    status: row.status,
    paymentKey: row.payment_key ?? null,
    paidAt: row.paid_at ?? null,
    certMailStatus: row.cert_mail_status,
    certMailSentAt: row.cert_mail_sent_at ?? null,
    trackingNumber: row.tracking_number ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToOtp(row: any): OtpCode {
  return {
    id: row.id,
    agreementId: row.agreement_id,
    signerType: row.signer_type as SignerType,
    email: row.email,
    code: row.code,
    expiresAt: row.expires_at,
    used: row.used,
    failCount: row.fail_count ?? 0,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSignature(row: any): SignatureRecord {
  return {
    id: row.id,
    agreementId: row.agreement_id,
    signerType: row.signer_type as SignerType,
    signerName: row.signer_name,
    signerPhoneMasked: row.signer_phone_masked,
    signedAt: row.signed_at,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    otpVerified: row.otp_verified,
    signatureImageBase64: row.signature_image_base64 ?? null,
    documentHash: row.document_hash,
  };
}

// ─────────────────────────────────────────────
// Agreement
// ─────────────────────────────────────────────

// 약정서 저장 (신규/갱신 공통)
export async function saveAgreement(agreement: Agreement): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    mock.saveAgreement(agreement);
    return;
  }
  const { error } = await sb.from("agreements").upsert({
    id: agreement.id,
    status: agreement.status,
    amount: agreement.amount,
    interest_rate: agreement.interestRate,
    start_date: agreement.startDate,
    end_date: agreement.endDate,
    repayment_method: agreement.repaymentMethod,
    interest_day: agreement.interestDay,
    lender: agreement.lender,
    borrower: agreement.borrower,
    family_relation: agreement.familyRelation,
    lender_sign_token: agreement.lenderSignToken,
    borrower_sign_token: agreement.borrowerSignToken,
    borrower_token_expires_at: agreement.borrowerTokenExpiresAt,
    parent_agreement_id: agreement.parentAgreementId,
    pdf_base64: agreement.pdfBase64,
    document_hash: agreement.documentHash,
    lender_signed: agreement.lenderSigned,
    borrower_signed: agreement.borrowerSigned,
    transfer_confirmed: agreement.transferConfirmed,
    transfer_date: agreement.transferDate,
    transfer_note: agreement.transferNote,
    created_at: agreement.createdAt,
    updated_at: agreement.updatedAt,
  });
  if (error) throw new Error(`[db] saveAgreement: ${error.message}`);
}

// 약정서 단건 조회
export async function getAgreement(id: string): Promise<Agreement | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getAgreement(id);

  const { data, error } = await sb
    .from("agreements")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  return rowToAgreement(data);
}

// 차용자 서명 토큰으로 조회
export async function getAgreementByBorrowerToken(
  token: string
): Promise<Agreement | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getAgreementByBorrowerToken(token);

  const { data, error } = await sb
    .from("agreements")
    .select("*")
    .eq("borrower_sign_token", token)
    .single();
  if (error || !data) return undefined;
  return rowToAgreement(data);
}

// 약정서 일부 필드 갱신
export async function updateAgreement(
  id: string,
  patch: Partial<Agreement>
): Promise<Agreement | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.updateAgreement(id, patch);

  const dbPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.lenderSigned !== undefined) dbPatch.lender_signed = patch.lenderSigned;
  if (patch.borrowerSigned !== undefined) dbPatch.borrower_signed = patch.borrowerSigned;
  if (patch.documentHash !== undefined) dbPatch.document_hash = patch.documentHash;
  if (patch.pdfBase64 !== undefined) dbPatch.pdf_base64 = patch.pdfBase64;
  if (patch.borrowerTokenExpiresAt !== undefined)
    dbPatch.borrower_token_expires_at = patch.borrowerTokenExpiresAt;
  if (patch.transferConfirmed !== undefined)
    dbPatch.transfer_confirmed = patch.transferConfirmed;
  if (patch.transferDate !== undefined)
    dbPatch.transfer_date = patch.transferDate;
  if (patch.transferNote !== undefined)
    dbPatch.transfer_note = patch.transferNote;

  const { data, error } = await sb
    .from("agreements")
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return undefined;
  return rowToAgreement(data);
}

// 전체 약정서 목록 (최신순)
export async function listAgreements(): Promise<Agreement[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.listAgreements();

  const { data, error } = await sb
    .from("agreements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToAgreement);
}

// ─────────────────────────────────────────────
// OTP
// ─────────────────────────────────────────────

// OTP 저장 (signerType별 최신 1개 유지)
export async function saveOtp(otp: OtpCode): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    mock.saveOtp(otp);
    return;
  }
  // 기존 OTP 삭제 후 새로 삽입
  await sb
    .from("otp_codes")
    .delete()
    .eq("agreement_id", otp.agreementId)
    .eq("signer_type", otp.signerType);

  const { error } = await sb.from("otp_codes").insert({
    id: otp.id,
    agreement_id: otp.agreementId,
    signer_type: otp.signerType,
    email: otp.email,
    code: otp.code,
    expires_at: otp.expiresAt,
    used: otp.used,
    fail_count: otp.failCount,
    created_at: otp.createdAt,
  });
  if (error) throw new Error(`[db] saveOtp: ${error.message}`);
}

// OTP 조회 (최신 1건)
export async function getOtp(
  agreementId: string,
  signerType: string
): Promise<OtpCode | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getOtp(agreementId, signerType);

  const { data, error } = await sb
    .from("otp_codes")
    .select("*")
    .eq("agreement_id", agreementId)
    .eq("signer_type", signerType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToOtp(data);
}

// OTP 사용 처리
export async function markOtpUsed(
  agreementId: string,
  signerType: string
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    mock.markOtpUsed(agreementId, signerType);
    return;
  }
  await sb
    .from("otp_codes")
    .update({ used: true })
    .eq("agreement_id", agreementId)
    .eq("signer_type", signerType);
}

// OTP 실패 횟수 증가 (brute force 방지)
export async function incrementOtpFailCount(
  agreementId: string,
  signerType: string
): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.incrementOtpFailCount(agreementId, signerType);

  const { data } = await sb
    .from("otp_codes")
    .select("id, fail_count")
    .eq("agreement_id", agreementId)
    .eq("signer_type", signerType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return 0;
  const newCount = (data.fail_count ?? 0) + 1;
  await sb
    .from("otp_codes")
    .update({ fail_count: newCount })
    .eq("id", data.id);
  return newCount;
}

// ─────────────────────────────────────────────
// Order
// ─────────────────────────────────────────────

// 주문 저장
export async function saveOrder(order: Order): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    mock.saveOrder(order);
    return;
  }
  const { error } = await sb.from("orders").upsert({
    id: order.id,
    agreement_id: order.agreementId,
    amount: order.amount,
    status: order.status,
    payment_key: order.paymentKey,
    paid_at: order.paidAt,
    cert_mail_status: order.certMailStatus,
    cert_mail_sent_at: order.certMailSentAt,
    notes: order.notes,
    created_at: order.createdAt,
  });
  if (error) throw new Error(`[db] saveOrder: ${error.message}`);
}

// 주문 단건 조회
export async function getOrder(id: string): Promise<Order | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getOrder(id);

  const { data, error } = await sb
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  return rowToOrder(data);
}

// 약정서 ID로 주문 조회
export async function getOrderByAgreement(
  agreementId: string
): Promise<Order | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getOrderByAgreement(agreementId);

  const { data, error } = await sb
    .from("orders")
    .select("*")
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToOrder(data);
}

// 주문 갱신
export async function updateOrder(
  id: string,
  patch: Partial<Order>
): Promise<Order | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.updateOrder(id, patch);

  const dbPatch: Record<string, unknown> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.paymentKey !== undefined) dbPatch.payment_key = patch.paymentKey;
  if (patch.paidAt !== undefined) dbPatch.paid_at = patch.paidAt;
  if (patch.certMailStatus !== undefined) dbPatch.cert_mail_status = patch.certMailStatus;
  if (patch.certMailSentAt !== undefined) dbPatch.cert_mail_sent_at = patch.certMailSentAt;
  if (patch.trackingNumber !== undefined) dbPatch.tracking_number = patch.trackingNumber;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;

  const { data, error } = await sb
    .from("orders")
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return undefined;
  return rowToOrder(data);
}

// 전체 주문 목록 (최신순)
export async function listOrders(): Promise<Order[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.listOrders();

  const { data, error } = await sb
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToOrder);
}

// ─────────────────────────────────────────────
// Signature (감사로그)
// ─────────────────────────────────────────────

// 서명 감사로그 추가
export async function addSignature(record: SignatureRecord): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    mock.addSignature(record);
    return;
  }
  const { error } = await sb.from("signature_records").insert({
    id: record.id,
    agreement_id: record.agreementId,
    signer_type: record.signerType,
    signer_name: record.signerName,
    signer_phone_masked: record.signerPhoneMasked,
    signed_at: record.signedAt,
    ip_address: record.ipAddress,
    user_agent: record.userAgent,
    otp_verified: record.otpVerified,
    signature_image_base64: record.signatureImageBase64,
    document_hash: record.documentHash,
  });
  if (error) throw new Error(`[db] addSignature: ${error.message}`);
}

// 특정 약정서의 서명 감사로그 조회
export async function getSignaturesByAgreement(
  agreementId: string
): Promise<SignatureRecord[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getSignaturesByAgreement(agreementId);

  const { data, error } = await sb
    .from("signature_records")
    .select("*")
    .eq("agreement_id", agreementId)
    .order("signed_at", { ascending: true });
  if (error || !data) return [];
  return data.map(rowToSignature);
}

// ─────────────────────────────────────────────
// 세무상담 (tax_consultations)
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTaxConsultation(row: any): TaxConsultation {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    content: row.content,
    status: row.status as TaxConsultStatus,
    contactedAt: row.contacted_at ?? null,
    createdAt: row.created_at,
  };
}

// 세무상담 신청 저장 (신규 생성)
export async function createTaxConsultation(
  data: TaxConsultation
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    mock.createTaxConsultation(data);
    return;
  }
  const { error } = await sb.from("tax_consultations").insert({
    id: data.id,
    name: data.name,
    phone: data.phone,
    email: data.email ?? null,
    content: data.content,
    status: data.status,
    contacted_at: data.contactedAt,
    created_at: data.createdAt,
  });
  if (error) throw new Error(`[db] createTaxConsultation: ${error.message}`);
}

// 세무상담 신청 전체 조회 (최신순)
export async function getTaxConsultations(): Promise<TaxConsultation[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getTaxConsultations();

  const { data, error } = await sb
    .from("tax_consultations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToTaxConsultation);
}

// 세무상담 상태 업데이트
export async function updateTaxConsultStatus(id: string, status: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) { mock.updateTaxConsultStatus(id, status); return; }
  const { error } = await sb
    .from("tax_consultations")
    .update({ status, ...(status === "contacted" ? { contacted_at: new Date().toISOString() } : {}) })
    .eq("id", id);
  if (error) throw new Error(`[db] updateTaxConsultStatus: ${error.message}`);
}

// ─────────────────────────────────────────────
// 갱신(재신청) + 만기 알림
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToExpiryNotification(row: any): ExpiryNotification {
  return {
    id: row.id,
    agreementId: row.agreement_id,
    notifyType: row.notify_type as ExpiryNotifyType,
    sentAt: row.sent_at,
    emailTo: row.email_to,
  };
}

// 만기 임박 약정서 조회
// status IN ('paid','processing','completed') 인 약정서 중
// end_date 가 오늘로부터 maxDaysAhead 일 이내(또는 이미 만기 경과)인 건을 반환한다.
export async function getExpiringAgreements(
  maxDaysAhead = 30
): Promise<Agreement[]> {
  const all = await listAgreements();
  const targetStatuses = new Set(["paid", "processing", "completed"]);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const limit = new Date(today.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return all.filter((a) => {
    if (!targetStatuses.has(a.status)) return false;
    if (!a.endDate) return false;
    // end_date 가 limit 이하 (만기 경과분 포함). 단 너무 오래 지난 건도 포함되므로
    // 호출부(크론)에서 정확한 D-day 로 다시 필터한다.
    return a.endDate <= limit || a.endDate >= todayStr;
  });
}

// 특정 약정서에 대해 이미 발송한 알림 타입 목록 조회
export async function getSentExpiryNotifyTypes(
  agreementId: string
): Promise<ExpiryNotifyType[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getSentExpiryNotifyTypes(agreementId);

  const { data, error } = await sb
    .from("expiry_notifications")
    .select("notify_type")
    .eq("agreement_id", agreementId);
  if (error || !data) return [];
  return data.map((r) => r.notify_type as ExpiryNotifyType);
}

// 만기 알림 발송 기록 저장
export async function recordExpiryNotification(
  record: ExpiryNotification
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    mock.recordExpiryNotification(record);
    return;
  }
  const { error } = await sb.from("expiry_notifications").insert({
    id: record.id,
    agreement_id: record.agreementId,
    notify_type: record.notifyType,
    sent_at: record.sentAt,
    email_to: record.emailTo,
  });
  if (error)
    throw new Error(`[db] recordExpiryNotification: ${error.message}`);
}

// 만기 알림 기록 조회 (디버그/관리용, 미사용 시 제거 가능)
export async function listExpiryNotifications(): Promise<ExpiryNotification[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.listExpiryNotifications();

  const { data, error } = await sb
    .from("expiry_notifications")
    .select("*")
    .order("sent_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToExpiryNotification);
}

// 갱신 약정서 생성 — 원본을 복사하고 금융 정보만 교체한 신규 약정서를 반환한다.
// 저장(saveAgreement) 은 호출부에서 수행한다.
export async function createRenewalAgreement(
  original: Agreement,
  data: {
    amount: number;
    interestRate: number;
    startDate: string;
    endDate: string;
    repaymentMethod: Agreement["repaymentMethod"];
  },
  newId: string,
  newLenderToken: string,
  newBorrowerToken: string
): Promise<Agreement> {
  const now = new Date().toISOString();
  const borrowerExpires = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const renewal: Agreement = {
    id: newId,
    status: "draft",
    amount: data.amount,
    interestRate: data.interestRate,
    startDate: data.startDate,
    endDate: data.endDate,
    repaymentMethod: data.repaymentMethod,
    interestDay: original.interestDay,
    lender: original.lender,
    borrower: original.borrower,
    familyRelation: original.familyRelation,
    lenderSignToken: newLenderToken,
    borrowerSignToken: newBorrowerToken,
    borrowerTokenExpiresAt: borrowerExpires,
    parentAgreementId: original.id,
    pdfBase64: null,
    documentHash: null,
    lenderSigned: false,
    borrowerSigned: false,
    transferConfirmed: false,
    transferDate: null,
    transferNote: null,
    createdAt: now,
    updatedAt: now,
  };

  await saveAgreement(renewal);
  return renewal;
}

// ─────────────────────────────────────────────
// 이체 증빙 (transfer_evidences) — v3
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTransferEvidence(row: any): TransferEvidence {
  return {
    id: row.id,
    agreementId: row.agreement_id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    fileSize: row.file_size ?? null,
    uploadedBy: (row.uploaded_by ?? "lender") as TransferUploader,
    createdAt: row.created_at,
  };
}

// 이체 증빙 1건 저장
export async function createTransferEvidence(
  data: TransferEvidence
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    mock.createTransferEvidence(data);
    return;
  }
  const { error } = await sb.from("transfer_evidences").insert({
    id: data.id,
    agreement_id: data.agreementId,
    file_name: data.fileName,
    file_url: data.fileUrl,
    file_size: data.fileSize,
    uploaded_by: data.uploadedBy,
    created_at: data.createdAt,
  });
  if (error) throw new Error(`[db] createTransferEvidence: ${error.message}`);
}

// 특정 약정서의 이체 증빙 목록 (오래된 순)
export async function getTransferEvidences(
  agreementId: string
): Promise<TransferEvidence[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getTransferEvidences(agreementId);

  const { data, error } = await sb
    .from("transfer_evidences")
    .select("*")
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map(rowToTransferEvidence);
}

// 약정서 이체 확인 상태 갱신 (transfer_confirmed=true + transfer_date)
export async function updateAgreementTransferStatus(
  agreementId: string,
  date: string
): Promise<Agreement | undefined> {
  return updateAgreement(agreementId, {
    transferConfirmed: true,
    transferDate: date,
  });
}

// Supabase Storage 업로드 — 비공개 버킷에 파일 저장 후 서명 URL(또는 경로) 반환
// Mock 모드/키 없음: data URL(base64) 을 그대로 반환하여 메모리 표시에 사용한다.
export async function uploadTransferFile(
  agreementId: string,
  fileName: string,
  bytes: Uint8Array,
  contentType: string
): Promise<string> {
  const sb = getSupabaseAdmin();
  const path = `${agreementId}/${Date.now()}_${fileName}`;

  if (!sb) {
    // Mock: base64 data URL 로 보관 (서버 재시작 시 사라짐)
    const base64 = Buffer.from(bytes).toString("base64");
    return `data:${contentType};base64,${base64}`;
  }

  const { error } = await sb.storage
    .from("transfer-evidences")
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`[db] uploadTransferFile: ${error.message}`);

  // 비공개 버킷 → 7일 유효 서명 URL 발급. 실패 시 경로 문자열 폴백.
  const { data: signed } = await sb.storage
    .from("transfer-evidences")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return signed?.signedUrl ?? path;
}

// ─────────────────────────────────────────────
// 이자 관리 구독 (subscriptions) — v3
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSubscription(row: any): Subscription {
  return {
    id: row.id,
    agreementId: row.agreement_id,
    email: row.email,
    phone: row.phone ?? null,
    status: row.status as SubscriptionStatus,
    billingDay: row.billing_day,
    interestAmount: Number(row.interest_amount),
    nextDueDate: row.next_due_date,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at ?? null,
  };
}

// 구독 저장 (신규/갱신 공통)
export async function saveSubscription(sub: Subscription): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    mock.saveSubscription(sub);
    return;
  }
  const { error } = await sb.from("subscriptions").upsert({
    id: sub.id,
    agreement_id: sub.agreementId,
    email: sub.email,
    phone: sub.phone,
    status: sub.status,
    billing_day: sub.billingDay,
    interest_amount: sub.interestAmount,
    next_due_date: sub.nextDueDate,
    created_at: sub.createdAt,
    cancelled_at: sub.cancelledAt,
  });
  if (error) throw new Error(`[db] saveSubscription: ${error.message}`);
}

// 구독 단건 조회
export async function getSubscription(
  id: string
): Promise<Subscription | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getSubscription(id);

  const { data, error } = await sb
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  return rowToSubscription(data);
}

// 약정서 ID 로 구독 조회 (최신 1건)
export async function getSubscriptionByAgreement(
  agreementId: string
): Promise<Subscription | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getSubscriptionByAgreement(agreementId);

  const { data, error } = await sb
    .from("subscriptions")
    .select("*")
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToSubscription(data);
}

// 구독 갱신
export async function updateSubscription(
  id: string,
  patch: Partial<Subscription>
): Promise<Subscription | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.updateSubscription(id, patch);

  const dbPatch: Record<string, unknown> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.nextDueDate !== undefined) dbPatch.next_due_date = patch.nextDueDate;
  if (patch.cancelledAt !== undefined) dbPatch.cancelled_at = patch.cancelledAt;
  if (patch.billingDay !== undefined) dbPatch.billing_day = patch.billingDay;
  if (patch.interestAmount !== undefined)
    dbPatch.interest_amount = patch.interestAmount;

  const { data, error } = await sb
    .from("subscriptions")
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return undefined;
  return rowToSubscription(data);
}

// 전체 구독 목록 (최신순)
export async function listSubscriptions(): Promise<Subscription[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.listSubscriptions();

  const { data, error } = await sb
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToSubscription);
}

// 특정 billing_day(매월 납부일)에 해당하는 active 구독 목록 (크론용)
export async function getActiveSubscriptionsByBillingDay(
  billingDay: number
): Promise<Subscription[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getActiveSubscriptionsByBillingDay(billingDay);

  const { data, error } = await sb
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .eq("billing_day", billingDay);
  if (error || !data) return [];
  return data.map(rowToSubscription);
}

// ─────────────────────────────────────────────
// 이자 납부 기록 (interest_records) — v3
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToInterestRecord(row: any): InterestRecord {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    dueDate: row.due_date,
    paidDate: row.paid_date ?? null,
    amount: Number(row.amount),
    status: row.status as InterestRecordStatus,
    note: row.note ?? null,
    createdAt: row.created_at,
  };
}

// 이자 납부 기록 저장
export async function createInterestRecord(
  record: InterestRecord
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    mock.createInterestRecord(record);
    return;
  }
  const { error } = await sb.from("interest_records").insert({
    id: record.id,
    subscription_id: record.subscriptionId,
    due_date: record.dueDate,
    paid_date: record.paidDate,
    amount: record.amount,
    status: record.status,
    note: record.note,
    created_at: record.createdAt,
  });
  if (error) throw new Error(`[db] createInterestRecord: ${error.message}`);
}

// 특정 구독의 이자 납부 기록 목록 (납부일 순)
export async function getInterestRecords(
  subscriptionId: string
): Promise<InterestRecord[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.getInterestRecords(subscriptionId);

  const { data, error } = await sb
    .from("interest_records")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .order("due_date", { ascending: true });
  if (error || !data) return [];
  return data.map(rowToInterestRecord);
}

// 특정 구독·납부일의 기록 존재 여부 (중복 방지용)
export async function hasInterestRecordForDue(
  subscriptionId: string,
  dueDate: string
): Promise<boolean> {
  const records = await getInterestRecords(subscriptionId);
  return records.some((r) => r.dueDate === dueDate);
}

// 이자 납부 기록 갱신
export async function updateInterestRecord(
  id: string,
  patch: Partial<InterestRecord>
): Promise<InterestRecord | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return mock.updateInterestRecord(id, patch);

  const dbPatch: Record<string, unknown> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.paidDate !== undefined) dbPatch.paid_date = patch.paidDate;
  if (patch.note !== undefined) dbPatch.note = patch.note;

  const { data, error } = await sb
    .from("interest_records")
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return undefined;
  return rowToInterestRecord(data);
}
