// GET /api/agreements/[id]/pdf — 서명된 약정서 PDF 다운로드

import { NextRequest, NextResponse } from "next/server";
import { getAgreement, getSignaturesByAgreement } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agreement = await getAgreement(params.id);
    if (!agreement) {
      return NextResponse.json(
        { error: "약정서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 접근 제어: 결제 완료된 약정서만 PDF 제공
    const allowedStatuses = ["paid", "processing", "completed"];
    if (!allowedStatuses.includes(agreement.status)) {
      return NextResponse.json(
        { error: "결제가 완료된 약정서만 PDF를 다운로드할 수 있습니다." },
        { status: 403 }
      );
    }

    // 추가 접근 제어: 어드민 쿠키 또는 토큰 검증
    // (과거 x-admin-access 고정 헤더 우회 제거 — 서명 토큰 또는 관리자 세션만 허용)
    const { searchParams } = new URL(req.url);
    const accessToken = searchParams.get("token");
    const isAdmin = isAdminAuthenticated();

    if (
      !isAdmin &&
      accessToken !== agreement.lenderSignToken &&
      accessToken !== agreement.borrowerSignToken
    ) {
      return NextResponse.json(
        { error: "접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 저장된 PDF 가 있으면 사용, 없으면 즉석 생성
    let pdfBase64 = agreement.pdfBase64;
    if (!pdfBase64) {
      const { generateAgreementPdf } = await import("@/lib/pdf-generator");
      const signatures = await getSignaturesByAgreement(agreement.id);
      pdfBase64 = await generateAgreementPdf(agreement, signatures);
    }

    const buffer = Buffer.from(pdfBase64, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="loan-agreement-${agreement.id}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[pdf] 생성/다운로드 실패:", err);
    return NextResponse.json(
      { error: "PDF 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
