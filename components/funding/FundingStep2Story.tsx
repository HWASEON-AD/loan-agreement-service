"use client";
// Step 2: 자금 조달 스토리 입력 + AI 분석
import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LegalNotice } from "@/components/ui/LegalNotice";
import type {
  FundingStep1Data,
  FundingExtractResult,
  FundingExtractResponse,
} from "@/lib/funding-types";

interface Props {
  step1Data: FundingStep1Data;
  initialStory: string;
  onNext: (story: string, result: FundingExtractResult) => void;
  onBack: () => void;
}

// 거래금액 계산
function getTradeAmount(step1: FundingStep1Data): number {
  if (step1.formType === "housing") {
    return step1.baseInfo.tradeAmount ?? 0;
  }
  return step1.baseInfo.landParcels.reduce(
    (sum, p) => sum + (typeof p.tradeAmount === "number" ? p.tradeAmount : 0),
    0
  );
}

export function FundingStep2Story({
  step1Data,
  initialStory,
  onNext,
  onBack,
}: Props) {
  const [story, setStory] = useState(initialStory);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tradeAmount = getTradeAmount(step1Data);

  const handleAnalyze = async () => {
    setError(null);
    if (story.trim().length < 10) {
      setError("자금 조달 상황을 최소 10자 이상 입력해주세요.");
      return;
    }
    if (story.length > 2000) {
      setError("최대 2,000자까지 입력 가능합니다.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/funding-plan/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: step1Data.formType,
          tradeAmount,
          story,
        }),
      });

      const data: FundingExtractResponse = await res.json();
      if (!data.ok || !data.result) {
        setError(data.error ?? "AI 분석에 실패했습니다.");
        return;
      }
      onNext(story, data.result);
    } catch (err) {
      console.error("[step2] 분석 오류:", err);
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          자금 조달 상황을 편하게 설명해 주세요
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          AI가 자동으로 항목을 분류합니다. 금액과 출처를 최대한 구체적으로
          적어주세요.
        </p>
      </div>

      <div className="relative">
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value.slice(0, 2000))}
          rows={8}
          maxLength={2000}
          placeholder={`예) 예금 5천만원 있고, 어머니한테 2억 빌렸어요.
전세 보증금 5천도 있고, 현금 3천만원 있습니다.`}
          className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          disabled={isLoading}
        />
        <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
          <span>최소 10자 ~ 최대 2,000자</span>
          <span>{story.length} / 2000</span>
        </div>
      </div>

      <LegalNotice tone="info" title="TIP. 이런 정보가 있으면 더 정확해요">
        <ul className="ml-4 mt-1 list-disc space-y-0.5 text-sm">
          <li>금융기관 이름 (국민은행, 신한은행 등)</li>
          <li>가족 관계 (어머니, 형제 등)</li>
          <li>증여 / 차용 구분</li>
          <li>대출 종류 (담보대출, 신용대출 등)</li>
        </ul>
      </LegalNotice>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          ← 이전
        </Button>
        <Button
          onClick={handleAnalyze}
          disabled={isLoading || story.trim().length < 10 || story.length > 2000}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              AI가 분석하는 중...
            </span>
          ) : (
            "AI 분석하기"
          )}
        </Button>
      </div>
    </Card>
  );
}
