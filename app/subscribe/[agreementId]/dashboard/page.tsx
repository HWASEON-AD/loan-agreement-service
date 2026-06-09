// /subscribe/[agreementId]/dashboard?token=xxx — 이자 관리 현황 (구독자 전용)
// 서버 컴포넌트: 토큰 + 구독 검증 → 클라이언트 대시보드
import Link from "next/link";
import { getAgreement, getSubscriptionByAgreement } from "@/lib/db";
import { SubscribeDashboard } from "@/components/subscribe/SubscribeDashboard";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  params: { agreementId: string };
  searchParams: { token?: string };
}

export default async function SubscribeDashboardPage({
  params,
  searchParams,
}: DashboardPageProps) {
  const agreement = await getAgreement(params.agreementId);
  const token = searchParams.token;

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
            현황 페이지 링크가 만료되었거나 올바르지 않습니다.
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

  const subscription = await getSubscriptionByAgreement(agreement.id);

  // 구독이 없으면 신청 페이지로 안내
  if (!subscription) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">
            아직 구독하지 않으셨습니다
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            이자 관리 구독을 먼저 신청해주세요.
          </p>
          <Link
            href={`/subscribe/${agreement.id}?token=${encodeURIComponent(token!)}`}
            className="mt-6 inline-block rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800"
          >
            구독 신청하기
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
            이자 관리 현황
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            이자 납부 현황
          </h1>
        </div>

        <SubscribeDashboard
          agreementId={agreement.id}
          token={token!}
          subscriptionId={subscription.id}
          agreement={{
            lenderName: agreement.lender.name,
            borrowerName: agreement.borrower.name,
            amount: agreement.amount,
            interestRate: agreement.interestRate,
            startDate: agreement.startDate,
            endDate: agreement.endDate,
          }}
        />
      </div>
    </main>
  );
}
