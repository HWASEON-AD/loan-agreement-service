"use client";

// Step 6: 결제 — Mock 모드는 자동 성공 처리
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StepForm } from "@/components/StepForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LegalNotice } from "@/components/ui/LegalNotice";
import { loadAgreementId, loadLenderToken, clearForm } from "@/lib/form-store";
import { SERVICE_PRICE, SERVICE_PRICE_ORIGINAL, PAYMENT_PRODUCT_NAME } from "@/lib/config";
import { formatNumber } from "@/lib/interest-calc";

// Mock 모드 여부 (클라이언트 노출 가능한 NEXT_PUBLIC 변수)
const MOCK = process.env.NEXT_PUBLIC_MOCK_MODE !== "false";
// 토스페이먼츠 클라이언트 키 (실모드 시 사용 — 위젯 SDK 연동은 추후 작업)
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";

export function Step6Payment() {
  const router = useRouter();
  const [agreementId, setAgreementId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = loadAgreementId();
    if (!id) {
      router.replace("/create/step/1");
      return;
    }
    setAgreementId(id);
  }, [router]);

  // 결제 진행
  const handlePay = async () => {
    if (!agreementId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId,
          amount: SERVICE_PRICE,
          // 실모드에서는 토스 위젯에서 받은 paymentKey/orderId 를 전달
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "결제 처리 실패");
      const completeId = agreementId;
      const token = loadLenderToken();
      clearForm();
      // 완료화면이 본인 약정서에 접근할 수 있도록 토큰을 URL 로 전달
      router.push(
        token
          ? `/complete/${completeId}?t=${encodeURIComponent(token)}`
          : `/complete/${completeId}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!agreementId) return null;

  return (
    <StepForm
      step={6}
      title="결제"
      description="대여약정서 작성 및 내용증명 발송 서비스 비용을 결제합니다."
    >
      <div className="space-y-5">
        {/* 결제 요약 */}
        <Card>
          <h3 className="mb-3 font-semibold text-slate-900">결제 요약</h3>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-sm">
            <span className="text-slate-600">{PAYMENT_PRODUCT_NAME}</span>
            <span className="font-medium">
              {formatNumber(SERVICE_PRICE)}원
            </span>
          </div>
          <div className="flex items-center justify-between pt-3">
            <span className="font-semibold text-slate-900">총 결제금액</span>
            <div className="text-right">
              {SERVICE_PRICE === 0 && (
                <span className="mr-2 text-sm text-slate-400 line-through">
                  {formatNumber(SERVICE_PRICE_ORIGINAL)}원
                </span>
              )}
              <span className="text-xl font-bold text-brand-700">
                {SERVICE_PRICE === 0 ? "무료 이벤트" : `${formatNumber(SERVICE_PRICE)}원`}
              </span>
            </div>
          </div>
        </Card>

        {SERVICE_PRICE === 0 ? (
          <LegalNotice tone="info" title="현재 무료 서비스">
            지금은 무료로 이용하실 수 있습니다. 서비스 신청 후 내용증명이 발송됩니다.
          </LegalNotice>
        ) : MOCK ? (
          <LegalNotice tone="warn" title="Mock 모드 안내">
            데모 환경입니다. 실제 결제 없이 자동으로 결제 성공 처리됩니다.
          </LegalNotice>
        ) : TOSS_CLIENT_KEY ? (
          <LegalNotice tone="info">
            토스페이먼츠 결제창을 통해 카드/계좌이체로 결제할 수 있습니다.
          </LegalNotice>
        ) : (
          <LegalNotice tone="warn" title="결제 설정 준비 중">
            토스페이먼츠 가맹점 등록 및 클라이언트 키 설정이 필요합니다.
            관리자에게 문의해주세요.
          </LegalNotice>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/create/step/5")}
          >
            이전
          </Button>
          <Button
            onClick={handlePay}
            disabled={loading || (SERVICE_PRICE > 0 && !MOCK && !TOSS_CLIENT_KEY)}
            fullWidth
          >
            {loading
              ? "처리 중..."
              : SERVICE_PRICE === 0
              ? "무료 신청하기"
              : `${formatNumber(SERVICE_PRICE)}원 결제하기`}
          </Button>
        </div>
      </div>
    </StepForm>
  );
}
