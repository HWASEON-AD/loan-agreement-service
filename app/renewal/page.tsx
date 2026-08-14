// 계약갱신 요구 통지서 만들기 — 주택임대차보호법 제6조의3
//
// ★ 이 기능은 무료로 제공한다. 구독 혜택 목록·가격표에 절대 기재하지 말 것.
//   (무료여도 유료 상품 동선에 얹히면 변호사법 109조의 대가성 프레임이 산다)

import type { Metadata } from "next";
import { RenewalForm } from "@/components/renewal/RenewalForm";
import { LegalNotice } from "@/components/ui/LegalNotice";
import { getLawStatusForDisplay } from "@/lib/law-watch";

// 법령 확인 상태를 매 요청마다 읽는다 (하루 1회 크론이 갱신한다)
export const dynamic = "force-dynamic";

// ISO 시각 → "YYYY-MM-DD" (KST)
function toKstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// "2026-01-02" → "2026. 1. 2."
function toDotDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${y}. ${Number(m)}. ${Number(d)}.`;
}

export const metadata: Metadata = {
  title: "계약갱신 서식 만들기 | 내지마요",
  description:
    "전세·월세 계약갱신요구권 통지서와 주택임대차계약 갱신 확인서를 무료로 만들어 보세요. 계약서상 만료일만 입력하면 주택임대차보호법 제6조의3이 정한 행사 기간이 계산되고, 서식을 인쇄·이메일·문자로 보낼 수 있습니다.",
};

export default async function RenewalPage() {
  // 법령 최신 확인 상태 — 실패해도 페이지는 정상 렌더되어야 한다
  const law = await getLawStatusForDisplay().catch(() => null);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        {/* 헤더 */}
        <div className="mb-8 print:hidden">
          <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
            무료
          </span>
          <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
            계약갱신 서식 만들기
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            계약서를 꺼내 놓고 시작하세요. 입력하신 내용이 정해진 서식에 그대로 들어가고,
            주택임대차보호법 제6조의3이 정한 기간이 함께 계산됩니다.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            갱신을 요구할 때 쓰는 <b className="text-slate-700">계약갱신 요구 통지서</b>와, 갱신이
            이루어진 뒤 그 갱신이 갱신요구권 행사에 의한 것이었음을 양 당사자가 함께 기록해 두는{" "}
            <b className="text-slate-700">주택임대차계약 갱신 확인서</b> 두 가지를 만들 수 있습니다.
          </p>
        </div>

        {/* 법령 기준일 — 매일 1회 법제처 공식 페이지를 확인해 갱신한다.
            확인에 실패하는 동안에는 '오래됨'으로 표시한다. 실패를 '이상 없음'으로 보이게 하면 안 된다. */}
        {law?.effectiveDate && (
          <div className="mb-5 print:hidden">
            <div
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-4 py-3 text-xs leading-relaxed ${
                law.changedPending || law.stale
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <span className="font-semibold text-slate-900">
                적용 법령 : 주택임대차보호법 [시행 {toDotDate(law.effectiveDate)}]
              </span>
              {law.lawNumber && <span>법률 {law.lawNumber}</span>}
              {law.lastSuccessAt && (
                <span className="text-slate-500">
                  · 법제처 최종 확인 {toKstDate(law.lastSuccessAt)}
                </span>
              )}
              {law.stale && <span className="font-semibold">· ⚠️ 최근 확인이 지연되고 있습니다</span>}
              {law.changedPending && (
                <span className="font-semibold">· ⚠️ 법령 변경이 감지되어 검토 중입니다</span>
              )}
            </div>
          </div>
        )}

        <RenewalForm />

        {/* 고정 고지 */}
        <div className="mt-10 print:hidden">
          <LegalNotice tone="info" title="안내">
            <p className="text-sm leading-relaxed">
              내지마요는 변호사·법무사가 아니며 법률사무를 취급하지 않습니다. 이 화면의 날짜와
              금액은 이용자가 입력한 값을 법령의 산식에 기계적으로 대입한 결과로,
              법률상담·감정·개별 사안에 대한 판단이 아닙니다. 구체적인 분쟁이 있는 경우 변호사 등
              자격 있는 전문가와 상의하시기 바랍니다.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              ※ 작성하신 통지서는 서버에 저장되지 않습니다. 이메일 발송 시에도 전송에만 사용됩니다.
            </p>
          </LegalNotice>
        </div>
      </div>
    </main>
  );
}
