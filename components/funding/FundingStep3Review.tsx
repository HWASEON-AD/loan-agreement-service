"use client";
// Step 3: 추출 결과 검토 + 인라인 수정 + PDF 다운로드
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LegalNotice } from "@/components/ui/LegalNotice";
import type {
  FundingStep1Data,
  FundingExtractResult,
  HousingFundingItems,
  LandFundingItems,
} from "@/lib/funding-types";
import {
  SELF_FUND_KEYS,
  LOAN_KEYS,
  HOUSING_ITEM_LABELS,
} from "@/lib/funding-types";

interface Props {
  step1Data: FundingStep1Data;
  result: FundingExtractResult;
  onBack: () => void;
}

// 거래금액 (주택: tradeAmount / 토지: 필지 합계)
function getTradeAmount(step1: FundingStep1Data): number {
  if (step1.formType === "housing") {
    return step1.baseInfo.tradeAmount ?? 0;
  }
  return step1.baseInfo.landParcels.reduce(
    (sum, p) => sum + (typeof p.tradeAmount === "number" ? p.tradeAmount : 0),
    0
  );
}

// 상태 배지
function StatusBadge({
  status,
}: {
  status: "confirmed" | "needs_check" | "missing" | undefined;
}) {
  if (!status || status === "missing") {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
        미입력
      </span>
    );
  }
  if (status === "needs_check") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
        확인필요
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
      확인됨
    </span>
  );
}

