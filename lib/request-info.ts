// 요청 정보 추출 — 감사로그용 IP / User-Agent

import type { NextRequest } from "next/server";

// 클라이언트 IP 추출
// Vercel 등 신뢰 프록시 뒤에서는 x-real-ip / req.ip 가 플랫폼이 설정한 값이라
// 클라이언트가 위조하기 어렵다. 반면 x-forwarded-for 의 "첫 값"은 클라이언트가
// 임의로 붙일 수 있어(레이트리밋 우회·감사로그 IP 위조 악용) 최후순위로만 사용한다.
export function getClientIp(req: NextRequest): string {
  // 1) 플랫폼이 주입하는 신뢰 가능한 값 우선
  const reqIp = (req as unknown as { ip?: string }).ip;
  if (reqIp) return reqIp;
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  // 2) x-forwarded-for: 프록시 체인의 "마지막" 항목이 가장 신뢰 가능(프록시가 append)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
}

// User-Agent 추출
export function getUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent") || "unknown";
}
