// POST /api/admin/orders/[id]/mark-sent — 내용증명 발송 완료 마킹

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getOrder, updateOrder, updateAgreement } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const order = await getOrder(params.id);
    if (!order) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    await updateOrder(params.id, {
      certMailStatus: "sent",
      certMailSentAt: new Date().toISOString(),
    });
    await updateAgreement(order.agreementId, { status: "completed" });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/mark-sent] 실패:", err);
    return NextResponse.json(
      { error: "발송 완료 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
