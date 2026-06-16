// POST /api/admin/login — 관리자 로그인 (비밀번호 → httpOnly 세션 쿠키)

import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminPassword,
  expectedSessionToken,
  ADMIN_COOKIE,
} from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { password: string };

    if (!verifyAdminPassword(body.password)) {
      return NextResponse.json(
        { error: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ success: true });
    // httpOnly 세션 쿠키 저장 (프론트 JS 접근 불가)
    res.cookies.set(ADMIN_COOKIE, expectedSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/", // /api/admin/* 포함 전체 경로에서 쿠키 전송되도록 루트 사용
      maxAge: 60 * 60 * 8, // 8시간
    });
    return res;
  } catch (err) {
    console.error("[admin/login] 실패:", err);
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
