// PATCH /api/admin/tax-consult/[id]/status — 상담 상태 업데이트

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { updateTaxConsultStatus } from "@/lib/db";

const VALID_STATUSES = ["pending", "contacted", "closed"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { status?: string };
    const status = body.status;
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "유효하지 않은 상태입니다." }, { status: 400 });
    }
    await updateTaxConsultStatus(params.id, status);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/tax-consult/status] 실패:", err);
    return NextResponse.json({ error: "상태 업데이트 실패" }, { status: 500 });
  }
}
