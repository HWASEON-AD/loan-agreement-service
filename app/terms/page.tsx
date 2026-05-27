// 이용약관 페이지 — "본 서비스는 법률 서비스가 아닙니다" 면책 문구 포함
import React from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { SERVICE_NAME } from "@/lib/config";

export const metadata = { title: "이용약관 | 가족대여닷컴" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-brand-700 hover:underline">
          ← 홈으로
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">이용약관</h1>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              제1조 (서비스의 성격)
            </h2>
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 font-medium text-amber-900">
              본 서비스는 법률 서비스가 아니며, 변호사법에 따른 법률 자문이나
              소송 대리를 제공하지 않습니다. {SERVICE_NAME}은 이용자가 직접
              입력한 정보를 바탕으로 문서 양식을 생성하고, 전자서명 및 우체국
              내용증명 발송을 보조하는 서비스를 제공합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              제2조 (제공 서비스)
            </h2>
            <p>
              ① 대여약정서 양식 작성 ② 이메일 본인인증 기반 전자서명 ③ 우체국
              내용증명 발송 대행 ④ 서명 감사로그 및 문서 보관을 제공합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              제3조 (이용자의 책임)
            </h2>
            <p>
              이용자는 입력한 정보의 정확성에 대한 책임을 부담합니다. 본
              서비스가 제공하는 문서 양식은 일반적인 참고용이며, 구체적인 법률
              효력 및 분쟁 발생 시의 대응은 전문가와 별도로 상담하시기 바랍니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              제4조 (확정일자 안내)
            </h2>
            <p>
              본 서비스는 확정일자 부여를 대행하지 않습니다. 확정일자가 필요한
              경우 인터넷등기소(iros.go.kr)에서 직접 신청하실 수 있도록 안내만
              제공합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              제5조 (결제 및 환불)
            </h2>
            <p>
              결제는 &ldquo;대여약정서 작성 및 내용증명 발송 서비스&rdquo;
              명목으로 이루어집니다. 내용증명이 발송되기 전에는 환불이 가능하며,
              발송 이후에는 환불이 제한될 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              제6조 (책임의 한계)
            </h2>
            <p>
              {SERVICE_NAME}은 이용자가 작성한 약정 내용의 법적 유효성이나
              상대방의 이행을 보증하지 않습니다.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
