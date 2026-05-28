// 환경설정 헬퍼 — Mock 모드 여부 및 공통 상수

// Mock 모드 여부 (외부 API 키 없이 동작)
// NEXT_PUBLIC_MOCK_MODE 가 명시적으로 "false" 가 아니면 기본 Mock 으로 동작 (데모 안전)
export function isMockMode(): boolean {
  const v = process.env.NEXT_PUBLIC_MOCK_MODE;
  // 'false' 로 명시한 경우에만 실모드, 그 외(미설정/true)는 Mock
  return v !== "false";
}

// 서비스 기본 정보
export const SERVICE_NAME = "/ 내지마요";
export const SERVICE_PRICE = 0; // 현재 무료 (토스페이먼츠 가맹점 등록 후 30000으로 변경)
export const SUBSCRIPTION_PRICE = 9900; // 이자 관리 구독 (월, 원)

// 결제 명목 (법적 제약: 세무 관련 문구 금지)
export const PAYMENT_PRODUCT_NAME = "대여약정서 작성 및 내용증명 발송 서비스";

// Base URL 획득
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}
