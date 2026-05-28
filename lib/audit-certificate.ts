// lib/audit-certificate.ts
// 전자서명 감사추적인증서 PDF 생성
// 전자문서법 제4조, 전자서명법 제3조 기반 서명 증거 문서

import { PDFDocument, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import path from "path";
import type { Agreement, SignatureRecord } from "./types";
import { SERVICE_NAME } from "./config";

const FONT_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSansKR-Regular.otf");
let cachedFontBytes: Uint8Array | null = null;

async function loadFontBytes(): Promise<Uint8Array | null> {
  if (cachedFontBytes) return cachedFontBytes;
  try {
    const buf = await readFile(FONT_PATH);
    cachedFontBytes = new Uint8Array(buf);
    return cachedFontBytes;
  } catch {
    return null;
  }
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const cleaned = b64.includes(",") ? b64.split(",")[1] : b64;
    return new Uint8Array(Buffer.from(cleaned, "base64"));
  } catch {
    return null;
  }
}

function wrapLine(font: PDFFont, text: string, fontSize: number, maxWidth: number): string[] {
  if (text === "") return [""];
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    const test = current + ch;
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current !== "") {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

function formatKstTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false })
      .replace(/\. /g, "-").replace(/\.$/, "") + " KST";
  } catch {
    return isoStr;
  }
}