export function FundingStep3Review({ step1Data, result, onBack }: Props) {
  const isLand = result.formType === "land";
  const tradeAmount = getTradeAmount(step1Data);

  // 편집 가능한 항목 사본
  const [items, setItems] = useState<HousingFundingItems | LandFundingItems>(
    () => ({ ...result.items })
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // 항목 업데이트
  const updateNumeric = (key: keyof HousingFundingItems, raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, "");
    const num = cleaned === "" ? null : Number(cleaned);
    setItems((prev) => ({ ...prev, [key]: num }));
  };
  const updateString = (key: keyof HousingFundingItems, value: string) => {
    setItems((prev) => ({ ...prev, [key]: value || null }));
  };
  const updateBoolean = (
    key: keyof HousingFundingItems,
    value: boolean | null
  ) => {
    setItems((prev) => ({ ...prev, [key]: value }));
  };

  // 합계
  const selfTotal = useMemo(
    () =>
      SELF_FUND_KEYS.reduce((sum, k) => {
        const v = (items as HousingFundingItems)[k];
        return sum + (typeof v === "number" ? v : 0);
      }, 0),
    [items]
  );
  const loanTotal = useMemo(
    () =>
      LOAN_KEYS.reduce((sum, k) => {
        const v = (items as HousingFundingItems)[k];
        return sum + (typeof v === "number" ? v : 0);
      }, 0),
    [items]
  );
  const total = selfTotal + loanTotal;
  const diff = tradeAmount - total;

  // 금액 입력 셀
  const renderAmountInput = (key: keyof HousingFundingItems) => {
    const v = (items as HousingFundingItems)[key];
    const display =
      typeof v === "number" && v > 0 ? v.toLocaleString("ko-KR") : "";
    return (
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => updateNumeric(key, e.target.value)}
        placeholder="-"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm outline-none transition-colors focus:border-brand-500"
      />
    );
  };

  // 자기자금 행
  const renderRow = (key: keyof HousingFundingItems) => {
    const status = result.itemStatus[key];
    return (
      <tr key={key} className="border-b border-slate-100">
        <td className="py-2 px-2 text-sm text-slate-700">
          {HOUSING_ITEM_LABELS[key]}
        </td>
        <td className="py-2 px-2 w-40">{renderAmountInput(key)}</td>
        <td className="py-2 px-2 w-24 text-center">
          <StatusBadge status={status} />
        </td>
      </tr>
    );
  };

  // PDF 다운로드
  const handleDownload = async () => {
    setDownloadError(null);
    setIsDownloading(true);
    try {
      const res = await fetch("/api/funding-plan/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: step1Data.formType,
          step1: step1Data,
          result: { ...result, items },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setDownloadError(
          (data && data.error) ||
            "PDF 생성에 실패했습니다. 잠시 후 다시 시도해주세요."
        );
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      const name =
        step1Data.formType === "housing"
          ? step1Data.baseInfo.name
          : step1Data.baseInfo.name;
      a.download = `자금조달계획서_${name || "user"}_${today}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Blob URL 즉시 해제
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("[step3] PDF 다운로드 오류:", err);
      setDownloadError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* AI 피드백 */}
      {result.feedback.length > 0 && (
        <LegalNotice tone="warn" title="AI 피드백">
          <ul className="ml-4 mt-1 list-disc space-y-1 text-sm">
            {result.feedback.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </LegalNotice>
      )}

      {/* 자기자금 */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">자기자금</h3>
        <table className="w-full">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="py-2 px-2 text-left font-medium">항목</th>
              <th className="py-2 px-2 text-right font-medium">금액(원)</th>
              <th className="py-2 px-2 text-center font-medium">상태</th>
            </tr>
          </thead>
          <tbody>{SELF_FUND_KEYS.map((k) => renderRow(k))}</tbody>
        </table>

        {/* 증여세 신고 여부 (gift 입력 시) */}
        {(items as HousingFundingItems).gift !== null &&
          (items as HousingFundingItems).gift !== 0 && (
            <div className="mt-3 flex items-center gap-3 text-sm">
              <span className="text-slate-600">증여세 신고 여부:</span>
              <select
                value={
                  (items as HousingFundingItems).giftTaxFiled === null
                    ? ""
                    : String((items as HousingFundingItems).giftTaxFiled)
                }
                onChange={(e) => {
                  const v = e.target.value;
                  updateBoolean(
                    "giftTaxFiled",
                    v === "" ? null : v === "true"
                  );
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">미확인</option>
                <option value="true">신고 완료</option>
                <option value="false">미신고</option>
              </select>
            </div>
          )}

        <div className="mt-3 flex items-center justify-end gap-3 border-t border-slate-200 pt-3 text-sm">
          <span className="text-slate-600">자기자금 소계</span>
          <span className="font-semibold text-slate-900">
            {selfTotal.toLocaleString("ko-KR")} 원
          </span>
        </div>
      </Card>

      {/* 차입금 */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">차입금</h3>
        <table className="w-full">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="py-2 px-2 text-left font-medium">항목</th>
              <th className="py-2 px-2 text-right font-medium">금액(원)</th>
              <th className="py-2 px-2 text-center font-medium">상태</th>
            </tr>
          </thead>
          <tbody>{LOAN_KEYS.map((k) => renderRow(k))}</tbody>
        </table>

        {/* 기타 차입금 관계 입력 */}
        {(items as HousingFundingItems).otherLoan !== null &&
          (items as HousingFundingItems).otherLoan !== 0 && (
            <div className="mt-3">
              <label className="mb-1 block text-xs text-slate-600">
                기타 차입금 관계
              </label>
              <input
                type="text"
                value={(items as HousingFundingItems).otherLoanRelation ?? ""}
                onChange={(e) => updateString("otherLoanRelation", e.target.value)}
                placeholder="예: 어머니, 형제, 지인 등"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-500"
              />
            </div>
          )}

        <div className="mt-3 flex items-center justify-end gap-3 border-t border-slate-200 pt-3 text-sm">
          <span className="text-slate-600">차입금 소계</span>
          <span className="font-semibold text-slate-900">
            {loanTotal.toLocaleString("ko-KR")} 원
          </span>
        </div>
      </Card>

      {/* 토지 전용 추가 항목 */}
      {isLand && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            토지 관련
          </h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-600">
                토지보상금 (원)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={
                  typeof (items as LandFundingItems).landCompensation ===
                  "number"
                    ? (items as LandFundingItems).landCompensation!.toLocaleString(
                        "ko-KR"
                      )
                    : ""
                }
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^\d]/g, "");
                  setItems((prev) => ({
                    ...prev,
                    landCompensation: cleaned ? Number(cleaned) : null,
                  } as LandFundingItems));
                }}
                placeholder="-"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">
                토지이용계획
              </label>
              <input
                type="text"
                value={(items as LandFundingItems).landUsePlan ?? ""}
                onChange={(e) =>
                  setItems((prev) => ({
                    ...prev,
                    landUsePlan: e.target.value || null,
                  } as LandFundingItems))
                }
                placeholder="예: 주거지역, 상업지역"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-500"
              />
            </div>
          </div>
        </Card>
      )}

      {/* 합계 검증 */}
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          합계 검증
        </h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">자기자금 + 차입금</span>
            <span className="font-medium">
              {total.toLocaleString("ko-KR")} 원
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">거래금액</span>
            <span className="font-medium">
              {tradeAmount.toLocaleString("ko-KR")} 원
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-slate-600">차액</span>
            {diff === 0 ? (
              <span className="font-semibold text-emerald-600">
                0 원 (일치)
              </span>
            ) : diff > 0 ? (
              <span className="font-semibold text-red-600">
                +{diff.toLocaleString("ko-KR")} 원 부족
              </span>
            ) : (
              <span className="font-semibold text-amber-600">
                {diff.toLocaleString("ko-KR")} 원 초과
              </span>
            )}
          </div>
          {diff !== 0 && (
            <p className="mt-2 text-xs text-slate-500">
              ※ 차액이 있어도 PDF 다운로드는 가능합니다. 정확한 입력을 권장합니다.
            </p>
          )}
        </div>
      </Card>

      {downloadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {downloadError}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onBack} disabled={isDownloading}>
          ← 스토리 수정
        </Button>
        <Button onClick={handleDownload} disabled={isDownloading}>
          {isDownloading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              PDF 생성 중...
            </span>
          ) : (
            "PDF 다운로드"
          )}
        </Button>
      </div>
    </div>
  );
}
