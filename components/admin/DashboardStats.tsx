"use client";

// 대시보드 요약 카드 4종 — 전체/서명완료/오늘생성/총대여금액
import React from "react";

export interface DashboardStats {
  total: number; // 전체 약정서 수
  signedCount: number; // 서명완료 수
  pendingCount: number; // 서명대기 수 (만료 제외)
  todayCount: number; // 오늘 생성 수
  totalAmount: number; // 총 대여금액 합계 (원)
}

interface DashboardStatsProps {
  stats: DashboardStats;
  loading?: boolean;
}

// 금액 → 억/만원 단위 한국식 포맷 (기획서 12장)
function formatAmount(won: number): string {
  if (won >= 100000000) {
    const eok = Math.floor(won / 100000000);
    const man = Math.floor((won % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man.toLocaleString("ko-KR")}만원` : `${eok}억원`;
  }
  if (won >= 10000) {
    return `${Math.floor(won / 10000).toLocaleString("ko-KR")}만원`;
  }
  return `${won.toLocaleString("ko-KR")}원`;
}

// 카드 1개 렌더
function StatCard({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: string;
  accent: string; // 숫자 색상 클래스
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-20 animate-pulse rounded bg-slate-200" />
      ) : (
        <p className={`mt-1 text-2xl font-bold sm:text-3xl ${accent}`}>{value}</p>
      )}
    </div>
  );
}

export function DashboardStats({ stats, loading }: DashboardStatsProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label="전체 약정서"
        value={`${stats.total}건`}
        accent="text-slate-900"
        loading={loading}
      />
      <StatCard
        label="서명완료"
        value={`${stats.signedCount}건`}
        accent="text-green-600"
        loading={loading}
      />
      <StatCard
        label="오늘 생성"
        value={`${stats.todayCount}건`}
        accent="text-blue-600"
        loading={loading}
      />
      <StatCard
        label="총 대여금액"
        value={formatAmount(stats.totalAmount)}
        accent="text-indigo-600"
        loading={loading}
      />
    </div>
  );
}
