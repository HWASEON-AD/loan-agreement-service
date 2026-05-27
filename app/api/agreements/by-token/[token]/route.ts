// GET /api/agreements/by-token/[token] — 차용자 서명 페이지에서 토큰으로 약정서 조회

import { NextRequest, NextResponse } from "next/server";
import { getAgreementByBorrowerToken } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const agreement = await getAgreementByBorrowerToken(params.token);
    if (!agreement) {
      return NextResponse.json(
        { error: "유효하지 않은 서명 링크입니다." },
        { status: 404 }
      );
    }

    const expired =
      agreement.borrowerTokenExpiresAt &&
      new Date(agreement.borrowerTokenExpiresAt).getTime() < Date.now();

    return NextResponse.json({
      agreement,
      expired: !!expired,
      alreadySigned: agreement.borrowerSigned,
    });
  } catch (err) {
    console.error("[by-token] 조회 실패:", err);
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
