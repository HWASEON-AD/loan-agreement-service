// POST /api/agreements/[id]/renew — 갱신(재신청) 약정서 생성
// 1) 원본 약정서 + 토큰(lenderSignToken) 검증
// 2) 신규 Agreement 생성 (parent_agreement_id = 원본 ID, 당사자 복사, 금융정보 교체)
// 3) 신규 lender/borrower 서명 토큰 발급
// 4) 신규 약정서 ID + step 4 리다이렉트 URL 반환

import { NextRequest, NextResponse } from "next/server";
import { getAgreement, createRenewalAgreement, saveOrder } from "@/lib/db";
import { uuid } from "@/lib/otp";
import { SERVICE_PRICE } from "@/lib/config";
import type { Order, RepaymentMethod } from "@/lib/types";

interface RenewRequest {
  token: string;
  amount: number;
  interestRate: number;
  startDate: string;
  endDate: string;
  repaymentMethod: RepaymentMethod;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as Partial<RenewRequest>;

    const original = await getAgreement(params.id);
    if (!original) {
      return NextResponse.json(
        { error: "원본 약정서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 토큰 검증 (대여자 서명 토큰 일치)
    if (!body.token || body.token !== original.lenderSignToken) {
      return NextResponse.json(
        { error: "유효하지 않은 링크입니다." },
        { status: 403 }
      );
    }

    // 입력값 검증
    const amount = Number(body.amount);
    const interestRate = Number(body.interestRate);
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!amount || amount < 100000 || amount > 10_000_000_000) {
      return NextResponse.json(
        { error: "대여 금액이 올바르지 않습니다." },
        { status: 400 }
      );
    }
    if (
      !body.startDate ||
      !body.endDate ||
      !datePattern.test(body.startDate) ||
      !datePattern.test(body.endDate)
    ) {
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
    if (interestRate < 0 || interestRate > 0.2) {
      return NextResponse.json(
        { error: "이자율은 0% ~ 20% 범위여야 합니다." },
        { status: 400 }
      );
    }
    const repaymentMethod: RepaymentMethod =
      body.repaymentMethod === "installment" ? "installment" : "lump_sum";

    // 신규 약정서 생성 (당사자 복사 + 금융정보 교체)
    const newId = uuid();
    const renewal = await createRenewalAgreement(
      original,
      {
        amount,
        interestRate,
        startDate: body.startDate,
        endDate: body.endDate,
        repaymentMethod,
      },
      newId,
      uuid(),
      uuid()
    );

    // 결제 주문도 미리 생성 (기존 작성 플로우와 동일)
    const now = new Date().toISOString();
    const order: Order = {
      id: uuid(),
      agreementId: renewal.id,
      amount: SERVICE_PRICE,
      status: "pending",
      paymentKey: null,
      paidAt: null,
      certMailStatus: "pending",
      certMailSentAt: null,
      trackingNumber: null,
      notes: `갱신 약정서 (원본: ${original.id})`,
      createdAt: now,
    };
    await saveOrder(order);

    return NextResponse.json({
      success: true,
      newAgreementId: renewal.id,
      redirectUrl: `/create/step/4?id=${renewal.id}`,
    });
  } catch (err) {
    console.error("[agreements/renew] 실패:", err);
    return NextResponse.json(
      { error: "갱신 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
