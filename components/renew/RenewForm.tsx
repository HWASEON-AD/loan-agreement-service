"use client";

// 갱신 약정서 작성 폼 — 기존 정보 pre-fill, 금융정보 수정 가능, 당사자는 수정 불가
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAgreementId } from "@/lib/form-store";
import type { RepaymentMethod } from "@/lib/types";

interface RenewFormProps {
  agreementId: string;
  token: string;
  initial: {
    amount: number;
    interestRate: number;
    startDate: string;
    endDate: string;
    repaymentMethod: RepaymentMethod;
    lenderName: string;
    borrowerName: string;
  };
}

export function RenewForm({ agreementId, token, initial }: RenewFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(initial.amount));
  // 이자율은 화면에 % 단위로 표시 (저장 시 소수로 변환)
  const [interestPct, setInterestPct] = useState(
    String(+(initial.interestRate * 100).toFixed(2))
  );
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [repaymentMethod, setRepaymentMethod] = useState<RepaymentMethod>(
    initial.repaymentMethod
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const amountNum = Number(amount.replace(/[^0-9]/g, ""));
    const rate = Number(interestPct) / 100;

    if (!amountNum || amountNum < 100000) {
      setError("대여 금액은 10만원 이상이어야 합니다.");
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      setError("만기일은 시작일보다 이후여야 합니다.");
      return;
    }
    if (rate < 0 || rate > 0.2) {
      setError("이자율은 0% ~ 20% 범위여야 합니다.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/agreements/${agreementId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          amount: amountNum,
          interestRate: rate,
          startDate,
          endDate,
          repaymentMethod,
        }),
      });
      const data: {
        success?: boolean;
        newAgreementId?: string;
        error?: string;
      } = await res.json();
      if (!res.ok || !data.success || !data.newAgreementId) {
        throw new Error(data.error || "갱신 처리에 실패했습니다.");
      }
      // 신규 약정서 ID 를 작성 플로우 스토어에 저장 후 서명 단계로 이동
      saveAgreementId(data.newAgreementId);
      router.push("/create/step/4");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "갱신 처리 중 오류가 발생했습니다."
      );
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {/* 금융 정보 (수정 가능) */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          대여 금액 (원)
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          연 이자율 (%)
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="20"
          value={interestPct}
          onChange={(e) => setInterestPct(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            시작일
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            만기일
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          상환 방법
        </label>
        <select
          value={repaymentMethod}
          onChange={(e) =>
            setRepaymentMethod(e.target.value as RepaymentMethod)
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="lump_sum">만기일시상환</option>
          <option value="installment">분할상환</option>
        </select>
      </div>

      {/* 당사자 정보 (수정 불가 — 회색 처리) */}
      <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-500">
            대여자(갑) · 수정 불가
          </label>
          <input
            type="text"
            value={initial.lenderName}
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-500">
            차용자(을) · 수정 불가
          </label>
          <input
            type="text"
            value={initial.borrowerName}
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
      >
        {loading ? "처리 중..." : "갱신 약정서 작성하기 →"}
      </button>
    </form>
  );
}
