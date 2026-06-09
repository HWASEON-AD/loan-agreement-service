// GET /api/admin/subscriptions — 구독 목록 + 이자 미납 현황 (관리자)
// 인증: isAdminAuthenticated()
// 각 구독에 대해 약정서(당사자명)와 overdue(미납) 여부를 함께 반환

import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  listSubscriptions,
  getAgreement,
  getInterestRecords,
} from "@/lib/db";

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const subscriptions = await listSubscriptions();

    // KST 오늘
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const rows = [];
    for (const sub of subscriptions) {
      const agreement = await getAgreement(sub.agreementId);
      const records = await getInterestRecords(sub.id);
      // 미납(overdue): pending 이면서 due_date 가 오늘보다 이전
      const overdueCount = records.filter(
        (r) => r.status !== "paid" && r.dueDate < today
      ).length;
      const paidCount = records.filter((r) => r.status === "paid").length;

      rows.push({
        id: sub.id,
        agreementId: sub.agreementId,
        lenderName: agreement?.lender?.name ?? "-",
        borrowerName: agreement?.borrower?.name ?? "-",
        email: sub.email,
        phone: sub.phone,
        status: sub.status,
        billingDay: sub.billingDay,
        interestAmount: sub.interestAmount,
        nextDueDate: sub.nextDueDate,
        createdAt: sub.createdAt,
        overdueCount,
        paidCount,
        recordCount: records.length,
      });
    }

    const stats = {
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      overdue: rows.filter((r) => r.overdueCount > 0).length,
    };

    return NextResponse.json({ subscriptions: rows, stats });
  } catch (err) {
    console.error("[admin/subscriptions] 조회 실패:", err);
    return NextResponse.json(
      { error: "구독 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
