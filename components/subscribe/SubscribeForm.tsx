"use client";

// 이자 관리 구독 신청 폼
// - 이메일(pre-fill), 연락처, 이자 납부일(1~28), 월 이자 금액 표시
// - "구독 신청하기" → 결제(무료/Mock 즉시 성공) → /api/subscriptions/create
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatNumber } from "@/lib/interest-calc";
import { SUBSCRIPTION_PRICE } from "@/lib/config";

interface SubscribeFormProps {
  agreementId: string;
  token: string;
  defaultEmail: string;
  interestAmount: number;
}

export function SubscribeForm({
  agreementId,
  token,
  defaultEmail,
  interestAmount,
}: SubscribeFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState("");
  const [billingDay, setBillingDay] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreementId, token, email, phone, billingDay }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "구독 신청 실패");
      // 구독 현황 페이지로 이동
      router.push(
        `/subscribe/${agreementId}/dashboard?token=${encodeURIComponent(token)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "구독 신청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        {/* 월 이자 금액 표시 */}
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm text-brand-900/70">월 예상 이자 금액</p>
          <p className="mt-1 text-2xl font-bold text-brand-800">
            {formatNumber(interestAmount)}원
          </p>
        </div>

        <Input
          label="이메일 (알림 수신)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@email.com"
          required
        />

        <Input
          label="연락처"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-1234-5678"
        />

        <div className="w-full">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            이자 납부일 (매월)
          </label>
          <select
            value={billingDay}
            onChange={(e) => setBillingDay(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                매월 {d}일
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            선택한 날짜에 이자 납부 알림을 보내드립니다. (1~28일)
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" fullWidth disabled={loading}>
          {loading
            ? "신청 중..."
            : `구독 신청하기 (월 ${formatNumber(SUBSCRIPTION_PRICE)}원)`}
        </Button>
        <p className="text-center text-xs text-slate-400">
          신청 즉시 첫 납부 회차가 생성되며, 매월 납부일에 알림이 발송됩니다.
        </p>
      </form>
    </Card>
  );
}
