// GET /api/agreements/[id] — 약정서 단건 조회 (서명 감사로그 포함)

import { NextRequest, NextResponse } from "next/server";
import {
  getAgreement,
  getOrderByAgreement,
  getSignaturesByAgreement,
} from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agreement = await getAgreement(params.id);
    if (!agreement) {
      return NextResponse.json(
        { error: "약정서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    const order = await getOrderByAgreement(params.id);
    // 상세 모달에서 서명 이미지/일시/IP 표시를 위해 감사로그를 함께 반환
    const signatures = await getSignaturesByAgreement(params.id);

    return NextResponse.json({ agreement, order, signatures });
  } catch (err) {
    console.error("[agreements/get] 조회 실패:", err);
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
