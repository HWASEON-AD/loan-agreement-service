// lib/audit-certificate.ts
// 전자서명 감사추적인증서 PDF 생성
// 전자문서법 제4조, 전자서명법 제3조 기반 서명 증거 문서

import { PDFDocument, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import path from "path";
import type { Agreement, SignatureRecord } from "./types";
import { SERVICE_NAME } from "./config";
import { maskIp } from "./request-info";

// 로고 표기(SERVICE_NAME)는 앞에 "/" 가 붙어 있다. 법적 문서 본문에 그대로 넣으면
// "/ 내지마요은 …" 처럼 나오므로, 문서에는 기호를 뗀 이름을 쓴다.
const BRAND = SERVICE_NAME.replace(/^[\/\s]+/, "").trim();

// 🚨🚨 폰트는 반드시 **TTF** 를 **subset:false** 로 임베드할 것.
//   원래 이 파일은 assets/fonts/NotoSansKR-Regular.otf 를 subset:true 로 쓰고 있었고,
//   그 결과 **발급된 인증서 PDF에 한글이 하나도 나오지 않았다**(제목·성명 전부 빈칸,
//   영문·숫자만 표시). 실제로 생성해 렌더링해서 확인한 사고다.
//   원인: pdf-lib(fontkit)이 CJK **OTF(CFF)** 를 제대로 임베드하지 못한다.
//   NanumGothic 은 SIL OFL 이라 임베드·재배포가 자유롭다. (public/fonts 에 있는 것과 동일 파일)
//   ⚠️ 텍스트 추출만으로 검증하지 말 것 — 추출은 되는데 화면이 백지인 경우가 있다. PNG 로 눈으로 볼 것.
const FONT_PATH = path.join(process.cwd(), "public", "fonts", "NanumGothic-Regular.ttf");
const FONT_URL_PATH = "/fonts/NanumGothic-Regular.ttf";
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
let cachedFontBytes: Uint8Array | null = null;

async function loadFontBytes(): Promise<Uint8Array | null> {
  if (cachedFontBytes) return cachedFontBytes;
  try {
    const buf = await readFile(FONT_PATH);
    cachedFontBytes = new Uint8Array(buf);
    return cachedFontBytes;
  } catch {
    /* fs 실패 시 HTTP 폴백 — Vercel 번들에 파일이 없을 수 있다 */
  }
  try {
    const res = await fetch(`${BASE_URL}${FONT_URL_PATH}`);
    if (res.ok) {
      cachedFontBytes = new Uint8Array(await res.arrayBuffer());
      return cachedFontBytes;
    }
  } catch {
    /* ignored */
  }
  console.error("[audit-certificate] 한글 폰트 로드 최종 실패 — 인증서 한글이 깨집니다");
  return null;
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

// KST 시각 표기. 로케일 출력 문자열을 치환하는 방식은 ICU 버전에 따라
// "2026-8-16-14시 17분 21초" 같은 결과가 나오므로 각 부분을 직접 조립한다.
function formatKstTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")} KST`;
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
    font = await pdfDoc.embedFont(fontBytes, { subset: false });
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
  page.drawText("전자서명 감사 기록", {
    x: margin + 16,
    y: cy - 20,
    size: 16,
    font,
    color: rgb(1, 1, 1),
  });
  page.drawText("Electronic Signature Audit Trail", {
    x: margin + 16,
    y: cy - 38,
    size: 9,
    font,
    color: rgb(0.75, 0.82, 1),
  });
  page.drawText(BRAND, {
    x: A4.width - margin - font.widthOfTextAtSize(BRAND, 9) - 16,
    y: cy - 38,
    size: 9,
    font,
    color: rgb(0.75, 0.82, 1),
  });
  cy -= 72;

  // 발급 정보
  const issuedAt = formatKstTime(new Date().toISOString());
  drawRow("기록 발급", issuedAt, MID);
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
    // 🚨 이 문서는 상대 당사자에게 교부된다. 전체 IP 는 특정력도 낮으면서
    //   프라이버시 비용만 크므로 뒤쪽을 가린다(내부 감사로그에는 전체가 남는다).
    drawRow("접속 IP", maskIp(s.ipAddress));
    // UA 파싱 (간략화)
    const ua = s.userAgent || "-";
    const uaShort = ua.length > 60 ? ua.slice(0, 57) + "..." : ua;
    drawRow("접속 기기", uaShort);
    drawRow("본인확인", s.otpVerified ? "이메일 OTP 확인됨" : "미확인", s.otpVerified ? GREEN : rgb(0.8, 0.2, 0.2));
    drawRow("서명시점 해시", s.documentHash, LIGHT);

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

  // ─── 해시 명세 ───
  // 🚨 해시는 "무엇을 대상으로 계산했는지"가 문서에 없으면 검증이 불가능하고,
  //   상대방이 첨부 PDF 를 해시해 보고 불일치하면 오히려 변조 의심의 근거가 된다.
  //   이 서비스의 해시 대상은 PDF 파일이 아니라 **약정서 본문 텍스트**다.
  cy -= 4;
  drawText("■ 해시 산출 기준", { size: 10, color: DARK });
  cy -= 4;
  for (const line of [
    "위 '서명시점 해시'는 각 당사자가 서명한 시점의 약정서 본문 텍스트를",
    "UTF-8 로 인코딩한 문자열에 SHA-256 을 적용한 값입니다.",
    "PDF 파일 자체의 해시가 아니므로, PDF 파일을 해시하면 값이 다릅니다.",
  ]) {
    drawText(line, { size: 9, color: MID });
  }

  // ─── 면책 문구 ───
  cy -= 4;
  drawText("■ 안내", { size: 10, color: DARK });
  cy -= 4;
  // 🚨🚨 여기에 법적 효과를 단정하는 문장을 다시 넣지 말 것.
  //   이전 문안에는 아래 세 가지 오류가 있었고 실제로 발급되어 나갔다.
  //   ① "전자문서법 제4조·전자서명법 제3조에 따라 서명 행위를 증명하는" —
  //      두 조문은 "전자적 형태라는 이유만으로 효력을 부인하지 않는다"는 차별금지 규정이지
  //      증명력을 부여하는 규정이 아니다. 조문을 정반대 취지로 인용한 것이다.
  //   ② "(이용약관 제3조)" — 비로그인 상대방은 약관에 동의한 적이 없어 원용 자체가 성립 안 한다.
  //   ③ "본인 서명이 아니라고 주장하려면 … 본인과 무관함을 직접 증명하여야 합니다" —
  //      **증명책임의 방향이 정반대다.** 민사소송법 제357조상 사문서의 진정성립은
  //      그 문서를 제출하는 쪽이 증명한다. 제358조의 추정도 "그 서명이 본인의 것"이
  //      먼저 인정되어야 발동한다. 2020년 전자서명법 전부개정으로 공인전자서명의
  //      진정성립 추정 규정도 삭제되었다. 게다가 이런 문장은 고객에게 증명책임을
  //      전가하는 것이어서 약관규제법 제14조상 무효 사유가 될 수 있다.
  //   → 사실 서술만 남긴다. 약한 인증을 강한 것처럼 쓰면 오히려 문서 전체가 탄핵된다.
  const disclaimer = [
    "본 기록은 전자문서 서명 과정에서 수집된 기술적 정보를 정리한 것으로,",
    `${BRAND}가 자동 생성합니다. 공적 기관이 발급하는 증명서가 아닙니다.`,
    "",
    "본인확인은 위에 적힌 이메일 주소로 발송한 일회용 인증번호(OTP) 확인에",
    "한하며, 실명 확인 등 신원확인 절차는 수행되지 않았습니다.",
    "",
    "본 기록의 증명력과 문서의 진정성립 여부는 법원이 개별적으로 판단합니다.",
    `${BRAND}는 서명자의 신원이나 문서의 법적 효력을 보증하지 않습니다.`,
  ];
  for (const line of disclaimer) {
    drawText(line, { size: 9, color: line === "" ? MID : MID });
  }

  // 하단 마감선
  drawHRule(DARK, 1);
  drawText(`발급 시각: ${issuedAt}  |  ${BRAND}`, { size: 8, color: LIGHT });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
}
