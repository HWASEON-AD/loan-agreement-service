// 대시보드 상태 배지 — dashboardStatus 를 한글 라벨 + 색상 배지로 표시
import React from "react";

export type DashboardStatus = "pending" | "signed" | "expired";

interface StatusBadgeProps {
  status: DashboardStatus;
  size?: "sm" | "md"; // 기본 md
}

// 상태별 라벨 + 색상 매핑 (기획서 7-5)
const STATUS_MAP: Record<
  DashboardStatus,
  { label: string; color: string }
> = {
  pending: { label: "서명대기", color: "bg-yellow-100 text-yellow-700" },
  signed: { label: "서명완료", color: "bg-green-100 text-green-700" },
  expired: { label: "만료", color: "bg-slate-100 text-slate-500" },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const { label, color } = STATUS_MAP[status];
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-block rounded-full font-medium ${sizeClass} ${color}`}
    >
      {label}
    </span>
  );
}
