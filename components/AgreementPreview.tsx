// 약정서 미리보기 — 입력값으로 약정서 전문을 렌더링
import React from "react";
import type { CreateFormData, Agreement } from "@/lib/types";
import { buildAgreementText } from "@/lib/agreement-text";

// CreateFormData 를 임시 Agreement 형태로 변환 (미리보기용)
function toAgreement(form: CreateFormData): Agreement {
  return {
    id: "preview",
    status: "draft",
    amount: form.amount,
    interestRate: form.interestRate,
    startDate: form.startDate,
    endDate: form.endDate,
    repaymentMethod: form.repaymentMethod,
    interestDay: form.interestDay,
    lender: form.lender,
    borrower: form.borrower,
    familyRelation: form.familyRelation,
    lenderSignToken: "",
    borrowerSignToken: "",
    borrowerTokenExpiresAt: null,
    pdfBase64: null,
    documentHash: null,
    lenderSigned: false,
    borrowerSigned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function AgreementPreview({
  form,
  agreement,
}: {
  form?: CreateFormData;
  agreement?: Agreement;
}) {
  const target = agreement ?? (form ? toAgreement(form) : null);
  if (!target) return null;
  const text = buildAgreementText(target);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <pre className="whitespace-pre-wrap break-keep font-sans text-[13px] leading-7 text-slate-800 sm:text-sm">
        {text}
      </pre>
    </div>
  );
}
