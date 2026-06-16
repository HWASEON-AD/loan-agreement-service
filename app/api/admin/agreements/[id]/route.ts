// DELETE /api/admin/agreements/[id] — 약정서 삭제 (어드민 전용)
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deleteAgreement } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const ok = await deleteAgreement(params.id);
  if (!ok) {
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
