// POST /api/agreements/[id]/request-borrower — 차용자에게 서명 요청 이메일 발송

import { NextRequest, NextResponse } from "next/server";
import { getAgreement, updateAgreement } from "@/lib/db";
import { sendBorrowerSignRequest } from "@/lib/email";
import { getBaseUrl } from "@/lib/config";
import { getClientIp } from "@/lib/request-info";
import { allowRequest } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 차용자에게 실제 이메일을 보내는 경로 — 피싱/스팸 남용 차단(IP당 시간 20건).
    if (!allowRequest(`request-borrower:${getClientIp(req)}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

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
