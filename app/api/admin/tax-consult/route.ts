// /api/admin/tax-consult
// GET  : 세무상담 신청 전체 조회 (어드민 인증 필수)
// POST : 선택한 신청 목록을 HTML 테이블로 gt.min@hwaseon.com 에 발송

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getTaxConsultations } from "@/lib/db";
import { sendTaxConsultListEmail } from "@/lib/email";

// GET — 전체 목록 (마스킹은 클라이언트 표시 단계에서 처리)
export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const consultations = await getTaxConsultations();
    return NextResponse.json({ consultations });
  } catch (err) {
    console.error("[admin/tax-consult] 조회 실패:", err);
    return NextResponse.json(
      { error: "세무상담 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST — 선택 항목 세무사 이메일 발송
export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "발송할 항목을 선택해주세요." },
        { status: 400 }
      );
    }

    const all = await getTaxConsultations();
    const idSet = new Set(ids);
    const selected = all.filter((c) => idSet.has(c.id));
    if (selected.length === 0) {
      return NextResponse.json(
        { error: "선택한 항목을 찾을 수 없습니다." },
        { status: 400 }
      );
    }

    try {
      await sendTaxConsultListEmail(selected);
    } catch (mailErr) {
      console.error("[admin/tax-consult] 이메일 발송 실패:", mailErr);
      return NextResponse.json(
        { error: "이메일 발송에 실패했습니다. SMTP 설정을 확인해주세요." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, sent: selected.length });
  } catch (err) {
    console.error("[admin/tax-consult] POST 실패:", err);
    return NextResponse.json(
      { error: "이메일 발송 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
