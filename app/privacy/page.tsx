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
              수집된 정보는 대여약정서 작성, 전자서명 본인인증, 우체국 내용증명
              발송 목적으로만 이용됩니다.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-slate-900">
              3. 개인정보의 보관 및 파기
            </h2>
            <p>
              서명 감사로그(서명 시각, IP, 기기 정보, 문서 해시)는 분쟁 대비
              증거 보존을 위해 관련 법령이 정한 기간 동안 보관 후 파기됩니다.
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
