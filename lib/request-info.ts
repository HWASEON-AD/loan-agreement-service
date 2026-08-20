// 요청 정보 추출 — 감사로그 / 레이트리밋 키용 IP · User-Agent

import type { NextRequest } from "next/server";

/**
 * 클라이언트 IP 추출.
 *
 * 🚨🚨 `x-forwarded-for` 의 **첫 요소를 쓰면 안 된다.**
 *   XFF 는 "클라이언트 → 프록시1 → 프록시2" 순으로 왼쪽부터 쌓이는데,
 *   **맨 왼쪽 값은 클라이언트가 직접 보낸 값이라 얼마든지 위조된다.**
 *   요청마다 `X-Forwarded-For: 1.2.3.4` 처럼 아무 값이나 바꿔 보내면
 *   레이트리밋 버킷이 매번 새로 생겨 **제한이 통째로 무력화**된다.
 *   (실제로 이 함수가 첫 요소를 쓰고 있었고, OTP 발송·약정서 생성·서식 메일 발송의
 *    레이트리밋이 전부 이 키를 쓰고 있었다. 감사로그의 IP 도 위조 가능했다.)
 *
 * → 신뢰할 수 있는 건 **우리 인프라가 직접 붙인 헤더**뿐이다.
 *   ① `x-vercel-forwarded-for` / ② `x-real-ip` — 플랫폼이 덮어써서 넣는 값
 *   ③ 그래도 없으면 `x-forwarded-for` 의 **마지막 요소**(우리 쪽에 가장 가까운 홉)
 */
export function getClientIp(req: NextRequest): string {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return "unknown";
}

/** 감사기록에 남길 때 IP 뒤쪽을 가린다 (교부 문서에 전체 IP 를 박지 않기 위함) */
export function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return "-";
  if (ip.includes(":")) {
    // IPv6 — 앞 3개 그룹만 남긴다
    const parts = ip.split(":");
    return parts.slice(0, 3).join(":") + ":****";
  }
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
  return "-";
}

// User-Agent 추출
export function getUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent") || "unknown";
}
