// POST /api/otp/verify — OTP 검증

import { NextRequest, NextResponse } from "next/server";
import { getAgreement, getAgreementByBorrowerToken } from "@/lib/db";
import { verifyOtp } from "@/lib/otp";
import type { SignerType } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      agreementId?: string;
      signerType: SignerType;
      code: string;
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

    const result = await verifyOtp(agreement.id, body.signerType, body.code);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.reason },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error("[otp/verify] 실패:", err);
    return NextResponse.json(
      { error: "인증번호 확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
