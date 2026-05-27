// POST /api/agreements/[id]/sign-borrower — 차용자 서명 처리 (토큰 인증) + PDF 생성

import { NextRequest, NextResponse } from "next/server";
import {
  getAgreement,
  updateAgreement,
  addSignature,
  getSignaturesByAgreement,
  getOtp,
} from "@/lib/db";
import { buildAgreementText } from "@/lib/agreement-text";
import { sha256, maskPhone } from "@/lib/hash";
import { uuid } from "@/lib/otp";
import { getClientIp, getUserAgent } from "@/lib/request-info";
import { sendBorrowerSignedNotice } from "@/lib/email";
import type { SignatureRecord } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as {
      token: string;
      signatureImageBase64: string;
    };

    const agreement = await getAgreement(params.id);
    if (!agreement) {
      return NextResponse.json(
        { error: "약정서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 재서명 방지
    if (
      agreement.status === "paid" ||
      agreement.status === "completed" ||
      agreement.borrowerSigned
    ) {
      return NextResponse.json(
        { error: "이미 서명이 완료된 약정서입니다." },
        { status: 400 }
      );
    }

    // 토큰 검증
    if (body.token !== agreement.borrowerSignToken) {
      return NextResponse.json(
        { error: "유효하지 않은 서명 링크입니다." },
        { status: 403 }
      );
    }
    if (
      agreement.borrowerTokenExpiresAt &&
      new Date(agreement.borrowerTokenExpiresAt).getTime() < Date.now()
    ) {
      return NextResponse.json(
        { error: "서명 링크가 만료되었습니다." },
        { status: 410 }
      );
    }
    if (!body.signatureImageBase64) {
      return NextResponse.json(
        { error: "서명 이미지가 없습니다." },
        { status: 400 }
      );
    }

    // OTP 검증 여부 서버 확인
    const otpRecord = await getOtp(agreement.id, "borrower");
    if (!(otpRecord && otpRecord.used)) {
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
      signerType: "borrower",
      signerName: agreement.borrower.name,
      signerPhoneMasked: maskPhone(agreement.borrower.phone),
      signedAt: new Date().toISOString(),
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      otpVerified: true,
      signatureImageBase64: body.signatureImageBase64,
      documentHash,
    };
    await addSignature(record);

    await updateAgreement(agreement.id, {
      status: "borrower_signed",
      borrowerSigned: true,
      documentHash,
    });

    // PDF 생성 (양측 서명 포함)
    try {
      const { generateAgreementPdf } = await import("@/lib/pdf-generator");
      const updated = await getAgreement(agreement.id);
      if (updated) {
        const signatures = await getSignaturesByAgreement(agreement.id);
        const pdfBase64 = await generateAgreementPdf(updated, signatures);
        await updateAgreement(agreement.id, { pdfBase64 });
      }
    } catch (pdfErr) {
      console.error("[sign-borrower] PDF 생성 실패(무시하고 진행):", pdfErr);
    }

    // 대여자에게 알림 이메일
    try {
      await sendBorrowerSignedNotice(
        agreement.lender.email,
        agreement.lender.name,
        agreement.borrower.name
      );
    } catch (mailErr) {
      console.error("[sign-borrower] 알림 발송 실패(무시):", mailErr);
    }

    return NextResponse.json({ success: true, agreementId: agreement.id });
  } catch (err) {
    console.error("[sign-borrower] 실패:", err);
    return NextResponse.json(
      { error: "서명 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
