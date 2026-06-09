// POST /api/advisor/logout — 세무사 로그아웃 (세션 쿠키 제거)

import { NextResponse } from "next/server";
import { ADVISOR_COOKIE } from "@/lib/advisor-auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADVISOR_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
