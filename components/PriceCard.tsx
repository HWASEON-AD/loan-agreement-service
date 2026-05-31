// 가격 카드 섹션
import React from "react";
import Link from "next/link";
import { Button } from "./ui/Button";
import { SERVICE_PRICE, SERVICE_PRICE_ORIGINAL, SUBSCRIPTION_PRICE } from "@/lib/config";
import { formatNumber } from "@/lib/interest-calc";

export function PriceCard() {
  return (
    <section className="bg-slate-50 py-12 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          합리적인 가격
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {/* 기본 패키지 */}
          <div className="rounded-2xl border-2 border-brand-600 bg-white p-7 shadow-md">
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
                기본 패키지
              </span>
              {SERVICE_PRICE === 0 && (
                <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
                  무료 이벤트
                </span>
              )}
            </div>
            <div className="mt-4 flex items-end gap-2">
              {SERVICE_PRICE === 0 ? (
                <>
                  <span className="text-4xl font-bold text-slate-900">0</span>
                  <span className="mb-1 text-slate-500">원 / 건</span>
                  <span className="mb-1 text-sm text-slate-400 line-through">
                    (정가 {formatNumber(SERVICE_PRICE_ORIGINAL)}원)
                  </span>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold text-slate-900">
                    {formatNumber(SERVICE_PRICE)}
                  </span>
                  <span className="mb-1 text-slate-500">원 / 건</span>
                </>
              )}
            </div>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              <li>✓ 대여약정서 작성</li>
              <li>✓ 양 당사자 전자서명 (이메일 OTP 인증)</li>
              <li>✓ 우체국 내용증명 2부 발송</li>
              <li>✓ 서명 감사로그 + PDF 보관</li>
            </ul>
            <Link href="/create/step/1" className="mt-6 block">
              <Button fullWidth>약정서 작성 시작</Button>
            </Link>
          </div>

          {/* 이자 관리 구독 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-7">
            <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              옵션 · 이자 관리 구독
            </span>
            <div className="mt-4 flex items-end gap-1">
              <span className="text-4xl font-bold text-slate-900">
                {formatNumber(SUBSCRIPTION_PRICE)}
              </span>
              <span className="mb-1 text-slate-500">원 / 월</span>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              <li>✓ 매월 이자 납부일 알림</li>
              <li>✓ 입금 내역 기록 관리</li>
              <li>✓ 상환 진행 현황 리포트</li>
            </ul>
            <Button variant="outline" fullWidth className="mt-6" disabled>
              준비 중
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
