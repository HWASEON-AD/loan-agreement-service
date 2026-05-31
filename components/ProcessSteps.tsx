// 서비스 프로세스 5단계 섹션
import React from "react";

const STEPS = [
  {
    n: 1,
    title: "금액·조건 입력",
    desc: "대여 금액과 기간을 입력하면 적정 이자율이 자동 계산됩니다.",
  },
  {
    n: 2,
    title: "당사자 정보 입력",
    desc: "대여자·차용자 정보를 입력합니다. (주민번호 수집 없음)",
  },
  {
    n: 3,
    title: "전자서명",
    desc: "이메일 인증 후 양 당사자가 전자서명을 진행합니다.",
  },
  {
    n: 4,
    title: "우체국 내용증명",
    desc: "서명된 약정서를 우체국 내용증명으로 발송 접수합니다.",
  },
  {
    n: 5,
    title: "법적 효력 완성",
    desc: "전자서명 + 내용증명으로 객관적 증거가 완성됩니다.",
  },
];

export function ProcessSteps() {
  return (
    <section id="process" className="bg-white py-12 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          전자서명 → 우체국 내용증명 → 법적효력 완성
        </h2>
        <p className="mt-3 text-center text-slate-500">
          단 5단계로 끝나는 안전한 금전 거래 증거 만들기
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center"
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-lg font-bold text-white">
                {s.n}
              </div>
              <h3 className="font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
