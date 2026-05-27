// OTP 생성/검증 로직
// Mock 모드: 콘솔에 코드 출력 + 응답에 포함. 실모드: Resend 이메일 발송.

import { saveOtp, getOtp, markOtpUsed, incrementOtpFailCount } from "./db";
import { isMockMode } from "./config";
import type { OtpCode, SignerType } from "./types";

// OTP 유효시간 (10분)
const OTP_TTL_MS = 10 * 60 * 1000;

// 6자리 숫자 OTP 생성
function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// 간단한 UUID v4 (외부 의존성 없이 사용)
export function uuid(): string {
  // crypto.randomUUID 가 있으면 사용 (Node 18+)
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// OTP 발송 결과
export interface SendOtpResult {
  success: boolean;
  expiresAt: string;
  // Mock 모드에서만 코드 노출 (UI 데모용)
  mockCode?: string;
}

// OTP 생성 + 발송
export async function sendOtp(
  agreementId: string,
  signerType: SignerType,
  email: string
): Promise<SendOtpResult> {
  const code = generateCode();
  const now = Date.now();
  const expiresAt = new Date(now + OTP_TTL_MS).toISOString();

  const otp: OtpCode = {
    id: uuid(),
    agreementId,
    signerType,
    email,
    code,
    expiresAt,
    used: false,
    failCount: 0,
    createdAt: new Date(now).toISOString(),
  };

  await saveOtp(otp);

  if (isMockMode()) {
    // Mock: 콘솔 출력 + 응답에 코드 포함
    console.log(
      `[MOCK OTP] agreement=${agreementId} signer=${signerType} email=${email} 코드: ${code} (만료: ${expiresAt})`
    );
    return { success: true, expiresAt, mockCode: code };
  }

  // 실모드: 이메일 발송 (lib/email.ts)
  try {
    const { sendOtpEmail } = await import("./email");
    await sendOtpEmail(email, code);
    return { success: true, expiresAt };
  } catch (err) {
    console.error("[OTP] 이메일 발송 실패:", err);
    return { success: false, expiresAt };
  }
}

// OTP 최대 실패 허용 횟수
const OTP_MAX_FAIL = 5;

// OTP 검증 (async — DB 조회 필요)
export async function verifyOtp(
  agreementId: string,
  signerType: SignerType,
  code: string
): Promise<{ valid: boolean; reason?: string }> {
  const otp = await getOtp(agreementId, signerType);

  if (!otp) {
    return {
      valid: false,
      reason: "발급된 인증번호가 없습니다. 다시 요청해주세요.",
    };
  }
  if (otp.used) {
    return { valid: false, reason: "이미 사용된 인증번호입니다." };
  }
  if ((otp.failCount ?? 0) >= OTP_MAX_FAIL) {
    return {
      valid: false,
      reason: `인증번호 입력 횟수(${OTP_MAX_FAIL}회)를 초과하였습니다. 다시 요청해주세요.`,
    };
  }
  if (new Date(otp.expiresAt).getTime() < Date.now()) {
    return {
      valid: false,
      reason: "인증번호가 만료되었습니다. 다시 요청해주세요.",
    };
  }
  if (otp.code !== code.trim()) {
    // 실패 횟수 증가
    const failCount = await incrementOtpFailCount(agreementId, signerType);
    const remaining = OTP_MAX_FAIL - failCount;
    const hint =
      remaining > 0 ? ` (남은 시도: ${remaining}회)` : " 다시 요청해주세요.";
    return {
      valid: false,
      reason: `인증번호가 일치하지 않습니다.${hint}`,
    };
  }

  // 검증 성공 → 사용 처리
  await markOtpUsed(agreementId, signerType);
  return { valid: true };
}
