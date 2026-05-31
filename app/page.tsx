// 랜딩 페이지 (/)
import React from "react";
import { LandingHero } from "@/components/LandingHero";
import { ProcessSteps } from "@/components/ProcessSteps";
import { PriceCard } from "@/components/PriceCard";
import { TaxConsultSection } from "@/components/TaxConsultSection";
import { Footer } from "@/components/Footer";

// 문제 제기 섹션
function ProblemSection() {
  return (
    <section className="bg-slate-50 py-12 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          &ldquo;가족 사이라 그냥 빌려줬다가 나중에...&rdquo;
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-slate-500">
          가족 간 금전 거래는 기록이 없으면 분쟁이나 조사 상황에서 사실 관계를
          입증하기 어렵습니다. 객관적인 증거가 필요합니다.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            {
              t: "약정 사실 증거",
              d: "언제, 얼마를, 어떤 조건으로 빌려줬는지 명시된 서면 약정서",
            },
            {
              t: "당사자 합의 증거",
              d: "양 당사자가 직접 서명한 전자서명 + 본인인증 기록",
            },
            {
              t: "객관적 발송 증거",
              d: "우체국이 내용과 날짜를 증명하는 내용증명 우편",
            },
          ].map((c) => (
            <div
              key={c.t}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <h3 className="font-semibold text-brand-700">{c.t}</h3>
              <p className="mt-2 text-sm text-slate-500">{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 법적 효력 안내 섹션
function LegalEffectSection() {
  return (
    <section className="bg-white py-12 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          법적 효력 안내
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6">
            <h3 className="font-semibold text-brand-800">전자서명의 효력</h3>
            <p className="mt-2 text-sm text-brand-900/80">
              전자문서 및 전자거래 기본법에 따라, 본인인증(이메일 OTP)을 거친
              전자서명은 서명자의 의사 표시 증거로 활용될 수 있습니다. 서명 시각,
              IP, 기기 정보, 문서 해시가 감사로그로 기록됩니다.
            </p>
            <p className="mt-3 rounded-lg bg-white/60 p-3 text-xs leading-relaxed text-brand-900/80">
              전자서명법 제3조(전자서명의 효력): 당사자 간 합의에 따라 선택된
              전자서명은 서면 서명과 동일한 효력을 가집니다.
            </p>
          </div>
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6">
            <h3 className="font-semibold text-brand-800">
              우체국 내용증명의 의미
            </h3>
            <p className="mt-2 text-sm text-brand-900/80">
              내용증명은 우체국이 &ldquo;어떤 내용의 문서를, 언제, 누구에게
              발송했는지&rdquo;를 공적으로 증명하는 제도입니다. 발송 사실과 내용,
              일자에 대한 객관적 증거가 됩니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// FAQ 섹션
const FAQS = [
  {
    q: "서비스 비용은 얼마인가요?",
    a: "기본 패키지는 건당 30,000원입니다. 약정서 작성, 양 당사자 전자서명, 우체국 내용증명 2부 발송이 포함됩니다.",
  },
  {
    q: "주민등록번호를 입력해야 하나요?",
    a: "아니요. 본 서비스는 주민등록번호를 수집하지 않습니다. 생년월일 6자리만 입력하시면 됩니다.",
  },
  {
    q: "무이자로 빌려줘도 되나요?",
    a: "대여 금액이 일정 한도(약 2억 1,739만원) 이하라면 무이자로 약정할 수 있으며, 한도를 넘으면 연 4.6%의 이자율이 자동 안내됩니다.",
  },
  {
    q: "전자서명만으로 법적 효력이 있나요?",
    a: "본인인증을 거친 전자서명은 의사 표시의 증거로 활용될 수 있습니다. 여기에 우체국 내용증명을 더해 더욱 객관적인 증거 세트를 완성합니다.",
  },
  {
    q: "확정일자도 받아주나요?",
    a: "네. 우체국 내용증명 자체에 확정일자가 포함됩니다. 우체국은 법적으로 확정일자 부여 기관이며, 내용증명 발송 시 우체국이 날짜를 공식 증명하므로 별도 확정일자 신청이 필요 없습니다.",
  },
  {
    q: "상대방이 멀리 있어도 서명할 수 있나요?",
    a: "네. 차용자에게 이메일로 서명 요청 링크를 보내드리므로, 비대면으로 각자 서명할 수 있습니다.",
  },
  {
    q: "서명한 약정서는 어떻게 받나요?",
    a: "양 당사자 서명과 결제가 완료되면 PDF로 생성되어 다운로드할 수 있고, 이메일로도 안내해 드립니다.",
  },
  {
    q: "내용증명은 언제 발송되나요?",
    a: "결제 완료 후 영업일 기준 2~3일 이내에 우체국 내용증명으로 발송됩니다.",
  },
  {
    q: "분할상환도 약정할 수 있나요?",
    a: "네. 만기 일시상환과 분할상환 중 선택하실 수 있습니다.",
  },
  {
    q: "본 서비스는 법률 자문인가요?",
    a: "아닙니다. 본 서비스는 법률 서비스가 아니며, 문서 양식 작성과 발송을 돕는 서비스입니다. 구체적인 법률 사안은 전문가와 상담하시기 바랍니다.",
  },
];

function FaqSection() {
  return (
    <section className="bg-slate-50 py-12 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          자주 묻는 질문
        </h2>
        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => (
            <details
              key={i}
              className="group rounded-xl border border-slate-200 bg-white p-5"
            >
              <summary className="cursor-pointer list-none font-medium text-slate-800">
                Q. {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <main>
      <LandingHero />
      <ProblemSection />
      <ProcessSteps />
      <PriceCard />
      <TaxConsultSection />
      <LegalEffectSection />
      <FaqSection />
      <Footer />
    </main>
  );
}
