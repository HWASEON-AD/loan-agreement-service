// GET /api/advisor/data — 세무사 대시보드 통합 데이터
// 인증: advisor_session 쿠키 (isAdvisorAuthenticated)
// 반환: 약정서 목록(이름 마스킹) + 약정서별 이체증빙 + 세무상담(연락처/이메일 전체)

import { NextResponse } from "next/server";
import { isAdvisorAuthenticated } from "@/lib/advisor-auth";
import { isMockMode } from "@/lib/config";
import {
  listAgreements,
  getTransferEvidences,
  getTaxConsultations,
} from "@/lib/db";
import { initMockSeedData } from "@/lib/mock-store";
import { calcMonthlyInterest } from "@/lib/interest-calc";

// 이름 마스킹 (홍길동 -> 홍**, 김철 -> 김*)
function maskName(name: string): string {
  if (!name) return "-";
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${"*".repeat(name.length - 1)}`;
}

export async function GET() {
  if (!isAdvisorAuthenticated()) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    if (isMockMode()) {
      initMockSeedData();
    }

    const agreements = await listAgreements();

    // 약정서 행 (이름 마스킹, 연락처는 미노출 — 세무사는 약정 현황만 확인)
    const agreementRows = agreements.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      startDate: a.startDate,
      endDate: a.endDate,
      lenderName: maskName(a.lender?.name ?? ""),
      borrowerName: maskName(a.borrower?.name ?? ""),
      amount: a.amount,
      interestRate: a.interestRate,
      monthlyInterest: calcMonthlyInterest(a.amount, a.interestRate),
      repaymentMethod: a.repaymentMethod,
      status: a.status,
      lenderSigned: a.lenderSigned,
      borrowerSigned: a.borrowerSigned,
      transferConfirmed: a.transferConfirmed,
      transferDate: a.transferDate,
    }));

    // 약정서별 이체 증빙 수집
    const evidenceGroups: {
      agreementId: string;
      lenderName: string;
      borrowerName: string;
      amount: number;
      evidences: {
        id: string;
        fileName: string;
        fileUrl: string;
        fileSize: number | null;
        uploadedBy: string;
        createdAt: string;
      }[];
    }[] = [];

    for (const a of agreements) {
      const evidences = await getTransferEvidences(a.id);
      if (evidences.length === 0) continue;
      evidenceGroups.push({
        agreementId: a.id,
        lenderName: maskName(a.lender?.name ?? ""),
        borrowerName: maskName(a.borrower?.name ?? ""),
        amount: a.amount,
        evidences: evidences.map((e) => ({
          id: e.id,
          fileName: e.fileName,
          fileUrl: e.fileUrl,
          fileSize: e.fileSize,
          uploadedBy: e.uploadedBy,
          createdAt: e.createdAt,
        })),
      });
    }

    // 세무상담 신청 (세무사에게는 이름 마스킹, 연락처/이메일 전체 표시)
    const consults = await getTaxConsultations();
    const consultRows = consults.map((c) => ({
      id: c.id,
      name: maskName(c.name),
      phone: c.phone,
      email: c.email,
      content: c.content,
      status: c.status,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({
      agreements: agreementRows,
      evidenceGroups,
      consultations: consultRows,
    });
  } catch (err) {
    console.error("[advisor/data] 조회 실패:", err);
    return NextResponse.json(
      { error: "데이터 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
