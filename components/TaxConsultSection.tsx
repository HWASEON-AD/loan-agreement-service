// 세무 전문가 상담 섹션
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { TaxConsultForm } from "./TaxConsultForm";

export function TaxConsultSection() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <section id="tax-consult" className="bg-slate-50 py-12 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">

        {/* 섹션 타이틀 */}
        <div className="mb-12 text-center">
          <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700">
            전문가 세무 상담
          </span>
          <h2 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
            증여세 걱정까지 한번에
          </h2>
          <p className="mt-3 text-slate-500">
            약정서 작성 후 세금 이슈가 걱정되신다면<br />
            전직 용산세무서장 출신 세무 전문가가 직접 검토해드립니다
          </p>
        </div>

        {/* 전문가 카드 — 좌측 약력 / 우측 사진 */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:flex sm:items-stretch">

          {/* 세무사 사진 — 모바일은 원본(세로) 비율로, PC는 카드 높이 꽉 채움 */}
          <div className="mx-auto mt-6 aspect-[3/4] w-full max-w-[280px] shrink-0 overflow-hidden bg-slate-100 sm:mx-0 sm:mt-0 sm:aspect-auto sm:h-auto sm:max-w-none sm:w-[44%]">
            <img
              src="/images/tax-consultant.png"
              alt="협력 세무 전문가"
              className="h-full w-full object-cover object-top"
            />
          </div>

          {/* 약력 (오른쪽) */}
          <div className="flex flex-1 flex-col justify-center p-7 sm:p-10">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">
              협력 세무 전문가
            </div>
            <h3 className="text-2xl font-bold text-slate-900">전직 용산세무서장 출신</h3>
            <p className="mt-1 text-base text-slate-500">국립세무대학 4기 · 국세청 30년 경력</p>

            {/* 주요 약력 */}
            <ul className="mt-6 space-y-2.5">
              {[
                { badge: "핵심", text: "대통령실 파견 근무" },
                { badge: "핵심", text: "전직 용산세무서장 역임" },
                { badge: null, text: "중부지방국세청 조사1국 (세무조사 전담) 2회 근무" },
                { badge: null, text: "중부청 법인세과·송무과 전문" },
                { badge: null, text: "상주·광명·용산 세무서장 역임" },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 shrink-0 text-brand-600">✓</span>
                  <span>
                    {item.badge && (
                      <span className="mr-1.5 rounded bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700">
                        {item.badge}
                      </span>
                    )}
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>

            {/* 버튼 — 가로 나란히 */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="http://pf.kakao.com/_xoNxkxl/chat"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 hover:shadow-md sm:w-auto"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
                세무 상담 신청하기
              </Link>

              {/* 이메일 상담 신청 토글 (폼은 카드 아래 전체 폭으로 펼쳐짐) */}
              <button
                type="button"
                onClick={() => setIsFormOpen((v) => !v)}
                aria-expanded={isFormOpen}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-300 bg-white px-6 py-3 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 sm:w-auto"
              >
                이메일 상담 신청
                <span className={isFormOpen ? "rotate-180" : ""}>▼</span>
              </button>
            </div>
          </div>
        </div>

        {/* 이메일 상담 폼 — 카드 아래 전체 폭으로 펼쳐짐 */}
        <TaxConsultForm isOpen={isFormOpen} />

        {/* 하단 키워드 뱃지 */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {["가족간 차용증 세무 검토", "증여세 절세 전략", "자금조달계획서 세무 리스크", "세무조사 대응", "법인세·소득세 상담"].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500"
            >
              {tag}
            </span>
          ))}
        </div>

      </div>
    </section>
  );
}
