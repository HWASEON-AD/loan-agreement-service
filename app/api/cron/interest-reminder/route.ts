// POST /api/cron/interest-reminder — 이자 납부일 알림 발송 (Vercel Cron / 외부 트리거)
// 보안: Authorization: Bearer {CRON_SECRET}
// 로직:
//  1) 오늘(KST) 일자 == billing_day 인 active 구독 조회
//  2) 당월 due_date(=오늘) 기준 interest_records 중복 방지 INSERT
//  3) 납부 알림 이메일 발송 (sendInterestReminderEmail)
//  4) 구독 next_due_date 를 다음 달로 갱신
//  5) { sent } 반환

import { NextRequest, NextResponse } from "next/server";
import {
  getActiveSubscriptionsByBillingDay,
  getAgreement,
  hasInterestRecordForDue,
  createInterestRecord,
  saveSubscription,
} from "@/lib/db";
import { sendInterestReminderEmail } from "@/lib/email";
import { addOneMonth } from "@/lib/interest-calc";
import { uuid } from "@/lib/otp";
import type { InterestRecord } from "@/lib/types";

export async function POST(req: NextRequest) {
  // CRON_SECRET 검증
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    // KST 오늘 날짜 + 일(day)
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = kstNow.toISOString().slice(0, 10);
    const todayDay = kstNow.getUTCDate();

    const subscriptions = await getActiveSubscriptionsByBillingDay(todayDay);

    let sent = 0;

    for (const sub of subscriptions) {
      const agreement = await getAgreement(sub.agreementId);
      if (!agreement) continue;

      // 당월 레코드 중복 방지
      let record: InterestRecord | null = null;
      const exists = await hasInterestRecordForDue(sub.id, todayStr);
      if (!exists) {
        record = {
          id: uuid(),
          subscriptionId: sub.id,
          dueDate: todayStr,
          paidDate: null,
          amount: sub.interestAmount,
          status: "pending",
          note: null,
          createdAt: new Date().toISOString(),
        };
        await createInterestRecord(record);
      } else {
        // 이미 있는 경우에도 알림은 발송 (재실행 안전성)
        record = {
          id: uuid(),
          subscriptionId: sub.id,
          dueDate: todayStr,
          paidDate: null,
          amount: sub.interestAmount,
          status: "pending",
          note: null,
          createdAt: new Date().toISOString(),
        };
      }

      try {
        await sendInterestReminderEmail(sub, record, agreement);
        // next_due_date 를 다음 달로 갱신
        await saveSubscription({
          ...sub,
          nextDueDate: addOneMonth(todayStr),
        });
        sent++;
      } catch (mailErr) {
        console.error(
          `[cron/interest-reminder] 발송 실패 subscription=${sub.id}:`,
          mailErr
        );
      }
    }

    console.log(`[cron/interest-reminder] 완료 sent=${sent}`);
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[cron/interest-reminder] 실패:", err);
    return NextResponse.json(
      { error: "이자 알림 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ★ Vercel Cron 은 **GET** 으로 호출한다. POST 만 있으면 405 로 조용히 실패한다.
//   (2026-08-13 확인: vercel.json 에 등록돼 있는데도 POST 만 export 되어 있었다)
//   기존 로직은 그대로 두고 GET 을 POST 로 위임한다.
export async function GET(req: NextRequest) {
  return POST(req);
}
