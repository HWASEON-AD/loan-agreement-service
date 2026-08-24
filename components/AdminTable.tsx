"use client";

// 관리자 주문 목록 테이블 (필터 + 상태변경 + 발송완료 마킹)
import React, { useEffect, useState, useCallback } from "react";
import { Button } from "./ui/Button";
import { formatNumber } from "@/lib/interest-calc";

interface SignatureSummary {
  signerType: string;
  signerName: string;
  signedAt: string;
  ipAddress: string;
}

interface OrderRow {
  orderId: string;
  agreementId: string;
  createdAt: string;
  lenderName: string;
  borrowerName: string;
  amount: number;
  servicePrice: number;
  agreementStatus: string;
  lenderSigned: boolean;
  borrowerSigned: boolean;
  paymentStatus: string;
  certMailStatus: string;
  certMailSentAt: string | null;
  // 상세 정보
  lenderEmail: string;
  lenderPhone: string;
  borrowerEmail: string;
  borrowerPhone: string;
  signatures: SignatureSummary[];
}

interface Stats {
  total: number;
  waitingSign: number;
  waitingMail: number;
  monthRevenue: number;
}

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "paid", label: "결제완료" },
  { key: "pending", label: "발송대기" },
  { key: "sent", label: "발송완료" },
];

// 상태 → 한글 배지
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "작성중",
    lender_signed: "대여자서명",
    borrower_signed: "차용자서명",
    paid: "결제완료",
    processing: "처리중",
    completed: "완료",
    cancelled: "취소",
    pending: "대기",
    sent: "발송완료",
    failed: "실패",
  };
  const color =
    status === "completed" || status === "sent" || status === "paid"
      ? "bg-green-100 text-green-700"
      : status === "failed" || status === "cancelled"
        ? "bg-red-100 text-red-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {map[status] ?? status}
    </span>
  );
}

export function AdminTable() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // 날짜 범위 필터 (클라이언트 사이드)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // 상세 펼침 행 (열린 orderId)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 주문 목록 로드
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders?status=${filter}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        setError("세션이 만료되었습니다. 다시 로그인해주세요.");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "조회 실패");
      setRows(data.orders);
      setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 중 오류");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // 접수일(createdAt) 기준 날짜 범위 필터 — 클라이언트 사이드
  const visibleRows = rows.filter((r) => {
    const day = r.createdAt.slice(0, 10); // YYYY-MM-DD
    if (startDate && day < startDate) return false;
    if (endDate && day > endDate) return false;
    return true;
  });

  // 발송 완료 마킹
  const markSent = async (orderId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/mark-sent`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      alert("발송 완료 처리에 실패했습니다.");
    }
  };

  // CSV 다운로드
  const downloadCsv = () => {
    window.location.href = "/api/admin/orders/csv";
  };

  return (
    <div>
      {/* 통계 카드 */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="전체 주문" value={`${stats.total}건`} />
          <StatCard label="서명 대기" value={`${stats.waitingSign}건`} />
          <StatCard label="내용증명 발송 대기" value={`${stats.waitingMail}건`} />
          <StatCard
            label="결제 매출"
            value={`${formatNumber(stats.monthRevenue)}원`}
          />
        </div>
      )}

      {/* 필터 + CSV */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-brand-700 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={downloadCsv}>
          내용증명 CSV 다운로드
        </Button>
      </div>

      {/* 날짜 범위 필터 */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            시작일
          </label>
          <input
            type="date"
            min="1900-01-01"
            value={startDate}
            max={endDate || "2999-12-31"}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          />
        </div>
        <span className="pb-1.5 text-slate-400">~</span>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            종료일
          </label>
          <input
            type="date"
            max="2999-12-31"
            value={endDate}
            min={startDate || "1900-01-01"}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          />
        </div>
        <button
          onClick={() => {
            setStartDate("");
            setEndDate("");
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          초기화
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">접수일</th>
              <th className="px-4 py-3">대여자</th>
              <th className="px-4 py-3">차용자</th>
              <th className="px-4 py-3">금액</th>
              <th className="px-4 py-3">서명</th>
              <th className="px-4 py-3">결제</th>
              <th className="px-4 py-3">발송</th>
              <th className="px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  불러오는 중...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  주문이 없습니다.
                </td>
              </tr>
            ) : (
              visibleRows.map((r) => (
                <React.Fragment key={r.orderId}>
                  <tr
                    onClick={() =>
                      setExpandedId(expandedId === r.orderId ? null : r.orderId)
                    }
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-slate-500">
                      <span className="mr-1.5 inline-block text-slate-400">
                        {expandedId === r.orderId ? "▾" : "▸"}
                      </span>
                      {r.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.lenderName}</td>
                    <td className="px-4 py-3 font-medium">{r.borrowerName}</td>
                    <td className="px-4 py-3">{formatNumber(r.amount)}원</td>
                    <td className="px-4 py-3 text-xs">
                      {r.lenderSigned ? "갑✓" : "갑·"}{" "}
                      {r.borrowerSigned ? "을✓" : "을·"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.paymentStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.certMailStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={`/api/agreements/${r.agreementId}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          PDF
                        </a>
                        {r.paymentStatus === "paid" &&
                          r.certMailStatus !== "sent" && (
                            <button
                              onClick={() => markSent(r.orderId)}
                              className="rounded-lg bg-brand-700 px-2.5 py-1 text-xs text-white hover:bg-brand-800"
                            >
                              발송완료
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                  {/* 상세 펼침 행 (accordion) */}
                  {expandedId === r.orderId && (
                    <tr className="bg-slate-50">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                          {/* 대여자 */}
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
                              대여자(갑)
                            </p>
                            <p className="text-sm font-medium text-slate-800">
                              {r.lenderName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {r.lenderEmail}
                            </p>
                            <p className="text-xs text-slate-500">
                              {r.lenderPhone}
                            </p>
                          </div>
                          {/* 차용자 */}
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
                              차용자(을)
                            </p>
                            <p className="text-sm font-medium text-slate-800">
                              {r.borrowerName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {r.borrowerEmail}
                            </p>
                            <p className="text-xs text-slate-500">
                              {r.borrowerPhone}
                            </p>
                          </div>
                          {/* 문서 + 서명 감사로그 */}
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
                              문서 / 서명 기록
                            </p>
                            <a
                              href={`/api/agreements/${r.agreementId}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block text-sm font-medium text-brand-700 underline"
                            >
                              PDF 다운로드
                            </a>
                            <div className="mt-2 space-y-1">
                              {r.signatures.length === 0 ? (
                                <p className="text-xs text-slate-400">
                                  서명 기록 없음
                                </p>
                              ) : (
                                r.signatures.map((s, i) => (
                                  <p key={i} className="text-xs text-slate-500">
                                    {s.signerType === "lender" ? "갑" : "을"}{" "}
                                    {s.signerName} —{" "}
                                    {new Date(s.signedAt).toLocaleString("ko-KR")}{" "}
                                    (IP {s.ipAddress})
                                  </p>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
