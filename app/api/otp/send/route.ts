// POST /api/otp/send — OTP 발송 (Mock: 콘솔 출력 + 응답에 코드 포함)

import { NextRequest, NextResponse } from "next/server";
import { getAgreement, getAgreementByBorrowerToken } from "@/lib/db";
import { sendOtp } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-info";
import type { SignerType } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      agreementId?: string;
      signerType: SignerType;
      token?: string;
    };

    const agreement = body.agreementId
      ? await getAgreement(body.agreementId)
      : body.token
        ? await getAgreementByBorrowerToken(body.token)
        : undefined;

    if (!agreement) {
      return NextResponse.json(
        { error: "약정서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 레이트리밋: 재발송 남용(무차별 대입·이메일 폭탄) 차단
    //  - 약정서+서명자당 10분 5회, IP당 10분 15회, 재발송 30초 쿨다운
    const cooldown = rateLimit(
      `otp-cd:${agreement.id}:${body.signerType}`,
      1,
      30 * 1000
    );
    if (!cooldown.ok) {
      return NextResponse.json(
        { error: `잠시 후 다시 시도해주세요. (${cooldown.retryAfter}초)` },
        { status: 429 }
      );
    }
    const perTarget = rateLimit(
      `otp:${agreement.id}:${body.signerType}`,
      5,
      10 * 60 * 1000
    );
    const perIp = rateLimit(`otp-ip:${getClientIp(req)}`, 15, 10 * 60 * 1000);
    if (!perTarget.ok || !perIp.ok) {
      return NextResponse.json(
        { error: "인증번호 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

    const email =
      body.signerType === "lender"
        ? agreement.lender.email
        : agreement.borrower.email;

    const result = await sendOtp(agreement.id, body.signerType, email);

    return NextResponse.json({
      success: result.success,
      expiresAt: result.expiresAt,
      mockCode: result.mockCode,
      emailHint: email.replace(/(.{2}).*(@.*)/, "$1***$2"),
    });
  } catch (err) {
    console.error("[otp/send] 실패:", err);
    return NextResponse.json(
      { error: "인증번호 발송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
