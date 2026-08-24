// POST /api/agreements/[id]/request-borrower — 차용자에게 서명 요청 이메일 발송

import { NextRequest, NextResponse } from "next/server";
import { getAgreement, updateAgreement } from "@/lib/db";
import { sendBorrowerSignRequest } from "@/lib/email";
import { getBaseUrl } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
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

    // 인증: 작성자(대여자) 토큰 필수 — 무인증 이메일 폭탄/토큰만료 연장 남용 차단
    const { searchParams } = new URL(req.url);
    let token = searchParams.get("token") || undefined;
    if (!token) {
      try {
        const body = (await req.json()) as { token?: string };
        token = body?.token;
      } catch {
        // 본문 없음 — 아래에서 토큰 부재로 처리
      }
    }
    if (!token || token !== agreement.lenderSignToken) {
      return NextResponse.json(
        { error: "유효하지 않은 요청입니다." },
        { status: 403 }
      );
    }

    // 레이트리밋: 약정서당 1분 3회
    const rl = rateLimit(`req-borrower:${agreement.id}`, 3, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `요청이 너무 잦습니다. ${rl.retryAfter}초 후 다시 시도해주세요.` },
        { status: 429 }
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
