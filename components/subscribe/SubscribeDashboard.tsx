"use client";

// 이자 관리 현황 (구독자 전용)
// - 약정서 정보 요약
// - 이자 납부 현황 테이블 (월별, 납부일, 금액, 상태)
// - 각 행 "납부 완료" 버튼 → PATCH
// - 상환 진행률 프로그레스바 (총 기간 대비 경과 %)
import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatNumber } from "@/lib/interest-calc";
import type { InterestRecord, Subscription } from "@/lib/types";

interface AgreementSummary {
  lenderName: string;
  borrowerName: string;
  amount: number;
  interestRate: number;
  startDate: string;
  endDate: string;
}

interface Props {
  agreementId: string;
  token: string;
  subscriptionId: string;
  agreement: AgreementSummary;
}

// 상태 뱃지
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "납부 대기", color: "bg-yellow-100 text-yellow-700" },
  paid: { label: "납부 완료", color: "bg-green-100 text-green-700" },
  overdue: { label: "연체", color: "bg-red-100 text-red-700" },
};

// 경과율 계산 (start~end 대비 오늘 위치, 0~100)
function calcProgress(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  const now = Date.now();
  if (end <= start) return 0;
  const pct = ((now - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function SubscribeDashboard({
  agreementId,
  token,
  subscriptionId,
  agreement,
}: Props) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [records, setRecords] = useState<InterestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/subscriptions/${subscriptionId}/records?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "조회 실패");
      setSubscription(data.subscription ?? null);
      setRecords(data.records ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [subscriptionId, token]);

  useEffect(() => {
    load();
  }, [load]);

  // 납부 완료 처리
  const markPaid = async (recordId: string) => {
    setPaying(recordId);
    setError("");
    try {
      const res = await fetch(`/api/subscriptions/${subscriptionId}/records`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, recordId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "처리 실패");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "납부 처리에 실패했습니다.");
    } finally {
      setPaying(null);
    }
  };

  const progress = calcProgress(agreement.startDate, agreement.endDate);
  const paidCount = records.filter((r) => r.status === "paid").length;

  return (
    <div className="space-y-5">
      {/* 약정서 요약 */}
      <Card>
        <h3 className="mb-3 font-semibold text-slate-900">약정서 정보</h3>
        <dl className="space-y-2 text-sm">
          <Row label="대여자" value={agreement.lenderName} />
          <Row label="차용자" value={agreement.borrowerName} />
          <Row label="대여 금액" value={`${formatNumber(agreement.amount)}원`} />
          <Row
            label="이자율"
            value={`연 ${(agreement.interestRate * 100).toFixed(1)}%`}
          />
          <Row
            label="약정 기간"
            value={`${agreement.startDate} ~ ${agreement.endDate}`}
          />
          {subscription && (
            <Row
              label="다음 납부일"
              value={subscription.nextDueDate}
            />
          )}
        </dl>
      </Card>

      {/* 상환 진행률 */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">상환 진행률</h3>
          <span className="text-sm font-medium text-brand-700">{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          약정 기간 경과 기준 · 납부 완료 {paidCount}회
        </p>
      </Card>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      {/* 이자 납부 현황 테이블 */}
      <Card>
        <h3 className="mb-3 font-semibold text-slate-900">이자 납부 현황</h3>
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">
            불러오는 중...
          </p>
        ) : records.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            납부 기록이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2">납부일</th>
                  <th className="px-2 py-2 text-right">금액</th>
                  <th className="px-2 py-2 text-center">상태</th>
                  <th className="px-2 py-2 text-center">처리</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const st = STATUS_MAP[r.status] ?? STATUS_MAP.pending;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-2 py-2.5 text-slate-700">
                        {r.dueDate}
                        {r.paidDate && (
                          <span className="ml-1 text-xs text-slate-400">
                            (납부 {r.paidDate})
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                        {formatNumber(r.amount)}원
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${st.color}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {r.status === "paid" ? (
                          <span className="text-xs text-slate-400">완료</span>
                        ) : (
                          <button
                            onClick={() => markPaid(r.id)}
                            disabled={paying === r.id}
                            className="rounded-lg border border-brand-300 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                          >
                            {paying === r.id ? "처리 중..." : "납부 완료"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
