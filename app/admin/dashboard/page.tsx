// /admin/dashboard — 관리자 대시보드 (서버 인증 가드 + 클라이언트 테이블)
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { DashboardTabs } from "@/components/admin/DashboardTabs";
import { LogoutButton } from "@/components/admin/LogoutButton";

// 캐시 없이 매 요청 인증 확인
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  // 미인증 시 로그인 페이지로
  if (!isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              관리자 대시보드
            </h1>
            <p className="mt-1 text-sm text-slate-500">약정서 전체 현황</p>
          </div>
          <LogoutButton />
        </div>
        <DashboardTabs />
      </div>
    </main>
  );
}
