// GET /api/agreements/[id] — 약정서 단건 조회
// 접근 제어:
//  - 관리자 세션 쿠키  → 전체(agreement + order + signatures) 반환
//  - ?token = 대여자/차용자 서명토큰 → 전체 반환(본인 약정서)
//  - 그 외(무인증)     → 최소 공개 정보만 반환(폴링용). PII·서명이미지·IP·토큰 제외

import { NextRequest, NextResponse } from "next/server";
import {
  getAgreement,
  getOrderByAgreement,
  getSignaturesByAgreement,
} from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import type { Agreement } from "@/lib/types";

// 무인증 호출자에게 노출해도 안전한 최소 필드만 추린다.
// (Step5 서명완료 폴링에서 필요한 status/borrowerSigned/이름 정도)
function toPublicView(a: Agreement) {
  return {
    id: a.id,
    status: a.status,
    lenderSigned: a.lenderSigned,
    borrowerSigned: a.borrowerSigned,
    amount: a.amount,
    lender: { name: a.lender.name },
    borrower: { name: a.borrower.name },
  };
}

export async function GET(
  req: NextRequest,
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

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const authorized =
      isAdminAuthenticated() ||
      (!!token &&
        (token === agreement.lenderSignToken ||
          token === agreement.borrowerSignToken));

    if (!authorized) {
      // 무인증 → 민감정보 없는 공개 뷰만
      return NextResponse.json({ agreement: toPublicView(agreement) });
    }

    // 인증됨 → 전체 반환 (상세 모달/완료화면용: 서명 이미지·일시·IP 포함)
    const order = await getOrderByAgreement(params.id);
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
