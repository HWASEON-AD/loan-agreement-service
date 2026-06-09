// /subscribe/[agreementId]?token=xxx — 이자 관리 구독 신청 페이지
// 서버 컴포넌트: 토큰 검증 + 약정서 정보 표시 → 클라이언트 폼
import Link from "next/link";
import { getAgreement, getSubscriptionByAgreement } from "@/lib/db";
import { redirect } from "next/navigation";
import { SubscribeForm } from "@/components/subscribe/SubscribeForm";
import { calcMonthlyInterest, formatNumber } from "@/lib/interest-calc";

export const dynamic = "force-dynamic";

interface SubscribePageProps {
  params: { agreementId: string };
  searchParams: { token?: string };
}

export default async function SubscribePage({
  params,
  searchParams,
}: SubscribePageProps) {
  const agreement = await getAgreement(params.agreementId);
  const token = searchParams.token;

  // 토큰/약정서 검증
  const validToken =
    !!token &&
    !!agreement &&
    (token === agreement.lenderSignToken ||
      token === agreement.borrowerSignToken);

  if (!agreement || !validToken) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">
            유효하지 않은 링크입니다
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            구독 신청 링크가 만료되었거나 올바르지 않습니다.
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

  // 이미 활성 구독이면 현황 페이지로
  const existing = await getSubscriptionByAgreement(agreement.id);
  if (existing && existing.status === "active") {
    redirect(
      `/subscribe/${agreement.id}/dashboard?token=${encodeURIComponent(token!)}`
    );
  }

  const interestAmount = calcMonthlyInterest(
    agreement.amount,
    agreement.interestRate
  );

  // 이자 약정이 없는 경우 안내
  if (interestAmount <= 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">
            이자 약정이 없는 약정서입니다
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            이자 관리 구독은 이자 약정이 설정된 약정서에서만 신청할 수 있습니다.
          </p>
          <Link
            href={`/complete/${agreement.id}`}
            className="mt-6 inline-block rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800"
          >
            약정서 보기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-xl px-4">
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700">
            이자 관리 구독
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            이자 납부, 자동으로 관리하세요
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            매월 납부일 알림과 납부 기록 관리로 대여 사실을 꾸준히 입증합니다.
          </p>
        </div>

        {/* 약정서 요약 */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            약정서 정보
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">대여자</dt>
              <dd className="font-medium text-slate-800">
                {agreement.lender.name}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">차용자</dt>
              <dd className="font-medium text-slate-800">
                {agreement.borrower.name}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">대여 금액</dt>
              <dd className="font-medium text-slate-800">
                {formatNumber(agreement.amount)}원
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">이자율</dt>
              <dd className="font-medium text-slate-800">
                연 {(agreement.interestRate * 100).toFixed(1)}%
              </dd>
            </div>
          </dl>
        </div>

        <SubscribeForm
          agreementId={agreement.id}
          token={token!}
          defaultEmail={agreement.borrower.email}
          interestAmount={interestAmount}
        />

        <div className="mt-6 text-center">
          <Link
            href={`/complete/${agreement.id}`}
            className="text-sm text-slate-500 underline hover:text-slate-700"
          >
            약정서로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
