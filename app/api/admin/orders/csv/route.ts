// GET /api/admin/orders/csv — 내용증명 발송 대기 목록 CSV 다운로드

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listOrders, getAgreement } from "@/lib/db";
import { formatNumber } from "@/lib/interest-calc";

function csvCell(value: string): string {
  const v = (value ?? "").toString();
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function buildCertMailBody(
  lenderName: string,
  borrowerName: string,
  amount: number,
  startDate: string,
  endDate: string
): string {
  return [
    `귀하(${borrowerName})는 ${startDate} 발신인(${lenderName})으로부터`,
    `금 ${formatNumber(amount)}원을 차용하였으며, ${endDate}까지 이를 상환할 것을 약정하였습니다.`,
    `본 내용증명은 위 금전 대여 사실 및 약정 내용을 통지하기 위한 것입니다.`,
  ].join(" ");
}

export async function GET(_req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const orders = await listOrders();

    // 결제 완료 + 내용증명 미발송 건만
    const targets = orders.filter(
      (o) => o.status === "paid" && o.certMailStatus !== "sent"
    );

    const header = [
      "주문ID",
      "발신인이름",
      "발신인주소",
      "수신인이름",
      "수신인주소",
      "대여금액",
      "내용증명본문",
    ];

    const lines: string[] = [header.map(csvCell).join(",")];

    for (const o of targets) {
      const a = await getAgreement(o.agreementId);
      if (!a) continue;
      const body = buildCertMailBody(
        a.lender.name,
        a.borrower.name,
        a.amount,
        a.startDate,
        a.endDate
      );
      const row = [
        o.id,
        a.lender.name,
        a.lender.address,
        a.borrower.name,
        a.borrower.address,
        `${formatNumber(a.amount)}원`,
        body,
      ];
      lines.push(row.map(csvCell).join(","));
    }

    const csv = lines.join("\r\n");
    const bom = "﻿";

    return new NextResponse(bom + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cert-mail-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    console.error("[admin/orders/csv] 실패:", err);
    return NextResponse.json(
      { error: "CSV 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
