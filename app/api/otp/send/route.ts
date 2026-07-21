// POST /api/otp/send — OTP 발송 (Mock: 콘솔 출력 + 응답에 코드 포함)

import { NextRequest, NextResponse } from "next/server";
import { getAgreement, getAgreementByBorrowerToken } from "@/lib/db";
import { sendOtp } from "@/lib/otp";
import { getClientIp } from "@/lib/request-info";
import { allowRequest } from "@/lib/rate-limit";
import type { SignerType } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    // OTP 메일 반복 발송(스팸) 차단 — 정상 사용자의 재전송/NAT 공유를 고려해
    // 10분당 10건으로 넉넉히. (당사자가 실제로 여러 번 재요청할 수 있음)
    if (!allowRequest(`otp-send:${getClientIp(req)}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json(
        { error: "인증코드 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

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
