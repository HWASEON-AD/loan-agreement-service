// 세무 전문가 상담 섹션
import React from "react";
import Link from "next/link";
import { TaxConsultForm } from "./TaxConsultForm";

export function TaxConsultSection() {
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

        {/* 전문가 카드 */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:flex">

          {/* 세무사 사진 */}
          <div className="flex shrink-0 items-center justify-center overflow-hidden bg-slate-100 sm:w-52">
            <img
              src="/images/tax-consultant.png"
              alt="협력 세무 전문가"
              className="h-52 w-full object-cover object-top sm:h-full"
            />
          </div>

          {/* 약력 */}
          <div className="flex flex-1 flex-col justify-center p-8">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">
              협력 세무 전문가
            </div>
            <h3 className="text-xl font-bold text-slate-900">전직 용산세무서장 출신</h3>
            <p className="mt-1 text-sm font-medium text-slate-700">
              국세청 30년 경력의 세무전문가입니다.<br />
              조사, 상속, 증여를 전문으로 하고 있습니다.<br />
              <span className="text-brand-700 font-semibold">세무는 아이디어 싸움입니다.</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-400">국립세무대학 4기</p>

            {/* 주요 약력 */}
            <ul className="mt-5 space-y-2">
              {[
                { badge: "핵심", text: "대통령실 파견 근무" },
                { badge: "핵심", text: "전직 용산세무서장 역임" },
                { badge: null, text: "중부지방국세청 조사1국 (세무조사 전담) 2회 근무" },
                { badge: null, text: "중부청 법인세과·송무과 전문" },
                { badge: null, text: "상주·광명·용산 세무서장 역임" },
                { badge: null, text: "관악·남산·서대문·광화문 세무서 근무" },
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

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="http://pf.kakao.com/_xoNxkxl/chat"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800 sm:w-auto"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
                세무 상담 신청하기
              </Link>
              <div className="flex items-center text-xs text-slate-400">
                초기 상담 무료 · 카카오 채널 연결
              </div>
            </div>

            {/* 이메일 상담 신청 폼 (접이식) */}
            <TaxConsultForm />
          </div>
        </div>

        {/* 수수료 없음 안내 */}
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-5 py-3 text-sm text-brand-800">
          <svg className="h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>
            <strong>초기 상담 시 어떠한 수수료도 받지 않습니다.</strong>
            &nbsp;상담 후 진행 여부는 고객님이 결정하세요.
          </span>
        </div>

        {/* 하단 키워드 뱃지 */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
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
