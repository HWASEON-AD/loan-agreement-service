// POST /api/agreements/[id]/request-borrower — 차용자에게 서명 요청 이메일 발송

import { NextRequest, NextResponse } from "next/server";
import { getAgreement, updateAgreement } from "@/lib/db";
import { sendBorrowerSignRequest } from "@/lib/email";
import { getBaseUrl } from "@/lib/config";

export async function POST(
  _req: NextRequest,
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

    // 차용자 토큰 만료 갱신 (7일)
    const expires = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    await updateAgreement(agreement.id, { borrowerTokenExpiresAt: expires });

    try {
      await sendBorrowerSignRequest(
        agreement.borrower.email,
        agreement.borrower.name,
        agreement.lender.name,
        agreement.borrowerSignToken
      );
    } catch (mailErr) {
      console.error(
        "[request-borrower] 이메일 발송 실패(무시하고 진행):",
        mailErr
      );
    }

    const link = `${getBaseUrl()}/sign/${agreement.borrowerSignToken}`;
    console.log(`[request-borrower] 서명 링크: ${link}`);

    return NextResponse.json({
      success: true,
      token: agreement.borrowerSignToken,
      signLink: link,
    });
  } catch (err) {
    console.error("[request-borrower] 실패:", err);
    return NextResponse.json(
      { error: "서명 요청 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
