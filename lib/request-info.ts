// 요청 정보 추출 — 감사로그용 IP / User-Agent

import type { NextRequest } from "next/server";

// 클라이언트 IP 추출 (프록시 헤더 우선)
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

// User-Agent 추출
export function getUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent") || "unknown";
}
