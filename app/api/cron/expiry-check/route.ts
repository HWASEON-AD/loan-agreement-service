// POST /api/cron/expiry-check — 약정서 만기 알림 발송 (Vercel Cron / 외부 트리거)
// 보안: Authorization: Bearer {CRON_SECRET}
// 로직:
//  1) status IN ('paid','processing','completed') 약정서 중 end_date 기준
//     30일 후 / 7일 후 / 당일 만기 건 필터
//  2) expiry_notifications 에서 이미 발송한 notify_type 확인 (중복 방지)
//  3) 미발송 건에 대해 sendExpiryNoticeEmail() + 기록 INSERT
//  4) { sent, skipped } 반환

import { NextRequest, NextResponse } from "next/server";
import {
  getExpiringAgreements,
  getSentExpiryNotifyTypes,
  recordExpiryNotification,
} from "@/lib/db";
import { sendExpiryNoticeEmail } from "@/lib/email";
import { uuid } from "@/lib/otp";
import type { ExpiryNotifyType } from "@/lib/types";

// 오늘(KST) 기준 end_date 까지 남은 일수 → 알림 타입 결정
// 정확히 30 / 7 / 0 일 남은 건만 알림 (그 외는 null)
function notifyTypeForDaysLeft(daysLeft: number): ExpiryNotifyType | null {
  if (daysLeft === 30) return "30d";
  if (daysLeft === 7) return "7d";
  if (daysLeft === 0) return "0d";
  return null;
}

// KST 기준 두 날짜(YYYY-MM-DD) 간 일수 차 (end - today)
function daysBetween(todayStr: string, endStr: string): number {
  const today = new Date(`${todayStr}T00:00:00.000Z`).getTime();
  const end = new Date(`${endStr}T00:00:00.000Z`).getTime();
  return Math.round((end - today) / (24 * 60 * 60 * 1000));
}

export async function POST(req: NextRequest) {
  // CRON_SECRET 검증
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    // KST 오늘 날짜
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const candidates = await getExpiringAgreements(30);

    let sent = 0;
    let skipped = 0;

    for (const agreement of candidates) {
      const daysLeft = daysBetween(todayStr, agreement.endDate);
      const notifyType = notifyTypeForDaysLeft(daysLeft);
      if (!notifyType) {
        skipped++;
        continue;
      }

      // 이미 발송한 타입이면 스킵 (중복 방지)
      const alreadySent = await getSentExpiryNotifyTypes(agreement.id);
      if (alreadySent.includes(notifyType)) {
        skipped++;
        continue;
      }

      try {
        await sendExpiryNoticeEmail(agreement, notifyType);
        await recordExpiryNotification({
          id: uuid(),
          agreementId: agreement.id,
          notifyType,
          sentAt: new Date().toISOString(),
          emailTo: agreement.lender.email,
        });
        sent++;
      } catch (mailErr) {
        console.error(
          `[cron/expiry-check] 발송 실패 agreement=${agreement.id} type=${notifyType}:`,
          mailErr
        );
        skipped++;
      }
    }

    console.log(`[cron/expiry-check] 완료 sent=${sent} skipped=${skipped}`);
    return NextResponse.json({ sent, skipped });
  } catch (err) {
    console.error("[cron/expiry-check] 실패:", err);
    return NextResponse.json(
      { error: "만기 알림 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
