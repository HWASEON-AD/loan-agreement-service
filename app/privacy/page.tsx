// 개인정보처리방침 페이지
import React from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { SERVICE_NAME } from "@/lib/config";

export const metadata = { title: "개인정보처리방침 | / 내지마요" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-brand-700 hover:underline">
          ← 홈으로
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          개인정보처리방침
        </h1>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              1. 수집하는 개인정보 항목
            </h2>
            <p className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-brand-900">
              {SERVICE_NAME}은 <b>주민등록번호를 수집하지 않습니다.</b> 약정서
              작성에 필요한 최소한의 정보(성명, 생년월일 6자리, 휴대폰 번호,
              이메일, 주소)만을 수집합니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              2. 개인정보의 이용 목적
            </h2>
            <p>
              수집된 정보는 대여약정서 작성, 전자서명 시 이메일 확인, 우체국 내용증명
              발송, 계약갱신 서식 작성 및 이용자가 요청한 전자우편 전송 목적으로만
              이용됩니다.
            </p>
            <p className="mt-2">
              ※ 전자서명 시의 인증은 <b>이용자가 입력한 이메일 주소로 발송된 일회용
              인증번호(OTP)를 확인</b>하는 절차이며, 실명 확인 등 신원확인 절차가
              아닙니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              3. 개인정보의 보관 및 파기
            </h2>
            <p>
              서명 감사로그(서명 시각, IP, 기기 정보, 문서 해시)는 분쟁 대비 증거
              보존을 위해 <b>서명일로부터 5년</b> 동안 보관한 후 지체 없이 파기합니다.
            </p>
            <p className="mt-2">
              <b>계약갱신 서식(계약갱신 요구 통지서·주택임대차계약 갱신 확인서)</b>에
              입력하신 내용은 서식을 만들어 화면에 표시하거나 이용자가 요청한 주소로
              전자우편을 보내는 데에만 사용하며, 회사의 데이터베이스에 저장하지
              않습니다. 다만 전자우편 발송 과정에서 <b>메일 서비스 제공자와 수신자 측
              메일 서버에는 통상적인 발송·수신 기록이 남습니다.</b>
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              4. 개인정보의 제3자 제공
            </h2>
            <p>
              내용증명 발송을 위해 필요한 범위 내에서 우정사업본부(우체국)에
              발송 정보가 제공될 수 있으며, 그 외 목적으로는 제3자에게 제공하지
              않습니다.
            </p>
            <p className="mt-3 font-semibold text-slate-900">개인정보 처리업무의 위탁</p>
            <p className="mt-1">
              회사는 전자우편 발송 업무를 <b>네이버클라우드 주식회사(네이버웍스 메일)</b>에
              위탁하고 있으며, 위탁 업무의 내용은 <b>이용자가 요청한 전자우편의 전송</b>에
              한정됩니다.
            </p>
            <p className="mt-3 font-semibold text-slate-900">이용자가 입력한 상대방 정보</p>
            <p className="mt-1">
              계약갱신 서식에는 이용자가 <b>상대방(임대인 또는 임차인)의 성명·주소·
              연락처·전자우편 주소</b>를 직접 입력합니다. 해당 정보는 이용자가 작성한
              서식을 만들고 이용자가 지정한 주소로 전송하는 데에만 사용되며, 그 입력과
              전송에 대한 책임은 이용자에게 있습니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              5. 이용자의 권리
            </h2>
            <p>
              이용자는 자신의 개인정보에 대한 열람, 정정, 삭제를 요청할 수
              있습니다.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
