// POST /api/agreements/[id]/sign-lender — 대여자 서명 처리 + 감사로그 저장

import { NextRequest, NextResponse } from "next/server";
import { getAgreement, updateAgreement, addSignature, getOtp } from "@/lib/db";
import { buildAgreementText } from "@/lib/agreement-text";
import { sha256, maskPhone } from "@/lib/hash";
import { uuid } from "@/lib/otp";
import { getClientIp, getUserAgent } from "@/lib/request-info";
import type { SignatureRecord } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as {
      signatureImageBase64: string;
    };

    const agreement = await getAgreement(params.id);
    if (!agreement) {
      return NextResponse.json(
        { error: "약정서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (!body.signatureImageBase64) {
      return NextResponse.json(
        { error: "서명 이미지가 없습니다." },
        { status: 400 }
      );
    }

    // OTP 검증 여부 서버 확인 — 사용된(used=true) OTP 가 있어야 서명 허용
    const otpRecord = await getOtp(agreement.id, "lender");
    const otpVerified = !!(otpRecord && otpRecord.used);
    if (!otpVerified) {
      return NextResponse.json(
        { error: "본인인증(OTP)이 완료되지 않았습니다." },
        { status: 403 }
      );
    }

    const docText = buildAgreementText(agreement);
    const documentHash = sha256(docText);

    const record: SignatureRecord = {
      id: uuid(),
      agreementId: agreement.id,
      signerType: "lender",
      signerName: agreement.lender.name,
      signerPhoneMasked: maskPhone(agreement.lender.phone),
      signedAt: new Date().toISOString(),
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      otpVerified: true,
      signatureImageBase64: body.signatureImageBase64,
      documentHash,
    };
    await addSignature(record);

    await updateAgreement(agreement.id, {
      status: "lender_signed",
      lenderSigned: true,
      documentHash,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[sign-lender] 실패:", err);
    return NextResponse.json(
      { error: "서명 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
