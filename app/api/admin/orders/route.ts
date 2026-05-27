// GET /api/admin/orders — 주문 목록 (약정서 정보 병합)

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  listOrders,
  getAgreement,
  getSignaturesByAgreement,
} from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const orders = await listOrders();

    // 주문 + 약정서 병합 (병렬 조회)
    const rowsRaw = await Promise.all(
      orders.map(async (o) => {
        const a = await getAgreement(o.agreementId);
        const signatures = a
          ? (await getSignaturesByAgreement(o.agreementId)).map((s) => ({
              signerType: s.signerType,
              signerName: s.signerName,
              signedAt: s.signedAt,
              ipAddress: s.ipAddress,
            }))
          : [];
        return {
          orderId: o.id,
          agreementId: o.agreementId,
          createdAt: o.createdAt,
          lenderName: a?.lender.name ?? "-",
          borrowerName: a?.borrower.name ?? "-",
          amount: a?.amount ?? 0,
          servicePrice: o.amount,
          agreementStatus: a?.status ?? "draft",
          lenderSigned: a?.lenderSigned ?? false,
          borrowerSigned: a?.borrowerSigned ?? false,
          paymentStatus: o.status,
          certMailStatus: o.certMailStatus,
          certMailSentAt: o.certMailSentAt,
          lenderEmail: a?.lender.email ?? "-",
          lenderPhone: a?.lender.phone ?? "-",
          borrowerEmail: a?.borrower.email ?? "-",
          borrowerPhone: a?.borrower.phone ?? "-",
          signatures,
        };
      })
    );

    let filtered = rowsRaw;
    if (statusFilter && statusFilter !== "all") {
      filtered = rowsRaw.filter(
        (r) =>
          r.certMailStatus === statusFilter ||
          r.paymentStatus === statusFilter ||
          r.agreementStatus === statusFilter
      );
    }

    const stats = {
      total: rowsRaw.length,
      waitingSign: rowsRaw.filter((r) => !r.borrowerSigned).length,
      waitingMail: rowsRaw.filter(
        (r) => r.paymentStatus === "paid" && r.certMailStatus !== "sent"
      ).length,
      monthRevenue: rowsRaw
        .filter((r) => r.paymentStatus === "paid")
        .reduce((sum, r) => sum + r.servicePrice, 0),
    };

    return NextResponse.json({
      orders: filtered,
      total: filtered.length,
      stats,
    });
  } catch (err) {
    console.error("[admin/orders] 실패:", err);
    return NextResponse.json(
      { error: "주문 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
