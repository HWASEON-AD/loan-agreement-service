// lib/db.ts — 통합 DB 레이어
// Supabase 실모드: getSupabaseAdmin() 클라이언트 사용
// Mock 폴백: NEXT_PUBLIC_MOCK_MODE=true 또는 키 없을 때 mock-store 사용
// 모든 함수는 async — API 라우트에서 await 필수

import { getSupabaseAdmin } from "./supabase";
import * as mock from "./mock-store";
import type {
  Agreement,
  Order,
  OtpCode,
  SignatureRecord,
  SignerType,
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
    pdfBase64: row.pdf_base64 ?? null,
    documentHash: row.document_hash ?? null,
    lenderSigned: row.lender_signed,
    borrowerSigned: row.borrower_signed,
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
    pdf_base64: agreement.pdfBase64,
    document_hash: agreement.documentHash,
    lender_signed: agreement.lenderSigned,
    borrower_signed: agreement.borrowerSigned,
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
