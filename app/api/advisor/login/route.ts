// POST /api/advisor/login — 세무사 로그인 (비밀번호 → httpOnly 세션 쿠키)

import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdvisorPassword,
  expectedAdvisorSessionToken,
  ADVISOR_COOKIE,
} from "@/lib/advisor-auth";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { password: string };

    if (!verifyAdvisorPassword(body.password)) {
      return NextResponse.json(
        { error: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(ADVISOR_COOKIE, expectedAdvisorSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      // 페이지(/advisor)와 API(/api/advisor) 양쪽에서 쿠키가 전송되도록 루트 경로 사용
      path: "/",
      maxAge: 60 * 60 * 8, // 8시간
    });
    return res;
  } catch (err) {
    console.error("[advisor/login] 실패:", err);
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
