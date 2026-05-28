"use client";

// 약정서 목록 테이블 + 필터 탭 + 상세 모달 제어 (클라이언트)
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/interest-calc";
import type { AgreementStatus } from "@/lib/types";
import {
  DashboardStats,
  type DashboardStats as DashboardStatsData,
} from "./DashboardStats";
import { StatusBadge, type DashboardStatus } from "./StatusBadge";
import { AgreementModal } from "./AgreementModal";

// 목록 행 단위 데이터 (API 응답 구조와 일치)
interface AgreementRow {
  id: string;
  createdAt: string;
  lenderName: string;
  borrowerName: string;
  amount: number;
  status: AgreementStatus;
  dashboardStatus: DashboardStatus;
  lenderSigned: boolean;
  borrowerSigned: boolean;
  endDate: string;
  lenderSignToken: string;
  borrowerSignToken: string;
}

interface DashboardResponse {
  agreements: AgreementRow[];
  stats: DashboardStatsData;
}

type FilterKey = "all" | "pending" | "signed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "서명대기" },
  { key: "signed", label: "서명완료" },
];

export function DashboardTable() {
  const router = useRouter();
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 연속 탭 클릭 race condition 방지용
  const abortRef = useRef<AbortController | null>(null);

  // 약정서 목록 로드
  const load = useCallback(
    async (status: FilterKey) => {
      // 이전 요청 취소
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/agreements?status=${status}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (res.status === 401) {
          setError("세션이 만료되었습니다. 다시 로그인해주세요.");
          // 잠시 후 로그인 페이지로 이동
          setTimeout(() => router.push("/admin"), 1500);
          return;
        }
        const data: DashboardResponse & { error?: string } = await res.json();
        if (!res.ok) throw new Error(data.error || "조회 실패");
        setAgreements(data.agreements);
        setStats(data.stats);
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // 취소는 무시
        setError(e instanceof Error ? e.message : "서버 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  // 각 탭 건수 계산 (전체 기준 통계가 있을 때만 정확)
  // 탭 건수는 항상 전체 통계 기준으로 표시 (필터링과 무관)
  const tabCounts: Record<FilterKey, number | null> = {
    all: stats ? stats.total : null,
    pending: stats ? stats.pendingCount : null,
    signed: stats ? stats.signedCount : null,
  };

  return (
    <div>
      {/* 요약 카드 (항상 전체 기준) */}
      <DashboardStats
        stats={
          stats ?? {
            total: 0,
            signedCount: 0,
            pendingCount: 0,
            todayCount: 0,
            totalAmount: 0,
          }
        }
        loading={loading && !stats}
      />

      {/* 필터 탭 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = tabCounts[f.key];
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              disabled={loading}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? "bg-brand-700 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f.label}
              {count !== null && (
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    active ? "bg-white/20" : "bg-slate-100"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* 데스크톱 테이블 (md 이상) */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">생성일</th>
              <th className="px-4 py-3">채권자</th>
              <th className="px-4 py-3">채무자</th>
              <th className="px-4 py-3 text-right">금액</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-center">상세</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  불러오는 중...
                </td>
              </tr>
            ) : agreements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  약정서가 없습니다.
                </td>
              </tr>
            ) : (
              agreements.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-500">
                    {r.createdAt.slice(5, 10)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {r.lenderName}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {r.borrowerName}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(r.amount)}원
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={r.dashboardStatus} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelectedId(r.id)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      보기
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 리스트 (md 미만) */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-400">
            불러오는 중...
          </div>
        ) : agreements.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-400">
            약정서가 없습니다.
          </div>
        ) : (
          agreements.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {r.createdAt.slice(0, 10)}
                </span>
                <StatusBadge status={r.dashboardStatus} size="sm" />
              </div>
              <p className="text-sm font-medium text-slate-800">
                {r.lenderName}
                <span className="mx-1.5 text-slate-400">→</span>
                {r.borrowerName}
              </p>
              <p className="mt-1 text-sm tabular-nums text-slate-600">
                {formatNumber(r.amount)}원
              </p>
              <button
                onClick={() => setSelectedId(r.id)}
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                상세 보기
              </button>
            </div>
          ))
        )}
      </div>

      {/* 상세 모달 */}
      {selectedId && (
        <AgreementModal
          agreementId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
