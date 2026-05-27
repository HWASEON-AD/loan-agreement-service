// POST /api/admin/orders/[id]/status — 주문/내용증명 상태 변경

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getOrder, updateOrder } from "@/lib/db";
import type { CertMailStatus, OrderStatus } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      paymentStatus?: OrderStatus;
      certMailStatus?: CertMailStatus;
      notes?: string;
    };

    const order = await getOrder(params.id);
    if (!order) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const patch: Record<string, unknown> = {};
    if (body.paymentStatus) patch.status = body.paymentStatus;
    if (body.certMailStatus) {
      patch.certMailStatus = body.certMailStatus;
      if (body.certMailStatus === "sent") {
        patch.certMailSentAt = new Date().toISOString();
      }
    }
    if (body.notes !== undefined) patch.notes = body.notes;

    const updated = await updateOrder(params.id, patch);
    return NextResponse.json({ success: true, order: updated });
  } catch (err) {
    console.error("[admin/status] 실패:", err);
    return NextResponse.json(
      { error: "상태 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
