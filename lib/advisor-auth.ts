// 세무사 전용 인증 헬퍼 — 단순 비밀번호 + httpOnly 세션 쿠키 (admin-auth 패턴 동일)

import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";

// 세션 쿠키 이름
export const ADVISOR_COOKIE = "advisor_session";

// 세무사 비밀번호 획득 (미설정 시 개발 기본값 + 경고)
function getAdvisorPassword(): string {
  const pw = process.env.ADVISOR_PASSWORD;
  if (!pw || pw === "advisor1234") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[SECURITY] ADVISOR_PASSWORD 환경변수를 강력한 비밀번호로 반드시 설정하세요."
      );
    }
    console.warn(
      "[SECURITY WARN] ADVISOR_PASSWORD 가 기본값(advisor1234)입니다. 배포 전 반드시 변경하세요."
    );
    return pw || "advisor1234";
  }
  return pw;
}

// 세무사 비밀번호로부터 생성된 세션 토큰 (결정적 해시)
export function expectedAdvisorSessionToken(): string {
  const pw = getAdvisorPassword();
  return createHash("sha256").update(`loan-advisor:${pw}`).digest("hex");
}

// 비밀번호 검증 — timing-safe 비교
export function verifyAdvisorPassword(password: string): boolean {
  const pw = getAdvisorPassword();
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(pw);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// 현재 요청이 세무사 인증되었는지 확인
export function isAdvisorAuthenticated(): boolean {
  try {
    const store = cookies();
    const token = store.get(ADVISOR_COOKIE)?.value;
    if (!token) return false;
    const expected = expectedAdvisorSessionToken();
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
