// 계약갱신 서식(통지서·확인서) PDF 다운로드 API
//
// ★ 생성 후 즉시 응답으로 내보내고 저장하지 않는다 (실명·주소가 들어간다).
// ★ LLM 호출 0회 — 클라이언트가 정형 서식으로 만든 구조체를 그대로 렌더링만 한다.

import { NextRequest, NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { generateRenewalNoticePdf, renewalPdfFilename } from "@/lib/renewal-pdf";
import type { FormDoc } from "@/lib/renewal-doc";

// 폰트 임베드에 Node 런타임이 필요하다 (Edge 불가)
export const runtime = "nodejs";

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// 최소 구조 검증 — 렌더러가 기대하는 모양인지만 본다 (내용은 이용자 입력 그대로 둔다)
function isFormDoc(v: unknown): v is FormDoc {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  if (typeof d.title !== "string" || !d.title) return false;
  if (typeof d.dateText !== "string") return false;
  if (!Array.isArray(d.blocks) || d.blocks.length === 0 || d.blocks.length > 12) return false;
  if (!Array.isArray(d.signatures) || d.signatures.length > 4) return false;

  for (const b of d.blocks as Record<string, unknown>[]) {
    if (!b || typeof b !== "object") return false;
    if (b.kind === "table") {
      if (!Array.isArray(b.colRatios) || !Array.isArray(b.rows)) return false;
      if ((b.rows as unknown[]).length > 30) return false;
    } else if (b.kind === "body" || b.kind === "note") {
      if (!Array.isArray(b.paragraphs)) return false;
    } else {
      return false;
    }
  }
  return true;
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
    const doc = body?.doc;
    const dateYmd: string = (body?.dateYmd ?? "").trim();

    if (!isFormDoc(doc)) {
      return NextResponse.json({ error: "서식 내용이 올바르지 않습니다." }, { status: 400 });
    }
    // 서식 1~2장 분량을 크게 넘지 않도록 상한을 둔다
    if (JSON.stringify(doc).length > 20000) {
      return NextResponse.json({ error: "서식 내용이 너무 깁니다." }, { status: 400 });
    }

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
