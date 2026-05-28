// POST /api/agreements/create — 약정서 생성

import { NextRequest, NextResponse } from "next/server";
import { saveAgreement, saveOrder } from "@/lib/db";
import { uuid } from "@/lib/otp";
import { SERVICE_PRICE } from "@/lib/config";
import type { Agreement, CreateAgreementRequest, Order } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateAgreementRequest;

    // 필수값 검증
    if (
      !body.amount ||
      body.amount < 100000 ||
      !body.startDate ||
      !body.endDate ||
      !body.lender?.name ||
      !body.lender?.email ||
      !body.borrower?.name ||
      !body.borrower?.email
    ) {
      return NextResponse.json(
        { error: "필수 입력값이 누락되었습니다. (금액/기간/당사자 정보 확인)" },
        { status: 400 }
      );
    }

    // 추가 입력값 검증
    const MAX_AMOUNT = 10_000_000_000; // 100억 상한
    if (body.amount > MAX_AMOUNT) {
      return NextResponse.json(
        { error: "대여 금액이 허용 범위를 초과합니다." },
        { status: 400 }
      );
    }
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(body.startDate) || !datePattern.test(body.endDate)) {
      return NextResponse.json(
        { error: "날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    if (new Date(body.startDate) >= new Date(body.endDate)) {
      return NextResponse.json(
        { error: "종료일은 시작일보다 이후여야 합니다." },
        { status: 400 }
      );
    }
    if (
      body.interestRate !== undefined &&
      (body.interestRate < 0 || body.interestRate > 0.2)
    ) {
      return NextResponse.json(
        { error: "이자율은 0% ~ 20% 범위여야 합니다." },
        { status: 400 }
      );
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      !emailPattern.test(body.lender.email) ||
      !emailPattern.test(body.borrower.email)
    ) {
      return NextResponse.json(
        { error: "이메일 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const borrowerExpires = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const agreement: Agreement = {
      id: uuid(),
      status: "draft",
      amount: body.amount,
      interestRate: body.interestRate ?? 0,
      startDate: body.startDate,
      endDate: body.endDate,
      repaymentMethod: body.repaymentMethod ?? "lump_sum",
      interestDay: body.interestDay ?? null,
      lender: body.lender,
      borrower: body.borrower,
      familyRelation: body.familyRelation ?? "other",
      lenderSignToken: uuid(),
      borrowerSignToken: uuid(),
      borrowerTokenExpiresAt: borrowerExpires,
      pdfBase64: null,
      documentHash: null,
      lenderSigned: false,
      borrowerSigned: false,
      createdAt: now,
      updatedAt: now,
    };

    await saveAgreement(agreement);

    // 결제 주문도 미리 생성 (pending)
    const order: Order = {
      id: uuid(),
      agreementId: agreement.id,
      amount: SERVICE_PRICE,
      status: "pending",
      paymentKey: null,
      paidAt: null,
      certMailStatus: "pending",
      certMailSentAt: null,
      trackingNumber: null,
      notes: null,
      createdAt: now,
    };
    await saveOrder(order);

    return NextResponse.json({ agreementId: agreement.id });
  } catch (err) {
    console.error("[create] 약정서 생성 실패:", err);
    return NextResponse.json(
      { error: "약정서 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
