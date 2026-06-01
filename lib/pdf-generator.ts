// PDF 생성 로직 (pdf-lib + fontkit 한글 임베드)
// - 약정서 본문 텍스트를 PDF 로 렌더링
// - 대여자/차용자 서명 이미지 삽입
// - 감사로그 페이지 추가
// 서버 사이드에서만 실행된다 (Node fs 사용).

import { PDFDocument, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import path from "path";
import type { Agreement, SignatureRecord } from "./types";
import { buildAgreementText } from "./agreement-text";

// 한글 폰트: public/fonts (Vercel 서버 번들에 자동 포함됨)
const FONT_PATH = path.join(process.cwd(), "public", "fonts", "NotoSansKR-Regular.otf");

// 폰트 바이트 캐시
let cachedFontBytes: Uint8Array | null = null;

// 한글 폰트 로드 (실패 시 null)
async function loadFontBytes(): Promise<Uint8Array | null> {
  if (cachedFontBytes) return cachedFontBytes;
  try {
    const buf = await readFile(FONT_PATH);
    cachedFontBytes = new Uint8Array(buf);
    return cachedFontBytes;
  } catch (err) {
    console.error("[PDF] 한글 폰트 로드 실패:", err);
    return null;
  }
}

// base64 dataURL 또는 순수 base64 에서 PNG 바이트 추출
function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const cleaned = b64.includes(",") ? b64.split(",")[1] : b64;
    const buf = Buffer.from(cleaned, "base64");
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

// 긴 텍스트를 페이지 폭에 맞게 줄바꿈 (한글 포함, 문자 단위)
function wrapLine(
  font: PDFFont,
  text: string,
  fontSize: number,
  maxWidth: number
): string[] {
  if (text === "") return [""];
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    const test = current + ch;
    const w = font.widthOfTextAtSize(test, fontSize);
    if (w > maxWidth && current !== "") {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

// 약정서 PDF 생성 → base64 문자열 반환
export async function generateAgreementPdf(
  agreement: Agreement,
  signatures: SignatureRecord[]
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await loadFontBytes();
  let font: PDFFont;
  if (fontBytes) {
    font = await pdfDoc.embedFont(fontBytes, { subset: true });
  } else {
    // 폰트 로드 실패 시 표준 폰트로 폴백 (한글은 깨질 수 있으나 빌드/생성은 성공)
    const { StandardFonts } = await import("pdf-lib");
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const A4 = { width: 595.28, height: 841.89 };
  const margin = 56;
  const fontSize = 11;
  const lineHeight = 18;
  const maxWidth = A4.width - margin * 2;

  // ----- 본문 페이지 -----
  let page = pdfDoc.addPage([A4.width, A4.height]);
  let cursorY = A4.height - margin;

  // 한 줄 그리기 (필요 시 페이지 추가)
  const drawText = (text: string, size = fontSize, bold = false) => {
    const wrapped = wrapLine(font, text, size, maxWidth);
    for (const ln of wrapped) {
      if (cursorY < margin + lineHeight) {
        page = pdfDoc.addPage([A4.width, A4.height]);
        cursorY = A4.height - margin;
      }
      page.drawText(ln, {
        x: margin,
        y: cursorY,
        size,
        font,
        color: rgb(0.1, 0.1, 0.15),
      });
      cursorY -= size + 7;
    }
  };

  const agreementText = buildAgreementText(agreement);
  const textLines = agreementText.split("\n");

  // 제목은 크게, 나머지는 본문 크기
  textLines.forEach((line, idx) => {
    if (idx === 0) {
      // 제목 (가운데 정렬 흉내: 큰 글씨)
      const titleSize = 20;
      const titleWidth = font.widthOfTextAtSize(line, titleSize);
      if (cursorY < margin + 30) {
        page = pdfDoc.addPage([A4.width, A4.height]);
        cursorY = A4.height - margin;
      }
      page.drawText(line, {
        x: (A4.width - titleWidth) / 2,
        y: cursorY,
        size: titleSize,
        font,
        color: rgb(0.06, 0.13, 0.34),
      });
      cursorY -= titleSize + 16;
    } else {
      drawText(line);
    }
  });

  // ----- 서명 이미지 삽입 -----
  const drawSignature = async (label: string, b64: string | null) => {
    if (cursorY < margin + 90) {
      page = pdfDoc.addPage([A4.width, A4.height]);
      cursorY = A4.height - margin;
    }
    drawText(label);
    if (b64) {
      const bytes = base64ToBytes(b64);
      if (bytes) {
        try {
          let img: PDFImage;
          // PNG 우선, 실패 시 JPG 시도
          try {
            img = await pdfDoc.embedPng(bytes);
          } catch {
            img = await pdfDoc.embedJpg(bytes);
          }
          const dims = img.scale(0.4);
          const w = Math.min(dims.width, 180);
          const h = (img.height / img.width) * w;
          if (cursorY < margin + h) {
            page = pdfDoc.addPage([A4.width, A4.height]);
            cursorY = A4.height - margin;
          }
          page.drawImage(img, {
            x: margin,
            y: cursorY - h,
            width: w,
            height: h,
          });
          cursorY -= h + 12;
        } catch (err) {
          console.error("[PDF] 서명 이미지 삽입 실패:", err);
        }
      }
    }
  };

  // 감사로그에서 서명 이미지 찾기
  const lenderSig = signatures.find((s) => s.signerType === "lender");
  const borrowerSig = signatures.find((s) => s.signerType === "borrower");

  cursorY -= 10;
  await drawSignature(`▶ 대여자(갑) 전자서명`, lenderSig?.signatureImageBase64 ?? null);
  await drawSignature(`▶ 차용자(을) 전자서명`, borrowerSig?.signatureImageBase64 ?? null);

  // ----- 감사로그 페이지 -----
  page = pdfDoc.addPage([A4.width, A4.height]);
  cursorY = A4.height - margin;

  const drawAuditTitle = (text: string) => {
    page.drawText(text, {
      x: margin,
      y: cursorY,
      size: 16,
      font,
      color: rgb(0.06, 0.13, 0.34),
    });
    cursorY -= 28;
  };
  drawAuditTitle("전자서명 감사 기록 (Audit Trail)");

  const auditLines: string[] = [];
  auditLines.push(`약정서 ID : ${agreement.id}`);
  auditLines.push("");
  for (const s of signatures) {
    const typeLabel = s.signerType === "lender" ? "대여자(갑)" : "차용자(을)";
    auditLines.push(`[${typeLabel}] ${s.signerName}`);
    auditLines.push(`  서명 시각 : ${s.signedAt}`);
    auditLines.push(`  연락처    : ${s.signerPhoneMasked}`);
    auditLines.push(`  IP 주소   : ${s.ipAddress}`);
    auditLines.push(`  기기 정보 : ${s.userAgent}`);
    auditLines.push(`  OTP 인증  : ${s.otpVerified ? "완료" : "미인증"}`);
    auditLines.push(`  문서 해시 : ${s.documentHash}`);
    auditLines.push("");
  }
  auditLines.push("본 기록은 전자문서 및 전자거래 기본법에 따른 서명 증거자료입니다.");

  for (const line of auditLines) {
    drawText(line, 10);
  }

  const pdfBytes = await pdfDoc.save();
  // Uint8Array -> base64
  return Buffer.from(pdfBytes).toString("base64");
}
