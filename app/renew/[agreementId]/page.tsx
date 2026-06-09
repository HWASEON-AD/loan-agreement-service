// /renew/[agreementId]?token=xxx — 약정서 갱신 페이지
// 서버 컴포넌트: 토큰 검증 + 기존 약정서 정보 조회 → 클라이언트 폼에 pre-fill
import Link from "next/link";
import { getAgreement } from "@/lib/db";
import { RenewForm } from "@/components/renew/RenewForm";

export const dynamic = "force-dynamic";

interface RenewPageProps {
  params: { agreementId: string };
  searchParams: { token?: string };
}

export default async function RenewPage({
  params,
  searchParams,
}: RenewPageProps) {
  const agreement = await getAgreement(params.agreementId);
  const token = searchParams.token;

  // 토큰/약정서 검증 — 불일치 시 안내 화면
  if (!agreement || !token || token !== agreement.lenderSignToken) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">
            유효하지 않은 링크입니다
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            갱신 링크가 만료되었거나 올바르지 않습니다.
            <br />
            이메일의 최신 갱신 링크를 다시 확인해주세요.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800"
          >
            홈으로 이동
          </Link>
        </div>
      </main>
    );
  }

  // 오늘 / 1년 후 기본값 (시작일·만기일 자동 설정)
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const nextYearStr = nextYear.toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-xl px-4">
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700">
            약정서 갱신
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            약정서 갱신 신청
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            기존 정보를 확인하고 금액·기간 등을 수정한 뒤 갱신 약정서를
            작성하세요.
          </p>
        </div>

        <RenewForm
          agreementId={agreement.id}
          token={token}
          initial={{
            amount: agreement.amount,
            interestRate: agreement.interestRate,
            startDate: todayStr,
            endDate: nextYearStr,
            repaymentMethod: agreement.repaymentMethod,
            lenderName: agreement.lender.name,
            borrowerName: agreement.borrower.name,
          }}
        />

        <div className="mt-6 text-center">
          <Link
            href={`/complete/${agreement.id}`}
            className="text-sm text-slate-500 underline hover:text-slate-700"
          >
            이전 약정서 보기
          </Link>
        </div>
      </div>
    </main>
  );
}
