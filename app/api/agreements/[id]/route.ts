// GET /api/agreements/[id] — 약정서 단건 조회
//
//   접근 주체에 따라 반환 범위가 다르다:
//   • 관리자(admin_session 쿠키) → 전체 정보 + 서명 감사로그(서명이미지/IP) 반환.
//     관리자 상세 모달(components/admin/AgreementModal)이 이 경로를 쓴다.
//   • 그 외(완료 페이지 등 id만 아는 요청) → 완료 페이지 표시에 필요한 최소 필드만.
//     양측 주민등록 생년월일·전화·이메일·주소, 서명 이미지/IP, borrowerSignToken,
//     pdfBase64 는 반환하지 않는다. (완료 페이지 링크는 이메일로 id-only 발송되므로
//     인증을 강제하지 못한다 → 강제 대신 민감정보 노출을 차단하는 방식)

import { NextRequest, NextResponse } from "next/server";
import {
  getAgreement,
  getOrderByAgreement,
  getSignaturesByAgreement,
} from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";

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

    // 관리자만 전체 정보 + 서명 감사로그(서명이미지/IP)를 받는다.
    if (isAdminAuthenticated()) {
      const signatures = await getSignaturesByAgreement(params.id);
      return NextResponse.json({ agreement, order, signatures });
    }

    // 비관리자: 완료 페이지가 실제로 쓰는 필드만 추린 축소본.
    //   (lenderSignToken 은 완료 페이지가 PDF/감사인증서/구독 링크 생성에 필요하므로
    //    포함한다. PDF 라우트가 이 토큰을 자체 검증한다.)
    const safeAgreement = {
      id: agreement.id,
      status: agreement.status,
      amount: agreement.amount,
      interestRate: agreement.interestRate,
      lender: { name: agreement.lender?.name ?? "" },
      borrower: { name: agreement.borrower?.name ?? "" },
      lenderSignToken: agreement.lenderSignToken,
    };
    const safeOrder = order
      ? {
          status: order.status,
          certMailStatus: order.certMailStatus,
          amount: order.amount,
        }
      : null;

    return NextResponse.json({
      agreement: safeAgreement,
      order: safeOrder,
      signatures: [],
    });
  } catch (err) {
    console.error("[agreements/get] 조회 실패:", err);
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
