// GET /api/agreements/[id]/audit-cert?token=xxx — 감사추적인증서 PDF 다운로드
// token 검증 필수 (lenderSignToken 또는 borrowerSignToken)

import { NextRequest, NextResponse } from "next/server";
import { getAgreement, getSignaturesByAgreement } from "@/lib/db";
import { generateAuditCertificate } from "@/lib/audit-certificate";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const agreement = await getAgreement(params.id);

    if (!agreement) {
      return NextResponse.json({ error: "약정서를 찾을 수 없습니다." }, { status: 404 });
    }

    // 토큰 검증 (대여자 또는 차용자 토큰 허용)
    if (
      token !== agreement.lenderSignToken &&
      token !== agreement.borrowerSignToken
    ) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const signatures = await getSignaturesByAgreement(params.id);
    const certBase64 = await generateAuditCertificate(agreement, signatures);
    const pdfBytes = Buffer.from(certBase64, "base64");
    const filename = `audit-cert-${params.id.slice(0, 8)}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[audit-cert] 생성 실패:", err);
    return NextResponse.json({ error: "인증서 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
