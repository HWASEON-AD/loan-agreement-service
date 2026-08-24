"use client";

// Step 1: 금액 및 조건 설정 + 이자 계산기
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StepForm } from "@/components/StepForm";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LegalNotice } from "@/components/ui/LegalNotice";
import { loadForm, saveForm, defaultForm } from "@/lib/form-store";
import {
  무이자한도,
  적정이자율,
  isInterestFree,
  recommendedRate,
  calcMonthlyInterest,
  formatNumber,
} from "@/lib/interest-calc";
import type { CreateFormData, RepaymentMethod } from "@/lib/types";

export function Step1Amount() {
  const router = useRouter();
  const [form, setForm] = useState<CreateFormData>(defaultForm());
  const [amountStr, setAmountStr] = useState("");
  const [error, setError] = useState("");

  // 저장된 폼 복원
  useEffect(() => {
    const f = loadForm();
    setForm(f);
    if (f.amount > 0) setAmountStr(String(f.amount));
  }, []);

  const amount = Number(amountStr.replace(/[^0-9]/g, "")) || 0;
  const free = isInterestFree(amount);
  const rate = free ? 0 : (적정이자율 * 100).toFixed(1); // % 표기용 (소수 → 퍼센트)
  const monthly = calcMonthlyInterest(amount, recommendedRate(amount));

  // 필수 입력 충족 여부 (버튼 활성화 조건)
  const datesValid = (() => {
    if (!form.startDate || !form.endDate) return false;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (end <= start) return false;
    const maxEnd = new Date(start);
    maxEnd.setFullYear(maxEnd.getFullYear() + 5);
    return end <= maxEnd;
  })();
  const canNext = amount >= 100000 && datesValid;

  // 만기일 입력칸의 허용 범위 — 라벨의 "최대 5년"을 달력에서도 못 넘게 막는다.
  //   (검증은 아래 handleNext 에도 그대로 남겨 둔다 — 붙여넣기 입력 대비)
  const endBounds = (() => {
    if (!form.startDate) return {};
    const max = new Date(form.startDate);
    max.setFullYear(max.getFullYear() + 5);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { min: form.startDate, max: iso(max) };
  })();

  // 다음 단계로
  const handleNext = () => {
    if (amount < 100000) {
      setError("대여 금액은 최소 10만원 이상이어야 합니다.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError("대여 시작일과 만기일을 입력해주세요.");
      return;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      setError("만기일은 시작일보다 이후여야 합니다.");
      return;
    }
    // 만기 최대 5년 검증
    const maxEnd = new Date(form.startDate);
    maxEnd.setFullYear(maxEnd.getFullYear() + 5);
    if (new Date(form.endDate) > maxEnd) {
      setError("만기일은 시작일로부터 최대 5년까지 설정할 수 있습니다.");
      return;
    }

    const updated: CreateFormData = {
      ...form,
      amount,
      interestRate: free ? 0 : 적정이자율, // 소수값으로 저장 (예: 0.046)
    };
    saveForm(updated);
    router.push("/create/step/2");
  };

  return (
    <StepForm
      step={1}
      title="대여 금액 및 조건"
      description="빌려줄 금액과 기간을 입력하면 적정 이자율이 자동 계산됩니다."
    >
      <div className="space-y-5">
        <Input
          label="대여 금액 (원)"
          inputMode="numeric"
          placeholder="예: 50,000,000"
          value={amount > 0 ? formatNumber(amount) : amountStr}
          onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9]/g, ""))}
          hint="최소 10만원 이상"
        />

        {/* 이자 계산기 결과 박스 */}
        {amount >= 100000 && (
          <LegalNotice tone={free ? "info" : "warn"}>
            <div className="space-y-1">
              <p>
                무이자 가능 한도:{" "}
                <span className="font-semibold">
                  {formatNumber(무이자한도)}원
                </span>
              </p>
              {free ? (
                <p className="font-semibold text-green-700">
                  무이자로 약정할 수 있는 금액입니다. (이자율 0%)
                </p>
              ) : (
                <>
                  <p className="font-semibold">
                    한도 초과 — 적정 이자율 연 {rate}% 자동 적용
                  </p>
                  <p>
                    예상 월 이자:{" "}
                    <span className="font-semibold">
                      {formatNumber(monthly)}원
                    </span>
                  </p>
                </>
              )}
            </div>
          </LegalNotice>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="대여 시작일"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <Input
            label="만기일 (최대 5년)"
            type="date"
            {...endBounds}
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </div>

        {/* 상환 방법 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            상환 방법
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { v: "lump_sum", l: "만기 일시상환" },
                { v: "installment", l: "분할상환" },
              ] as { v: RepaymentMethod; l: string }[]
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() =>
                  setForm({ ...form, repaymentMethod: opt.v })
                }
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                  form.repaymentMethod === opt.v
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-slate-300 bg-white text-slate-600"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        {/* 이자 납부일 (무이자 시 비활성) */}
        <Input
          label={`납부일 (매월 ${free ? "— 무이자 시 비활성" : "1~28일"})`}
          type="number"
          min={1}
          max={28}
          disabled={free}
          placeholder="예: 25"
          value={form.interestDay ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              interestDay: e.target.value ? Number(e.target.value) : null,
            })
          }
          hint={free ? "무이자 약정이므로 납부일 입력이 필요 없습니다." : undefined}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button onClick={handleNext} fullWidth disabled={!canNext}>
          다음 — 당사자 정보 입력
        </Button>
      </div>
    </StepForm>
  );
}
