// POST /api/subscriptions/create — 이자 관리 구독 생성
// 1) 약정서 + 토큰(lender/borrower) 검증
// 2) subscriptions INSERT + 첫 달 interest_records INSERT
// 3) 결제는 무료/Mock 플로우와 동일하게 즉시 성공 처리
// 응답: { success: true, subscriptionId }

import { NextRequest, NextResponse } from "next/server";
import {
  getAgreement,
  getSubscriptionByAgreement,
  saveSubscription,
  createInterestRecord,
} from "@/lib/db";
import { uuid } from "@/lib/otp";
import {
  calcMonthlyInterest,
  computeNextDueDate,
} from "@/lib/interest-calc";
import { sendSubscriptionConfirmEmail } from "@/lib/email";
import type { Subscription, InterestRecord } from "@/lib/types";

interface CreateSubRequest {
  token: string;
  email: string;
  phone?: string;
  billingDay: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CreateSubRequest> & {
      agreementId?: string;
    };

    if (!body.agreementId) {
      return NextResponse.json(
        { error: "약정서 정보가 필요합니다." },
        { status: 400 }
      );
    }

    const agreement = await getAgreement(body.agreementId);
    if (!agreement) {
      return NextResponse.json(
        { error: "약정서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 토큰 검증 (대여자/차용자 서명 토큰 중 하나 일치)
    if (
      !body.token ||
      (body.token !== agreement.lenderSignToken &&
        body.token !== agreement.borrowerSignToken)
    ) {
      return NextResponse.json(
        { error: "유효하지 않은 접근입니다." },
        { status: 403 }
      );
    }

    // 이미 구독이 있으면 중복 방지
    const existing = await getSubscriptionByAgreement(agreement.id);
    if (existing && existing.status === "active") {
      return NextResponse.json(
        { error: "이미 구독 중인 약정서입니다.", subscriptionId: existing.id },
        { status: 409 }
      );
    }

    // 입력값 검증
    const billingDay = Number(body.billingDay);
    if (!billingDay || billingDay < 1 || billingDay > 28) {
      return NextResponse.json(
        { error: "이자 납부일은 1~28일 사이로 선택해주세요." },
        { status: 400 }
      );
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const email = (body.email || agreement.borrower.email || "").trim();
    if (!emailPattern.test(email)) {
      return NextResponse.json(
        { error: "이메일 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // 월 이자 금액 — 이자 약정이 없으면 구독 불가
    const interestAmount = calcMonthlyInterest(
      agreement.amount,
      agreement.interestRate
    );
    if (interestAmount <= 0) {
      return NextResponse.json(
        { error: "이자 약정이 있는 약정서에서만 구독할 수 있습니다." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const nextDueDate = computeNextDueDate(billingDay);

    const subscription: Subscription = {
      id: uuid(),
      agreementId: agreement.id,
      email,
      phone: body.phone?.trim() || null,
      status: "active",
      billingDay,
      interestAmount,
      nextDueDate,
      createdAt: now,
      cancelledAt: null,
    };
    await saveSubscription(subscription);

    // 첫 달 이자 납부 기록 생성
    const firstRecord: InterestRecord = {
      id: uuid(),
      subscriptionId: subscription.id,
      dueDate: nextDueDate,
      paidDate: null,
      amount: interestAmount,
      status: "pending",
      note: null,
      createdAt: now,
    };
    await createInterestRecord(firstRecord);

    // 구독 완료 안내 이메일 (실패 무시)
    try {
      await sendSubscriptionConfirmEmail(subscription, agreement);
    } catch (mailErr) {
      console.error("[subscriptions/create] 안내 메일 실패(무시):", mailErr);
    }

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
    });
  } catch (err) {
    console.error("[subscriptions/create] 실패:", err);
    return NextResponse.json(
      { error: "구독 신청 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
