// 전역 미들웨어 — 위조 헤더 차단(방어 심층화)
// 클라이언트가 임의로 붙일 수 있는 신뢰 불가 헤더(예: x-admin-access)를
// 라우트 핸들러에 도달하기 전에 제거하여 인증 우회 시도를 원천 차단한다.

import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  // 과거 인증 우회에 악용될 수 있던 헤더 제거
  headers.delete("x-admin-access");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // 모든 API 경로에 적용
  matcher: ["/api/:path*"],
};
