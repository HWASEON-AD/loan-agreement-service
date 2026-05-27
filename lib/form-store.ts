// 클라이언트 작성 마법사 임시 저장 (sessionStorage)
// Step 1~3 입력값을 브라우저에 보관하다가 생성 API 호출 시 전송한다.

import type { CreateFormData } from "./types";

const KEY = "loan_create_form";
const ID_KEY = "loan_agreement_id";

// 기본 폼 값
export function defaultForm(): CreateFormData {
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return {
    amount: 0,
    interestRate: 0,
    startDate: today,
    endDate: nextYear.toISOString().slice(0, 10),
    repaymentMethod: "lump_sum",
    interestDay: null,
    lender: { name: "", birth: "", phone: "", email: "", address: "" },
    borrower: { name: "", birth: "", phone: "", email: "", address: "" },
    familyRelation: "parent_to_child",
  };
}

// 폼 저장
export function saveForm(data: CreateFormData): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.error("[form-store] 저장 실패:", err);
  }
}

// 폼 로드
export function loadForm(): CreateFormData {
  if (typeof window === "undefined") return defaultForm();
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return defaultForm();
    return { ...defaultForm(), ...JSON.parse(raw) };
  } catch {
    return defaultForm();
  }
}

// 생성된 약정서 ID 저장/로드
export function saveAgreementId(id: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ID_KEY, id);
}

export function loadAgreementId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ID_KEY);
}

// 작성 데이터 초기화
export function clearForm(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(ID_KEY);
}
