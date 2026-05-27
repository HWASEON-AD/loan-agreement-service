// GET /api/agreements/[id] — 약정서 단건 조회

import { NextRequest, NextResponse } from "next/server";
import { getAgreement, getOrderByAgreement } from "@/lib/db";

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

    return NextResponse.json({ agreement, order });
  } catch (err) {
    console.error("[agreements/get] 조회 실패:", err);
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
