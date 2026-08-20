// 이용약관 페이지 — "본 서비스는 법률 서비스가 아닙니다" 면책 문구 포함
import React from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { SERVICE_NAME } from "@/lib/config";

export const metadata = { title: "이용약관 | / 내지마요" };

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
              {SERVICE_NAME}은 대여약정서 작성 보조, 전자서명, 우체국 내용증명
              발송을 지원하는 문서 서비스입니다. 법률 자문 또는 세무 자문을
              직접 제공하지 않습니다. 세무사 연결 서비스는 이용자와 세무사의
              상담 채널을 연결하는 역할만 수행하며, 세무 상담·신고·세무조사
              대리 등 세무사 고유 업무에 대해 세무사법 관련 규정이 금지하는
              이익이나 금품을 받지 않습니다. 모든 세무 업무는 각 세무사가
              소속 사무소에서 독립적으로 수행합니다.
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

          {/* ★ 계약갱신 문서 만들기 기능 전용 조항.
              목적은 형사 면책이 아니라 ①민사 책임 한정 ②소비자 오인 방지
              ③무상성·비상담성의 사후 입증자료 확보다.
              제7조 ①3호(이용자가 스스로 발송)는 "발송 대행" 기능이 슬쩍 추가되는 것을
              계약 문서 층위에서 막는 앵커이므로 지우지 말 것. */}
          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              제7조 (계약갱신 문서 만들기 서비스의 성격)
            </h2>
            <p>
              ① 회사가 제공하는 &lsquo;계약갱신 서식 만들기&rsquo;(계약갱신 요구 통지서,
              주택임대차계약 갱신 확인서)는 다음 각 호의 기능으로 구성됩니다.
            </p>
            <p className="mt-1 pl-3">
              1. 이용자가 선택한 서식에 이용자가 입력한 정보를 변경 없이 그대로
              배치하여 전자문서 파일을 생성하는 소프트웨어 기능
              <br />
              2. 주택임대차보호법 등 관계 법령의 조문과 공공기관이 공개한 해설을
              출처와 함께 제공하는 정보 제공 기능
              <br />
              3. 이용자가 스스로 우편을 발송할 수 있도록 하는 절차 안내 기능
            </p>
            <p className="mt-2">
              ② 회사는 변호사·법무사 등 법률사무 자격자가 아니며, 본 기능은
              법률상담, 감정, 대리, 문서 작성의 수임 또는 대행이 아닙니다.
              생성되는 문서의 내용은 전적으로 이용자가 결정하고 입력한 것입니다.
            </p>
            <p className="mt-2">
              ③ 본 기능은 <b>무상으로 제공</b>되며, 유료 구독 상품의 제공 내역에
              포함되지 않습니다.
            </p>
            <p className="mt-2">
              ④ 회사는 통지서의 발송을 대행하지 않습니다. 우편·전자우편·문자
              등으로 통지를 보내는 행위는 이용자 본인의 명의와 책임으로
              이루어집니다.
            </p>
            <p className="mt-2">
              ⑤ &lsquo;주택임대차계약 갱신 확인서&rsquo;는 임대인과 임차인이 <b>함께 서명하는
              서식</b>이며, 이미 있었던 사실을 당사자가 확인하여 기록하는 용도입니다. 회사는
              계약갱신 요구가 실제로 있었는지, 그 요구가 법령이 정한 기간 안에 있었는지, 이로써
              계약갱신요구권이 소진되었는지를 <b>판단하지 않으며</b>, 그러한 취지의 문구를 서식에
              자동으로 삽입하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              제8조 (계약갱신 문서 만들기 기능의 책임 한계)
            </h2>
            <p>
              ① 회사는 이용자가 생성한 문서의 법적 효력, 통지의 도달 여부, 권리의
              성립 또는 행사 결과를 보장하지 않습니다.
            </p>
            <p className="mt-2">
              ② 행사기간 계산 기능은 법령이 정한 산식을 기계적으로 적용한 참고
              정보이며, 입력값의 정확성에 대한 책임은 이용자에게 있습니다. 기간의
              역산 방식에 관하여는 해석이 나뉠 수 있으며, 회사는 이용자에게 더
              이른 마감 시점을 기준으로 표시합니다.
            </p>
            <p className="mt-2">
              ③ 회사는 <b>고의 또는 중대한 과실이 있는 경우를 제외하고</b>, 본 조의
              무상 서비스 이용으로 발생한 손해에 대하여 책임을 지지 않습니다.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
