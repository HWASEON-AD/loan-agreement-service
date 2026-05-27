// 문서 해시 유틸 — SHA-256 (감사로그용)

import { createHash } from "crypto";

// 문자열 또는 버퍼의 SHA-256 해시(hex) 반환
export function sha256(data: string | Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(data as any);
  return hash.digest("hex");
}

// 휴대폰 번호 마스킹 (010-1234-5678 -> 010-****-5678)
export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
  }
  // 형식이 다르면 중간을 별표로
  return phone.replace(/\d(?=\d{4})/g, "*");
}
