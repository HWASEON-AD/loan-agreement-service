// /advisor — 세무사 전용 로그인 페이지
// 이미 인증된 경우 대시보드로 이동
import { redirect } from "next/navigation";
import { isAdvisorAuthenticated } from "@/lib/advisor-auth";
import { AdvisorLogin } from "@/components/advisor/AdvisorLogin";

export const dynamic = "force-dynamic";

export default function AdvisorLoginPage() {
  if (isAdvisorAuthenticated()) {
    redirect("/advisor/dashboard");
  }
  return <AdvisorLogin />;
}
