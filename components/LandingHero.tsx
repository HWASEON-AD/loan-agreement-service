// 랜딩 Hero 섹션
"use client";

import React from "react";
import Link from "next/link";
import { Button } from "./ui/Button";
import { Reveal } from "./ui/Reveal";
import { SERVICE_PRICE, SERVICE_PRICE_ORIGINAL } from "@/lib/config";
import { formatNumber } from "@/lib/interest-calc";
import { trackPixelEvent } from "@/components/MetaPixel";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden text-white">
      {/* 배경 이미지 + 가독성용 브랜드 오버레이 */}
      <div className="absolute inset-0">
        <img
          src="/hero-banner.jpg"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-900/85 via-brand-900/75 to-brand-800/80" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-28">
        <Reveal as="span" variant="fade-up" delay={0} className="mb-4 inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-brand-100">
          전자서명 + 우체국 내용증명 풀패키지
        </Reveal>
        <Reveal as="h1" variant="fade-up" delay={100} className="text-3xl font-bold sm:text-5xl" style={{lineHeight: "1.35"}}>
          가족간 금전거래<br />
          자금조달계획서<br />
          한번에! 완벽하게!
        </Reveal>
        <Reveal as="p" variant="fade-up" delay={200} className="mx-auto mt-5 max-w-2xl text-base text-brand-100 sm:text-lg">
          대여약정서 + 전자서명 + 우체국 내용증명
          <br />{" "}
          {SERVICE_PRICE === 0 ? (
            <>
              <span className="font-bold text-white/60 line-through">
                {formatNumber(SERVICE_PRICE_ORIGINAL)}원
              </span>
              {" "}
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-sm font-bold text-white">
                무료 이벤트
              </span>
            </>
          ) : (
            <span className="font-bold text-white">
              단 {formatNumber(SERVICE_PRICE)}원
            </span>
          )}
        </Reveal>
        <Reveal variant="fade-up" delay={300} className="mt-9 flex flex-col items-stretch gap-3 px-2 sm:flex-row sm:items-center sm:justify-center sm:px-0">
          <Link
            href="/create/step/1"
            className="w-full sm:w-auto"
            onClick={() => trackPixelEvent("InitiateCheckout", { content_name: "대여약정서", currency: "KRW", value: SERVICE_PRICE })}
          >
            <button className="w-full inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-brand-700 transition-all hover:bg-slate-100 hover:scale-105 hover:shadow-lg">
              지금 약정서 작성하기
            </button>
          </Link>
          <Link href="/funding-plan" className="w-full sm:w-auto">
            <button className="w-full inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-brand-700 transition-all hover:bg-slate-100 hover:scale-105 hover:shadow-lg">
              자금조달계획서 AI 자동작성
            </button>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

