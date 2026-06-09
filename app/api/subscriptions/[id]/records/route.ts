// /api/subscriptions/[id]/records
// GET:  해당 구독의 이자 납부 기록 조회 (token 검증)
// PATCH: 납부 완료 처리 (recordId → paid_date=오늘, status='paid')
// token 은 구독 약정서의 lenderSignToken/borrowerSignToken 과 일치해야 함

import { NextRequest, NextResponse } from "next/server";
import {
  getSubscription,
  getAgreement,
  getInterestRecords,
  updateInterestRecord,
  saveSubscription,
} from "@/lib/db";
import { addOneMonth } from "@/lib/interest-calc";

// 구독 + 토큰 검증 후 약정서 반환 (실패 시 null)
async function authorize(subscriptionId: string, token: string | null) {
  const subscription = await getSubscription(subscriptionId);
  if (!subscription) return { error: "구독을 찾을 수 없습니다.", status: 404 };
  const agreement = await getAgreement(subscription.agreementId);
  if (!agreement) return { error: "약정서를 찾을 수 없습니다.", status: 404 };
  if (
    !token ||
    (token !== agreement.lenderSignToken &&
      token !== agreement.borrowerSignToken)
  ) {
    return { error: "유효하지 않은 접근입니다.", status: 403 };
  }
  return { subscription, agreement };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const auth = await authorize(params.id, token);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const records = await getInterestRecords(params.id);
    return NextResponse.json({ subscription: auth.subscription, records });
  } catch (err) {
    console.error("[subscriptions/records/GET] 실패:", err);
    return NextResponse.json(
      { error: "납부 기록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as { token?: string; recordId?: string };
    const auth = await authorize(params.id, body.token ?? null);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!body.recordId) {
      return NextResponse.json(
        { error: "납부 기록 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 해당 기록이 이 구독의 것인지 확인
    const records = await getInterestRecords(params.id);
    const target = records.find((r) => r.id === body.recordId);
    if (!target) {
      return NextResponse.json(
        { error: "납부 기록을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const updated = await updateInterestRecord(body.recordId, {
      status: "paid",
      paidDate: today,
    });

    // 다음 회차 due 날짜로 구독의 next_due_date 갱신 (있으면)
    try {
      const next = addOneMonth(target.dueDate);
      await saveSubscription({ ...auth.subscription, nextDueDate: next });
    } catch {
      // next_due_date 갱신 실패는 무시 (크론이 별도 처리)
    }

    return NextResponse.json({ success: true, record: updated });
  } catch (err) {
    console.error("[subscriptions/records/PATCH] 실패:", err);
    return NextResponse.json(
      { error: "납부 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
