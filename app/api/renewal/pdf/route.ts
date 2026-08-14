// 계약갱신 요구 통지서 PDF 다운로드 API
//
// ★ 생성 후 즉시 응답으로 내보내고 저장하지 않는다 (실명·주소가 들어간다).
// ★ LLM 호출 0회 — 클라이언트가 정형 서식으로 만든 텍스트를 그대로 렌더링만 한다.

import { NextRequest, NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { generateRenewalNoticePdf, renewalPdfFilename } from "@/lib/renewal-pdf";

// 폰트 임베드에 Node 런타임이 필요하다 (Edge 불가)
export const runtime = "nodejs";

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  try {
    // PDF 생성은 폰트 임베드 때문에 비용이 있어 남용을 막는다. IP 기준 10분에 20회.
    if (!allowRequest(`renewal-pdf:${getIp(req)}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const noticeText: string = body?.noticeText ?? "";
    const dateYmd: string = (body?.dateYmd ?? "").trim();

    if (!noticeText) {
      return NextResponse.json({ error: "통지서 내용이 비어 있습니다." }, { status: 400 });
    }
    if (noticeText.length > 8000) {
      return NextResponse.json({ error: "통지서 내용이 너무 깁니다." }, { status: 400 });
    }

    const pdfBytes = await generateRenewalNoticePdf(noticeText);
    const filename = renewalPdfFilename(
      /^\d{4}-\d{2}-\d{2}$/.test(dateYmd) ? dateYmd : new Date().toISOString().slice(0, 10)
    );

    // 한글 파일명은 RFC 5987 (filename*) 로 넘겨야 브라우저에서 깨지지 않는다.
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="renewal-notice.pdf"; filename*=UTF-8''${encodeURIComponent(
          filename
        )}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[renewal/pdf] 생성 실패: ${msg}`);
    return NextResponse.json({ error: `PDF 생성에 실패했습니다: ${msg}` }, { status: 500 });
  }
}
