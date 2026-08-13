// 계약갱신 요구 통지서 PDF 생성 (pdf-lib + fontkit 한글 임베드)
//
// ★ 서버 사이드 전용 (Node fs 사용).
// ★ 생성만 하고 저장하지 않는다 — 통지서에는 임대인·임차인 실명과 주소가 들어간다.
//   (생성 문서 DB 미보관 원칙)

import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import path from "path";

// 🚨 폰트는 반드시 **TTF** 를, **subset:false** 로 임베드할 것. (실측으로 확인한 결과)
//
//  | 폰트 / 옵션                        | 결과                                    |
//  |------------------------------------|-----------------------------------------|
//  | NotoSansKR-Regular.otf, subset X   | ❌ 한글이 엉뚱한 한자로 깨짐(공백→堺)     |
//  | NotoSansKR-Regular.otf, subset O   | ❌ 한글이 아예 안 보임(빈칸)             |
//  | NanumGothic-Regular.ttf, subset O  | ❌ 글자가 군데군데 누락 (pdf-lib 서브셋 버그) |
//  | NanumGothic-Regular.ttf, subset X  | ✅ 정상 (730KB)  ← 채택                  |
//
//  원인: pdf-lib(fontkit)이 CJK **OTF(CFF)** 를 제대로 임베드하지 못한다.
//  malgun.ttf 도 정상 동작하지만 MS 윈도우 번들 폰트라 PDF에 넣어 배포하면 라이선스가 걸린다.
//  NanumGothic 은 SIL OFL 이라 임베드·재배포가 자유롭다.
const FONT_PATH = path.join(process.cwd(), "public", "fonts", "NanumGothic-Regular.ttf");
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

let cachedFontBytes: Uint8Array | null = null;

// 한글 폰트 로드 — fs 실패 시 HTTP fallback (Vercel 프로덕션에서 파일이 번들에 없을 수 있음)
async function loadFontBytes(): Promise<Uint8Array | null> {
  if (cachedFontBytes) return cachedFontBytes;
  try {
    cachedFontBytes = new Uint8Array(await readFile(FONT_PATH));
    return cachedFontBytes;
  } catch {
    /* ignored */
  }
  try {
    const res = await fetch(`${BASE_URL}/fonts/NanumGothic-Regular.ttf`);
    if (res.ok) {
      cachedFontBytes = new Uint8Array(await res.arrayBuffer());
      return cachedFontBytes;
    }
  } catch {
    /* ignored */
  }
  console.error("[renewal-pdf] 한글 폰트 로드 최종 실패");
  return null;
}

// 긴 줄을 페이지 폭에 맞게 줄바꿈 (한글 포함이라 문자 단위).
// 들여쓰기(선행 공백)는 이어지는 줄에도 유지해 서식이 무너지지 않게 한다.
function wrapLine(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  if (text === "") return [""];
  const indent = text.match(/^\s*/)?.[0] ?? "";
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    const test = current + ch;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current !== "") {
      lines.push(current);
      current = indent + ch;
    } else {
      current = test;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

/** 통지서 텍스트 → PDF 바이트 */
export async function generateRenewalNoticePdf(noticeText: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await loadFontBytes();
  let font: PDFFont;
  if (fontBytes) {
    font = await pdfDoc.embedFont(fontBytes, { subset: false });
  } else {
    // 폰트 실패 시에도 생성 자체는 성공시킨다 (한글은 깨질 수 있음)
    const { StandardFonts } = await import("pdf-lib");
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const A4 = { width: 595.28, height: 841.89 };
  const margin = 56;   // 기존 약정서 PDF(pdf-generator.ts)와 동일한 여백
  const fontSize = 11;
  const maxWidth = A4.width - margin * 2;

  let page = pdfDoc.addPage([A4.width, A4.height]);
  let cursorY = A4.height - margin;

  // 본문 끝의 빈 줄은 제거한다 — 안 그러면 빈 줄이 커서를 밀어내 백지 페이지가 하나 더 생긴다.
  const lines = noticeText.replace(/\s+$/, "").split("\n");

  lines.forEach((line, idx) => {
    // 첫 줄 = 제목. 가운데 정렬 + 큰 글씨
    if (idx === 0) {
      const titleSize = 20;   // 기존 약정서 PDF와 동일한 제목 크기
      const titleWidth = font.widthOfTextAtSize(line.trim(), titleSize);
      page.drawText(line.trim(), {
        x: (A4.width - titleWidth) / 2,
        y: cursorY,
        size: titleSize,
        font,
        color: rgb(0.06, 0.13, 0.34),
      });
      cursorY -= titleSize + 26;
      return;
    }

    for (const ln of wrapLine(font, line, fontSize, maxWidth)) {
      // 페이지 넘김은 '실제로 그릴 글자가 있을 때'만 판단한다.
      // 빈 줄에서 페이지를 넘기면 백지 페이지가 생긴다.
      if (ln !== "") {
        if (cursorY < margin + fontSize * 2) {
          page = pdfDoc.addPage([A4.width, A4.height]);
          cursorY = A4.height - margin;
        }
        page.drawText(ln, {
          x: margin,
          y: cursorY,
          size: fontSize,
          font,
          color: rgb(0.1, 0.1, 0.15),
        });
      }
      cursorY -= fontSize + 8;
    }
  });

  return await pdfDoc.save();
}

/** 다운로드 파일명 — 계약갱신요구통지서_YYYYMMDD.pdf */
export function renewalPdfFilename(dateYmd: string): string {
  return `계약갱신요구통지서_${dateYmd.replace(/-/g, "")}.pdf`;
}
