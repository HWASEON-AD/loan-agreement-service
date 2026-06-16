// POST /api/payment/confirm — 결제 완료 처리
// Mock 모드: 즉시 성공 처리. 실모드: 토스페이먼츠 결제 승인 API 호출.

import { NextRequest, NextResponse } from "next/server";
import {
  getAgreement,
  updateAgreement,
  getOrderByAgreement,
  updateOrder,
  getSignaturesByAgreement,
} from "@/lib/db";
import { isMockMode, SERVICE_PRICE } from "@/lib/config";
import { sendCompletionEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      agreementId: string;
      paymentKey?: string;
      orderId?: string;
      amount?: number;
    };

    const agreement = await getAgreement(body.agreementId);
    if (!agreement) {
      return NextResponse.json(
        { error: "약정서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const order = await getOrderByAgreement(body.agreementId);
    if (!order) {
      return NextResponse.json(
        { error: "주문 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 중복 결제 방지
    if (order.status === "paid") {
      return NextResponse.json(
        { error: "이미 결제가 완료된 주문입니다." },
        { status: 409 }
      );
    }

    let paymentKey = body.paymentKey || null;

    const mockAllowed = isMockMode() && process.env.NODE_ENV !== "production";

    if (mockAllowed) {
      paymentKey = `MOCK_${Date.now()}`;
      console.log(
        `[MOCK PAYMENT] agreement=${agreement.id} amount=${SERVICE_PRICE} 자동 결제 성공`
      );
    } else if (isMockMode() && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "결제 설정이 올바르지 않습니다. 관리자에게 문의하세요." },
        { status: 503 }
      );
    } else {
      // 실모드: 토스페이먼츠 결제 승인
      const secretKey = process.env.TOSS_SECRET_KEY;
      if (!secretKey || !body.paymentKey || !body.orderId) {
        return NextResponse.json(
          { error: "결제 정보가 올바르지 않습니다." },
          { status: 400 }
        );
      }
      const auth = Buffer.from(`${secretKey}:`).toString("base64");
      const res = await fetch(
        "https://api.tosspayments.com/v1/payments/confirm",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentKey: body.paymentKey,
            orderId: body.orderId,
            amount: body.amount ?? SERVICE_PRICE,
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        console.error("[payment/confirm] 토스 승인 실패:", text);
        await updateOrder(order.id, { status: "failed" });
        return NextResponse.json(
          { error: "결제 승인에 실패했습니다." },
          { status: 402 }
        );
      }
    }

    const paidAt = new Date().toISOString();
    await updateOrder(order.id, {
      status: "paid",
      paymentKey,
      paidAt,
      certMailStatus: "pending",
    });
    await updateAgreement(agreement.id, { status: "paid" });

    // PDF 가 아직 없으면 생성
    let pdfBase64 = agreement.pdfBase64;
    if (!pdfBase64) {
      try {
        const { generateAgreementPdf } = await import("@/lib/pdf-generator");
        const signatures = await getSignaturesByAgreement(agreement.id);
        const latest = await getAgreement(agreement.id);
        if (latest) {
          pdfBase64 = await generateAgreementPdf(latest, signatures);
          await updateAgreement(agreement.id, { pdfBase64 });
        }
      } catch (pdfErr) {
        console.error("[payment/confirm] PDF 생성 실패(무시):", pdfErr);
      }
    }

    // 양측에 완료 이메일
    try {
      await sendCompletionEmail(
        agreement.lender.email,
        agreement.lender.name,
        agreement.id
      );
      await sendCompletionEmail(
        agreement.borrower.email,
        agreement.borrower.name,
        agreement.id
      );
    } catch (mailErr) {
      console.error("[payment/confirm] 완료 메일 실패(무시):", mailErr);
    }

    return NextResponse.json({
      success: true,
      agreementId: agreement.id,
      pdfUrl: `/api/agreements/${agreement.id}/pdf`,
    });
  } catch (err) {
    console.error("[payment/confirm] 실패:", err);
    return NextResponse.json(
      { error: "결제 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
