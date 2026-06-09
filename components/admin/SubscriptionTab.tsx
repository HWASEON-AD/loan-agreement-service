"use client";

// 관리자 — 이자 관리 구독 탭
// - 구독 목록 (구독자, 약정서, 이자금액/월, 상태, 다음납부일)
// - 미납(overdue) 건 강조
// - CSV 다운로드
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/interest-calc";

interface SubRow {
  id: string;
  agreementId: string;
  lenderName: string;
  borrowerName: string;
  email: string;
  phone: string | null;
  status: string;
  billingDay: number;
  interestAmount: number;
  nextDueDate: string;
  createdAt: string;
  overdueCount: number;
  paidCount: number;
  recordCount: number;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "구독중", color: "bg-green-100 text-green-700" },
  paused: { label: "일시정지", color: "bg-yellow-100 text-yellow-700" },
  cancelled: { label: "해지", color: "bg-slate-100 text-slate-500" },
};

function fmtDate(iso: string): string {
  try {
    const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  } catch {
    return iso.slice(0, 10);
  }
}

function csvCell(value: string): string {
  const v = (value ?? "").toString();
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function SubscriptionTab() {
  const router = useRouter();
  const [items, setItems] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/subscriptions", {
        cache: "no-store",
      });
      if (res.status === 401) {
        setError("세션이 만료되었습니다. 다시 로그인해주세요.");
        setTimeout(() => router.push("/admin"), 1500);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "조회 실패");
      setItems(data.subscriptions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((i) => i.status === "active").length,
      overdue: items.filter((i) => i.overdueCount > 0).length,
    }),
    [items]
  );

  const downloadCsv = () => {
    const header = [
      "구독일",
      "대여자",
      "차용자",
      "이메일",
      "연락처",
      "월이자",
      "납부일",
      "상태",
      "다음납부일",
      "미납건수",
    ];
    const lines: string[] = [header.map(csvCell).join(",")];
    for (const i of items) {
      lines.push(
        [
          fmtDate(i.createdAt),
          i.lenderName,
          i.borrowerName,
          i.email,
          i.phone ?? "",
          `${formatNumber(i.interestAmount)}원`,
          `매월 ${i.billingDay}일`,
          STATUS_MAP[i.status]?.label ?? i.status,
          i.nextDueDate,
          String(i.overdueCount),
        ]
          .map(csvCell)
          .join(",")
      );
    }
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const ymd = new Date(Date.now() + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscriptions-${ymd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          전체 <span className="font-semibold text-slate-900">{stats.total}</span>건
          {" · "}구독중{" "}
          <span className="font-semibold text-green-700">{stats.active}</span>건
          {" · "}미납{" "}
          <span className="font-semibold text-red-600">{stats.overdue}</span>건
        </p>
        <Button
          variant="outline"
          onClick={downloadCsv}
          disabled={items.length === 0}
          className="px-4 py-2"
        >
          CSV 다운로드
        </Button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">구독일</th>
              <th className="px-4 py-3">대여자 → 차용자</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3 text-right">월 이자</th>
              <th className="px-4 py-3 text-center">납부일</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-center">다음납부</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  불러오는 중...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  구독 내역이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((i) => {
                const st = STATUS_MAP[i.status] ?? STATUS_MAP.active;
                const overdue = i.overdueCount > 0;
                return (
                  <tr
                    key={i.id}
                    className={`border-b border-slate-100 last:border-0 ${
                      overdue ? "bg-red-50/50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-500">
                      {fmtDate(i.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {i.lenderName} → {i.borrowerName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{i.email}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatNumber(i.interestAmount)}원
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      매월 {i.billingDay}일
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${st.color}`}
                      >
                        {st.label}
                      </span>
                      {overdue && (
                        <span className="ml-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          미납 {i.overdueCount}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {i.nextDueDate}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
