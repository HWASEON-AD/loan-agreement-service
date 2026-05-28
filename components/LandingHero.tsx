// 랜딩 Hero 섹션
import React from "react";
import Link from "next/link";
import { Button } from "./ui/Button";
import { SERVICE_PRICE } from "@/lib/config";
import { formatNumber } from "@/lib/interest-calc";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-900 to-brand-700 text-white">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center sm:py-28">
        <span className="mb-4 inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-brand-100">
          전자서명 + 우체국 내용증명 풀패키지
        </span>
        <h1 className="text-3xl font-bold sm:text-5xl" style={{lineHeight: "1.35"}}>
          가족간 금전거래<br />
          자금조달계획서<br />
          한번에! 완벽하게!
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-brand-100 sm:text-lg">
          대여약정서 + 전자서명 + 우체국 내용증명 — 단{" "}
          <span className="font-bold text-white">
            {formatNumber(SERVICE_PRICE)}원
          </span>
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/create/step/1">
            <button className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-brand-700 transition-all hover:bg-slate-100 hover:scale-105 hover:shadow-lg">
              지금 약정서 작성하기
            </button>
          </Link>
          <Link href="/funding-plan">
            <button className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-brand-700 transition-all hover:bg-slate-100 hover:scale-105 hover:shadow-lg">
              자금조달계획서 AI 자동작성
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
