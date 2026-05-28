// GET /api/admin/agreements — 약정서 기준 대시보드 목록 + 통계
// 인증: isAdminAuthenticated() 쿠키 검증
// status 쿼리(all|pending|signed)로 서버 사이드 필터링

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { isMockMode } from "@/lib/config";
import { listAgreements } from "@/lib/db";
import { initMockSeedData } from "@/lib/mock-store";
import type { Agreement, AgreementStatus } from "@/lib/types";

// 대시보드 표시 상태 (기존 AgreementStatus 를 3그룹으로 묶음)
type DashboardStatus = "pending" | "signed" | "expired";

// 약정서 1건 → 대시보드 행 데이터로 변환할 때 사용하는 상태 그룹화 규칙
// (기획서 5-1 구현 로직 기준)
// - expired: cancelled 상태
// - signed:  대여자/차용자 모두 서명 완료
// - pending: 그 외 (draft / lender_signed 등)
function toDashboardStatus(a: Agreement): DashboardStatus {
  if (a.status === "cancelled") return "expired";
  if (a.lenderSigned && a.borrowerSigned) return "signed";
  return "pending";
}

// KST(한국시간) 기준 오늘 날짜 YYYY-MM-DD
function kstToday(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // 인증 검증
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    // Mock 모드이고 데이터가 비어 있으면 시연용 시드 주입
    if (isMockMode()) {
      initMockSeedData();
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = (searchParams.get("status") || "all") as
      | "all"
      | "pending"
      | "signed";

    // Mock/Supabase 자동 분기 (lib/db.ts)
    const agreements = await listAgreements();

    // Agreement → AgreementRow 변환
    const rows = agreements.map((a) => {
      const dashboardStatus = toDashboardStatus(a);
      return {
        id: a.id,
        createdAt: a.createdAt,
        lenderName: a.lender?.name ?? "-",
        borrowerName: a.borrower?.name ?? "-",
        amount: a.amount,
        status: a.status as AgreementStatus,
        dashboardStatus,
        lenderSigned: a.lenderSigned,
        borrowerSigned: a.borrowerSigned,
        endDate: a.endDate,
        lenderSignToken: a.lenderSignToken,
        borrowerSignToken: a.borrowerSignToken,
      };
    });

    // 통계 집계 (필터와 무관하게 항상 전체 기준)
    const today = kstToday();
    const stats = {
      total: rows.length,
      signedCount: rows.filter((r) => r.dashboardStatus === "signed").length,
      // 탭 건수 정확성을 위해 만료(expired)를 제외한 순수 서명대기 건수
      pendingCount: rows.filter((r) => r.dashboardStatus === "pending").length,
      todayCount: rows.filter((r) => r.createdAt.slice(0, 10) === today).length,
      totalAmount: rows.reduce((sum, r) => sum + (r.amount || 0), 0),
    };

    // status 필터링
    let filtered = rows;
    if (statusFilter === "pending") {
      filtered = rows.filter((r) => r.dashboardStatus === "pending");
    } else if (statusFilter === "signed") {
      filtered = rows.filter((r) => r.dashboardStatus === "signed");
    }

    // 최신순 정렬 (createdAt desc)
    filtered = [...filtered].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );

    return NextResponse.json({ agreements: filtered, stats });
  } catch (err) {
    console.error("[admin/agreements] 조회 실패:", err);
    return NextResponse.json(
      { error: "약정서 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
