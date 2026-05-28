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
        <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
          가족 간 금전 거래,
          <br />
          이제 법적으로 완벽하게
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-brand-100 sm:text-lg">
          대여약정서 + 전자서명 + 우체국 내용증명 — 단{" "}
          <span className="font-bold text-white">
            {formatNumber(SERVICE_PRICE)}원
          </span>
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/create/step/1">
            <Button variant="white" className="px-8 py-4 text-base">
              지금 약정서 작성하기
            </Button>
          </Link>
          <Link href="#process">
            <Button
              variant="ghost"
              className="px-8 py-4 text-white hover:bg-white/10"
            >
              서비스 알아보기
            </Button>
          </Link>
        </div>
        <div className="mt-4 flex justify-center">
          <Link href="/funding-plan">
            <Button
              variant="ghost"
              className="px-6 py-3 text-sm text-brand-100 underline-offset-4 hover:bg-white/10 hover:underline"
            >
              자금조달계획서 AI 자동작성 →
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
