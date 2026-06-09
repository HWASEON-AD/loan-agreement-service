// 랜딩 — 이자 관리 구독 소개 섹션
import React from "react";
import { formatNumber } from "@/lib/interest-calc";
import { SUBSCRIPTION_PRICE } from "@/lib/config";

const BENEFITS = [
  {
    t: "납부일 알림",
    d: "매월 지정한 이자 납부일에 이메일로 자동 알림을 보내드립니다.",
  },
  {
    t: "납부 기록 관리",
    d: "월별 이자 납부 내역을 기록해 대여 사실을 꾸준히 입증합니다.",
  },
  {
    t: "상환 현황 리포트",
    d: "약정 기간 대비 진행률과 납부 현황을 한눈에 확인할 수 있습니다.",
  },
];

export function SubscriptionPromo() {
  return (
    <section className="bg-white py-12 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center">
          <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700">
            이자 관리 구독
          </span>
          <h2 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
            약정 후 이자 관리, 자동으로 해드려요
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-500">
            정기적인 이자 납부와 기록은 가족 간 거래가 증여가 아닌 실제 대여임을
            입증하는 핵심 증거입니다. 매월 자동으로 챙겨드립니다.
          </p>
          <p className="mt-3 text-lg font-bold text-brand-700">
            월 {formatNumber(SUBSCRIPTION_PRICE)}원
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <div
              key={b.t}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
            >
              <h3 className="font-semibold text-brand-700">{b.t}</h3>
              <p className="mt-2 text-sm text-slate-500">{b.d}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">
          이자 관리 구독은 약정서 작성 완료 후 신청할 수 있습니다.
        </p>
      </div>
    </section>
  );
}
