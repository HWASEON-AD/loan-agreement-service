// 자금조달계획서 AI 자동작성 (3단계 위자드)
import React from "react";
import type { Metadata } from "next";
import { FundingWizard } from "@/components/funding/FundingWizard";
import { LegalNotice } from "@/components/ui/LegalNotice";

export const metadata: Metadata = {
  title: "자금조달계획서 AI 자동작성 | 내지마요",
  description:
    "자금 조달 상황을 말로 설명하면 AI가 자동으로 서식을 채워드립니다. 주택 · 토지 취득자금 조달계획서를 5분 안에.",
};

export default function FundingPlanPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            자금조달계획서 AI 자동작성
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            자금 조달 상황을 자연어로 말씀해 주시면, AI가 항목을 분류해
            금융위원회 공식 서식 양식으로 채워드립니다.
          </p>
        </div>

        {/* 위자드 */}
        <FundingWizard />

        {/* 면책 안내 */}
        <div className="mt-10">
          <LegalNotice tone="info" title="안내">
            <p className="text-sm leading-relaxed">
              본 서비스는 입력하신 내용만 서식에 기재합니다. AI가 수치를
              임의로 생성하지 않으며, 추출된 항목은 자유롭게 수정할 수
              있습니다. 본 서비스는 법률 자문이 아니며, 작성된 문서의 법적
              효력은 사용자가 직접 검토하셔야 합니다.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              ※ 주민등록번호 뒷자리는 PDF 생성에만 사용되며, 서버에 저장되지
              않습니다.
            </p>
          </LegalNotice>
        </div>
      </div>
    </main>
  );
}
