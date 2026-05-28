// POST /api/admin/orders/[id]/mark-sent — 내용증명 발송 완료 마킹 + 등기번호 이메일 발송

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getOrder, getAgreement, updateOrder, updateAgreement } from "@/lib/db";
import { sendCertMailTrackingEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const trackingNumber: string | undefined = body?.trackingNumber?.trim();

    const order = await getOrder(params.id);
    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    // 발송완료 마킹 + 등기번호 저장
    await updateOrder(params.id, {
      certMailStatus: "sent",
      certMailSentAt: new Date().toISOString(),
      ...(trackingNumber ? { trackingNumber } : {}),
    });
    await updateAgreement(order.agreementId, { status: "completed" });

    // 등기번호가 있으면 고객 이메일 발송
    if (trackingNumber) {
      const agreement = await getAgreement(order.agreementId);
      if (agreement?.lender?.email) {
        await sendCertMailTrackingEmail(
          agreement.lender.email,
          agreement.lender.name,
          order.agreementId,
          trackingNumber
        ).catch((err) => {
          // 이메일 실패해도 마킹은 성공 처리
          console.error("[mark-sent] 이메일 발송 실패:", err);
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/mark-sent] 실패:", err);
    return NextResponse.json(
      { error: "발송 완료 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
