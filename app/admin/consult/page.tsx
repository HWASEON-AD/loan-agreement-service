// /admin/consult — 세무상담 전용 어드민 (자체 로그인 포함)
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ConsultAdminLogin } from "@/components/admin/ConsultAdminLogin";
import { ConsultBoard } from "@/components/admin/ConsultBoard";

export const dynamic = "force-dynamic";

export default function ConsultAdminPage() {
  if (!isAdminAuthenticated()) {
    return <ConsultAdminLogin />;
  }
  return <ConsultBoard />;
}
