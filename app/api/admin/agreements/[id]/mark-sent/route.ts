// POST /api/admin/agreements/[id]/mark-sent
// agreementId 기준으로 내용증명 발송완료 마킹 + 등기번호 이메일 발송

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getOrderByAgreement, getAgreement, updateOrder, updateAgreement } from "@/lib/db";
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

    const agreement = await getAgreement(params.id);
    if (!agreement) {
      return NextResponse.json({ error: "약정서를 찾을 수 없습니다." }, { status: 404 });
    }

    const order = await getOrderByAgreement(params.id);
    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    await updateOrder(order.id, {
      certMailStatus: "sent",
      certMailSentAt: new Date().toISOString(),
      ...(trackingNumber ? { trackingNumber } : {}),
    });
    await updateAgreement(params.id, { status: "completed" });

    if (trackingNumber && agreement.lender?.email) {
      await sendCertMailTrackingEmail(
        agreement.lender.email,
        agreement.lender.name,
        params.id,
        trackingNumber
      ).catch((err) => {
        console.error("[admin/agreements/mark-sent] 이메일 실패:", err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/agreements/mark-sent] 실패:", err);
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
