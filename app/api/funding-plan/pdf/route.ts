// POST /api/funding-plan/pdf — 자금조달계획서 PDF 생성 (한글 폰트 포함)
// Node.js Runtime 필수 (fs 사용)

import { NextRequest, NextResponse } from "next/server";
import { generateFundingPlanPdf } from "@/lib/funding-pdf";
import type {
  FundingPdfRequest,
  FundingStep1Data,
  FundingExtractResult,
} from "@/lib/funding-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 요청 본문 검증 (최소 필드만)
function validateBody(body: unknown): {
  ok: boolean;
  data?: FundingPdfRequest;
  error?: string;
} {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "요청 본문이 비어있습니다." };
  }
  const b = body as Record<string, unknown>;
  if (b.formType !== "housing" && b.formType !== "land") {
    return { ok: false, error: "formType이 유효하지 않습니다." };
  }
  if (!b.step1 || typeof b.step1 !== "object") {
    return { ok: false, error: "step1 데이터가 누락되었습니다." };
  }
  if (!b.result || typeof b.result !== "object") {
    return { ok: false, error: "result 데이터가 누락되었습니다." };
  }
  return {
    ok: true,
    data: {
      formType: b.formType,
      step1: b.step1 as FundingStep1Data,
      result: b.result as FundingExtractResult,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const validation = validateBody(body);
    if (!validation.ok || !validation.data) {
      return NextResponse.json(
        { ok: false, error: validation.error ?? "요청 본문 오류" },
        { status: 400 }
      );
    }

    const { step1, result } = validation.data;

    // PDF 생성 (base64)
    let pdfBase64: string;
    try {
      pdfBase64 = await generateFundingPlanPdf(step1, result);
    } catch (err) {
      console.error("[funding-pdf] 생성 실패:", err);
      const msg = err instanceof Error ? err.message : "PDF 생성 오류";
      return NextResponse.json(
        {
          ok: false,
          error: `PDF 생성에 실패했습니다. (${msg})`,
        },
        { status: 500 }
      );
    }

    // 바이너리 PDF 직접 반환 (application/pdf, attachment)
    const buf = Buffer.from(pdfBase64, "base64");
    const name = step1.baseInfo.name || "user";
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const safeName = encodeURIComponent(`자금조달계획서_${name}_${today}.pdf`);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[funding-pdf] 예외:", err);
    const msg = err instanceof Error ? err.message : "서버 내부 오류";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
