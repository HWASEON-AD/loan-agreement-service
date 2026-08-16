// 계약갱신 서식(통지서·확인서) PDF 다운로드 API
//
// ★ 생성 후 즉시 응답으로 내보내고 저장하지 않는다 (실명·주소가 들어간다).
// ★ LLM 호출 0회 — 클라이언트가 정형 서식으로 만든 구조체를 그대로 렌더링만 한다.

import { NextRequest, NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { generateRenewalNoticePdf, renewalPdfFilename } from "@/lib/renewal-pdf";
import { buildFormDoc, buildLawLabel, isDocKind, isRenewalInput } from "@/lib/renewal-doc";
import { getLawStatusForDisplay } from "@/lib/law-watch";

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
    const kind = body?.kind;
    const notice = body?.notice;
    const dateYmd: string = (body?.dateYmd ?? "").trim();

    if (!isDocKind(kind) || !isRenewalInput(notice)) {
      return NextResponse.json({ error: "서식 내용이 올바르지 않습니다." }, { status: 400 });
    }

    // ★ 서버가 값으로부터 문서를 조립한다 (완성된 문서 구조를 그대로 받지 않는다)
    const law = await getLawStatusForDisplay().catch(() => null);
    const doc = buildFormDoc(kind, notice, buildLawLabel(law?.effectiveDate, law?.lawNumber));

    const pdfBytes = await generateRenewalNoticePdf(doc);
    const filename = renewalPdfFilename(
      /^\d{4}-\d{2}-\d{2}$/.test(dateYmd) ? dateYmd : new Date().toISOString().slice(0, 10),
      doc.title
    );

    // 한글 파일명은 RFC 5987 (filename*) 로 넘겨야 브라우저에서 깨지지 않는다.
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="renewal-document.pdf"; filename*=UTF-8''${encodeURIComponent(
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
