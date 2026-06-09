// /advisor/dashboard — 세무사 전용 대시보드 (서버 인증 가드 + 클라이언트 탭)
import { redirect } from "next/navigation";
import { isAdvisorAuthenticated } from "@/lib/advisor-auth";
import { AdvisorDashboard } from "@/components/advisor/AdvisorDashboard";
import { AdvisorLogoutButton } from "@/components/advisor/AdvisorLogoutButton";

export const dynamic = "force-dynamic";

export default function AdvisorDashboardPage() {
  if (!isAdvisorAuthenticated()) {
    redirect("/advisor");
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              세무사 대시보드
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              약정 현황 · 이체 증빙 · 세무상담 신청
            </p>
          </div>
          <AdvisorLogoutButton />
        </div>
        <AdvisorDashboard />
      </div>
    </main>
  );
}