// 감사추적인증서 PDF 생성 → base64
export async function generateAuditCertificate(
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
    const { StandardFonts } = await import("pdf-lib");
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const A4 = { width: 595.28, height: 841.89 };
  const margin = 56;
  const bodyMaxWidth = A4.width - margin * 2;
  const DARK = rgb(0.06, 0.13, 0.34);
  const MID = rgb(0.3, 0.35, 0.45);
  const LIGHT = rgb(0.55, 0.6, 0.65);
  const GREEN = rgb(0.05, 0.55, 0.25);

  let page = pdfDoc.addPage([A4.width, A4.height]);
  let cy = A4.height - margin;

  const newPage = () => {
    page = pdfDoc.addPage([A4.width, A4.height]);
    cy = A4.height - margin;
  };

  const ensureSpace = (needed: number) => {
    if (cy < margin + needed) newPage();
  };

  // 구분선 그리기
  const drawHRule = (color = rgb(0.8, 0.82, 0.87), thickness = 0.5) => {
    ensureSpace(8);
    page.drawLine({
      start: { x: margin, y: cy },
      end: { x: A4.width - margin, y: cy },
      thickness,
      color,
    });
    cy -= 10;
  };

  // 텍스트 한 줄 (줄바꿈 포함)
  const drawText = (
    text: string,
    {
      size = 10,
      color = DARK,
      indent = 0,
      gap = 6,
    }: { size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}
  ) => {
    const lines = wrapLine(font, text, size, bodyMaxWidth - indent);
    for (const ln of lines) {
      ensureSpace(size + gap);
      page.drawText(ln, { x: margin + indent, y: cy, size, font, color });
      cy -= size + gap;
    }
  };

  // 라벨 + 값 행
  const drawRow = (label: string, value: string, valueColor = DARK) => {
    const labelW = 90;
    ensureSpace(14);
    page.drawText(label, { x: margin, y: cy, size: 9.5, font, color: MID });
    const valLines = wrapLine(font, value, 9.5, bodyMaxWidth - labelW);
    page.drawText(valLines[0] ?? "", { x: margin + labelW, y: cy, size: 9.5, font, color: valueColor });
    cy -= 15;
    for (let i = 1; i < valLines.length; i++) {
      ensureSpace(14);
      page.drawText(valLines[i], { x: margin + labelW, y: cy, size: 9.5, font, color: valueColor });
      cy -= 15;
    }
  };

  // ─── 헤더 ───
  // 제목 배경 박스
  page.drawRectangle({
    x: margin,
    y: cy - 52,
    width: bodyMaxWidth,
    height: 62,
    color: DARK,
  });
  page.drawText("전자서명 감사추적 인증서", {
    x: margin + 16,
    y: cy - 20,
    size: 16,
    font,
    color: rgb(1, 1, 1),
  });
  page.drawText("Electronic Signature Audit Certificate", {
    x: margin + 16,
    y: cy - 38,
    size: 9,
    font,
    color: rgb(0.75, 0.82, 1),
  });
  page.drawText(SERVICE_NAME, {
    x: A4.width - margin - font.widthOfTextAtSize(SERVICE_NAME, 9) - 16,
    y: cy - 38,
    size: 9,
    font,
    color: rgb(0.75, 0.82, 1),
  });
  cy -= 72;

  // 발급 정보
  const issuedAt = formatKstTime(new Date().toISOString());
  drawRow("인증서 발급", issuedAt, MID);
  drawRow("약정서 ID", agreement.id, MID);
  cy -= 4;
  drawHRule();

  // ─── 문서 개요 ───
  drawText("■ 계약 개요", { size: 11, color: DARK });
  cy -= 4;
  drawRow("대 여 인(갑)", agreement.lender.name);
  drawRow("차 입 인(을)", agreement.borrower.name);
  drawRow("대여 금액", `${agreement.amount.toLocaleString("ko-KR")}원`);
  drawRow("대여 기간", `${agreement.startDate} ~ ${agreement.endDate}`);
  const docHash = signatures[0]?.documentHash ?? agreement.documentHash ?? "-";
  drawRow("문서 해시(SHA-256)", docHash, LIGHT);
  cy -= 4;
  drawHRule();

  // ─── 서명자별 감사로그 ───
  const signerOrder: ("lender" | "borrower")[] = ["lender", "borrower"];
  for (const signerType of signerOrder) {
    const s = signatures.find((r) => r.signerType === signerType);
    const label = signerType === "lender" ? "대 여 인(갑) 서명 기록" : "차 입 인(을) 서명 기록";
    const partyInfo = signerType === "lender" ? agreement.lender : agreement.borrower;

    drawText(`■ ${label}`, { size: 11, color: DARK });
    cy -= 4;

    if (!s) {
      drawText("  서명 기록 없음", { color: LIGHT });
      cy -= 4;
      drawHRule();
      continue;
    }

    drawRow("성    명", s.signerName);
    drawRow("연 락 처", s.signerPhoneMasked);
    drawRow("이 메 일", partyInfo.email
      ? partyInfo.email.replace(/(.{2})([^@]*)(@.*)/, "$1***$3")
      : "-");
    drawRow("서명 시각", formatKstTime(s.signedAt));
    drawRow("IP 주소", s.ipAddress || "-");
    // UA 파싱 (간략화)
    const ua = s.userAgent || "-";
    const uaShort = ua.length > 70 ? ua.slice(0, 67) + "..." : ua;
    drawRow("접속 기기", uaShort);
    drawRow("이메일 OTP", s.otpVerified ? "인증 완료 ✓" : "미인증", s.otpVerified ? GREEN : rgb(0.8, 0.2, 0.2));
    drawRow("문서 해시", s.documentHash, LIGHT);

    // 서명 이미지
    if (s.signatureImageBase64) {
      cy -= 6;
      drawText("서 명 이미지", { size: 9, color: MID });
      const bytes = base64ToBytes(s.signatureImageBase64);
      if (bytes) {
        try {
          let img: PDFImage;
          try { img = await pdfDoc.embedPng(bytes); }
          catch { img = await pdfDoc.embedJpg(bytes); }
          const maxW = 160;
          const w = Math.min(img.width * 0.4, maxW);
          const h = (img.height / img.width) * w;
          ensureSpace(h + 10);
          page.drawImage(img, { x: margin, y: cy - h, width: w, height: h });
          cy -= h + 12;
        } catch { /* 이미지 실패 무시 */ }
      }
    }

    cy -= 4;
    drawHRule();
  }

  // ─── 면책 문구 ───
  cy -= 4;
  drawText("■ 법적 근거 및 면책", { size: 10, color: DARK });
  cy -= 4;
  const disclaimer = [
    "본 인증서는 전자문서 및 전자거래 기본법 제4조, 전자서명법 제3조에 따라",
    `서명 행위를 증명하는 감사 기록이며, ${SERVICE_NAME}이 자동 발급합니다.`,
    "",
    `${SERVICE_NAME}은 이용자가 제공한 정보를 바탕으로 서비스를 제공하였으며,`,
    "입력 정보의 정확성에 대한 책임은 이용자에게 있습니다.",
    "(이용약관 제3조)",
    "",
    "서명 당사자가 본인 서명이 아니라고 주장하려면, 해당 이메일 계정·",
    "IP·기기 정보 등이 본인과 무관함을 직접 증명하여야 합니다.",
    "(민사소송법상 서명진정성립 추정 원칙)",
  ];
  for (const line of disclaimer) {
    drawText(line, { size: 9, color: line === "" ? MID : MID });
  }

  // 하단 마감선
  drawHRule(DARK, 1);
  drawText(`발급 시각: ${issuedAt}  |  ${SERVICE_NAME}`, { size: 8, color: LIGHT });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
}
