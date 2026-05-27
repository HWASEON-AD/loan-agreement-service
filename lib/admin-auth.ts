// 관리자 인증 헬퍼 — 단순 비밀번호 + httpOnly 세션 쿠키

import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";

// 세션 쿠키 이름
export const ADMIN_COOKIE = "admin_session";

// 관리자 비밀번호 획득 (미설정 시 경고 + 기본값 거부)
function getAdminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw === "admin1234") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[SECURITY] ADMIN_PASSWORD 환경변수를 강력한 비밀번호로 반드시 설정하세요."
      );
    }
    // 개발 환경에서는 경고만
    console.warn(
      "[SECURITY WARN] ADMIN_PASSWORD 가 기본값(admin1234)입니다. 배포 전 반드시 변경하세요."
    );
    return pw || "admin1234";
  }
  return pw;
}

// 관리자 비밀번호로부터 생성된 세션 토큰 (결정적 해시)
// 실서비스에서는 서명된 JWT 등으로 교체 권장.
export function expectedSessionToken(): string {
  const pw = getAdminPassword();
  return createHash("sha256").update(`loan-admin:${pw}`).digest("hex");
}

// 비밀번호 검증 — timing-safe 비교로 타이밍 공격 방지
export function verifyAdminPassword(password: string): boolean {
  const pw = getAdminPassword();
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(pw);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// 현재 요청이 관리자 인증되었는지 확인 (서버 컴포넌트/route 에서 사용)
export function isAdminAuthenticated(): boolean {
  try {
    const store = cookies();
    const token = store.get(ADMIN_COOKIE)?.value;
    if (!token) return false;
    const expected = expectedSessionToken();
    // 세션 토큰도 timing-safe 비교
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
