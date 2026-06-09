"use client";

// 관리자 대시보드 상단 탭 — 약정서 관리 / 세무상담 신청 전환
import React, { useState } from "react";
import { DashboardTable } from "./DashboardTable";
import { TaxConsultTab } from "./TaxConsultTab";
import { SubscriptionTab } from "./SubscriptionTab";

type Tab = "agreements" | "tax-consult" | "subscriptions";

const TABS: { key: Tab; label: string }[] = [
  { key: "agreements", label: "약정서 관리" },
  { key: "tax-consult", label: "세무상담 신청" },
  { key: "subscriptions", label: "구독 관리" },
];

export function DashboardTabs() {
  const [tab, setTab] = useState<Tab>("agreements");

  return (
    <div>
      {/* 상단 탭 */}
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-brand-700 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "agreements" ? (
        <DashboardTable />
      ) : tab === "tax-consult" ? (
        <TaxConsultTab />
      ) : (
        <SubscriptionTab />
      )}
    </div>
  );
}
