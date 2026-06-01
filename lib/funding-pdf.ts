// 자금조달계획서 PDF 생성 — 별지 제1호의3서식 (주택) / 제1호의4서식 (토지) 공식 양식 레이아웃
// Node.js 서버 사이드 전용 (fs 사용)

import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import path from "path";
import type {
  FundingStep1Data,
  FundingExtractResult,
  HousingFundingItems,
  LandFundingItems,
  LandParcel,
} from "./funding-types";
import { SELF_FUND_KEYS, LOAN_KEYS } from "./funding-types";

// public/fonts 에 두어야 Vercel 서버 번들에 포함됨
const FONT_PATH = path.join(process.cwd(), "public", "fonts", "NotoSansKR-Regular.otf");
let cachedFontBytes: Uint8Array | null = null;

async function loadFontBytes(): Promise<Uint8Array | null> {
  if (cachedFontBytes) return cachedFontBytes;
  try {
    cachedFontBytes = new Uint8Array(await readFile(FONT_PATH));
    return cachedFontBytes;
  } catch (err) {
    console.error("[funding-pdf] 폰트 로드 실패:", err);
    return null;
  }
}

// A4
const PW = 595.28;
const PH = 841.89;
const ML = 30; // margin left
const MR = 30; // margin right
const MT = 25; // margin top
const CW = PW - ML - MR; // content width

const BLACK = rgb(0, 0, 0);
const GRAY_LIGHT = rgb(0.88, 0.88, 0.88); // 배경 회색
const GRAY_DARK = rgb(0.3, 0.3, 0.3);
const WHITE = rgb(1, 1, 1);

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined || v === 0) return "-";
  return v.toLocaleString("ko-KR");
}

function fmtRequired(v: number): string {
  return v.toLocaleString("ko-KR");
}

function maskId(front: string, back: string): string {
  return `${front || ""}-${back ? back.charAt(0) + "******" : "*******"}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}년  ${d.getMonth() + 1}월  ${d.getDate()}일`;
}

// ── 저수준 그리기 헬퍼 ──────────────────────────────────────

interface Ctx {
  page: PDFPage;
  font: PDFFont;
}

function txt(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  color = BLACK,
  maxWidth?: number
) {
  if (!text) return;
  // 긴 텍스트 말줄임
  let t = text;
  if (maxWidth) {
    while (t.length > 1 && ctx.font.widthOfTextAtSize(t, size) > maxWidth) {
      t = t.slice(0, -1);
    }
  }
  ctx.page.drawText(t, { x, y, size, font: ctx.font, color });
}

function centerTxt(ctx: Ctx, text: string, x: number, w: number, y: number, size: number, color = BLACK) {
  const tw = ctx.font.widthOfTextAtSize(text, size);
  const nx = x + Math.max(0, (w - tw) / 2);
  ctx.page.drawText(text, { x: nx, y, size, font: ctx.font, color });
}

function rightTxt(ctx: Ctx, text: string, x: number, w: number, y: number, size: number, color = BLACK) {
  const tw = ctx.font.widthOfTextAtSize(text, size);
  const nx = x + w - tw - 2;
  ctx.page.drawText(text, { x: Math.max(x, nx), y, size, font: ctx.font, color });
}

function rect(page: PDFPage, x: number, y: number, w: number, h: number, fill?: ReturnType<typeof rgb>, strokeColor?: ReturnType<typeof rgb>, thickness = 0.5) {
  if (fill) {
    page.drawRectangle({ x, y, width: w, height: h, color: fill, borderWidth: 0 });
  }
  if (strokeColor !== undefined) {
    page.drawRectangle({ x, y, width: w, height: h, borderColor: strokeColor, borderWidth: thickness, color: undefined });
  }
}

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: BLACK });
}

// ── 셀 그리기 (외곽선 + 배경 + 텍스트) ──────────────────────

function cell(
  ctx: Ctx,
  x: number, y: number, w: number, h: number,
  text: string,
  opts?: {
    size?: number;
    align?: "left" | "center" | "right";
    bg?: ReturnType<typeof rgb>;
    color?: ReturnType<typeof rgb>;
    border?: boolean;
    paddingX?: number;
    bold?: boolean;
  }
) {
  const {
    size = 7,
    align = "left",
    bg,
    color = BLACK,
    border = true,
    paddingX = 2,
  } = opts ?? {};

  if (bg) rect(ctx.page, x, y, w, h, bg);
  if (border) rect(ctx.page, x, y, w, h, undefined, BLACK, 0.4);

  if (!text) return;
  const ty = y + h / 2 - size / 2 + 0.5;
  if (align === "center") {
    centerTxt(ctx, text, x + paddingX, w - paddingX * 2, ty, size, color);
  } else if (align === "right") {
    rightTxt(ctx, text, x, w - paddingX, ty, size, color);
  } else {
    txt(ctx, text, x + paddingX, ty, size, color, w - paddingX * 2);
  }
}

// ══════════════════════════════════════════════════════════════
// 주택 서식 (별지 제1호의3서식)
// ══════════════════════════════════════════════════════════════
async function buildHousingPdf(
  pdfDoc: PDFDocument,
  font: PDFFont,
  step1: FundingStep1Data,
  result: FundingExtractResult
) {
  if (step1.formType !== "housing") return;
  const base = step1.baseInfo;
  const items = result.items as HousingFundingItems;

  const selfTotal =
    SELF_FUND_KEYS.reduce((s, k) => {
      const v = (items as HousingFundingItems)[k];
      return s + (typeof v === "number" ? v : 0);
    }, 0);
  const loanTotal =
    LOAN_KEYS.reduce((s, k) => {
      const v = (items as HousingFundingItems)[k];
      return s + (typeof v === "number" ? v : 0);
    }, 0);
  const grandTotal = selfTotal + loanTotal;
  const tradeAmount = base.tradeAmount ?? 0;

  const page = pdfDoc.addPage([PW, PH]);
  const ctx: Ctx = { page, font };

  // ── 헤더 ──
  let cy = PH - MT;

  // 상단 법령 텍스트
  txt(ctx, "■ 부동산 거래신고 등에 관한 법률 시행규칙 [별지 제1호의3서식] <개정 2026. 2. 6.>", ML, cy, 5.5, GRAY_DARK);
  cy -= 13;

  // 제목
  const titleSize = 16;
  const titleTxt = "주택취득자금 조달 및 입주계획서";
  const titleW = font.widthOfTextAtSize(titleTxt, titleSize);
  txt(ctx, titleTxt, (PW - titleW) / 2, cy, titleSize);
  cy -= 10;

  // 부제
  txt(ctx, "※ 색상이 어두운 난은 신청인이 적지 않으며, [  ]에는 해당되는 곳에 √표시를 합니다.", ML, cy, 6, GRAY_DARK);
  cy -= 9;

  // 접수번호/일시/처리기간 행
  const hdrH = 14;
  const col1W = CW * 0.33;
  const col2W = CW * 0.33;
  const col3W = CW - col1W - col2W;
  cell(ctx, ML, cy - hdrH, col1W, hdrH, "접수번호", { size: 7, align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + col1W, cy - hdrH, col2W, hdrH, "접수일시", { size: 7, align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + col1W + col2W, cy - hdrH, col3W, hdrH, "처리기간", { size: 7, align: "center", bg: GRAY_LIGHT });
  cy -= hdrH;

  // ── 제출인 (인적사항) ──
  const rowH = 13;
  const labelW = 28;
  const idW = CW - labelW;

  // 제출인 행 1 (성명 / 주민등록번호)
  cell(ctx, ML, cy - rowH * 2, labelW, rowH * 2, "제출인\n(매수인)", { size: 7, align: "center", bg: GRAY_LIGHT });
  const nameColW = idW * 0.45;
  const idColW = idW - nameColW;
  cell(ctx, ML + labelW, cy - rowH, nameColW, rowH, "성명(법인명)", { size: 6.5, bg: GRAY_LIGHT });
  cell(ctx, ML + labelW + nameColW, cy - rowH, idColW, rowH, "주민등록번호(법인ㆍ외국인등록번호)", { size: 6.5, bg: GRAY_LIGHT });
  cy -= rowH;
  // 값
  cell(ctx, ML + labelW, cy - rowH, nameColW, rowH, base.name || "", { size: 8 });
  cell(ctx, ML + labelW + nameColW, cy - rowH, idColW, rowH, maskId(base.idNumberFront, base.idNumberBack), { size: 8 });
  cy -= rowH;

  // 제출인 행 2 (주소 / 전화번호)
  const addrColW = idW * 0.62;
  const telColW = idW - addrColW;
  cell(ctx, ML + labelW, cy - rowH, addrColW, rowH, "주소(법인소재지)", { size: 6.5, bg: GRAY_LIGHT });
  cell(ctx, ML + labelW + addrColW, cy - rowH, telColW, rowH, "(휴대)전화번호", { size: 6.5, bg: GRAY_LIGHT });
  cy -= rowH;
  cell(ctx, ML + labelW, cy - rowH, addrColW, rowH, base.address || "", { size: 7.5, paddingX: 3 });
  cell(ctx, ML + labelW + addrColW, cy - rowH, telColW, rowH, base.phone || "", { size: 7.5 });
  cy -= rowH;

  cy -= 2;

  // ── ① 자금조달계획 ──
  const sectionLabelW = 22;
  const subLabelW = 20;
  const bigSectionH = 0; // 계산 후 결정

  // 자금조달계획 섹션 시작 y 저장
  const sectionStartY = cy;

  // ── 자기자금 항목들 ──
  const selfRows: { label: string; value: string; note?: string }[] = [
    { label: "② 금융기관 예금액", value: fmt(items.deposit) + "  원" },
    { label: "③ 주식ㆍ채권 매각대금", value: fmt(items.stocks) + "  원" },
    { label: "④ 증여ㆍ상속", value: (items.gift || items.inheritance) ? (fmt((items.gift ?? 0) + (items.inheritance ?? 0)) + "  원") : "-", note: items.giftTaxFiled === true ? "증여세 신고: 완료" : items.giftTaxFiled === false ? "증여세 신고: 미신고" : undefined },
    { label: "⑤ 현금 등 그 밖의 자금", value: fmt(items.cash) + "  원" },
    { label: "⑥ 부동산 처분대금 등", value: fmt(items.realEstateSale) + "  원" },
  ];

  // 차입금 항목들
  const loanRows: { label: string; value: string; note?: string }[] = [
    { label: "⑧ 금융기관 대출액 합계", value: fmt(items.mortgageLoan !== null || items.creditLoan !== null || items.businessLoan !== null ? ((items.mortgageLoan ?? 0) + (items.creditLoan ?? 0) + (items.businessLoan ?? 0)) : null) + "  원", note: items.mortgageLoan ? `주택담보: ${fmt(items.mortgageLoan)}원` : undefined },
    { label: "⑨ 취득주택의 임대보증금", value: fmt(items.rentalDeposit) + "  원" },
    { label: "⑩ 회사지원금ㆍ사채", value: fmt(items.companySupportOrPrivateLoan) + "  원" },
    { label: "⑪ 그 밖의 차입금", value: fmt(items.otherLoan) + "  원", note: items.otherLoanRelation ? `관계: ${items.otherLoanRelation}` : undefined },
  ];

  const itemRowH = 14;
  const subtotalRowH = 13;
  const mainColW = CW - sectionLabelW - subLabelW;
  const valueColW = mainColW * 0.38;
  const descColW = mainColW - valueColW;

  // ① 라벨 (전체 자금조달 섹션)
  const selfSectionH = selfRows.length * itemRowH + subtotalRowH;
  const loanSectionH = loanRows.length * itemRowH + subtotalRowH;
  const totalSectionH = selfSectionH + loanSectionH;

  // ① 자금조달계획 라벨
  cell(ctx, ML, cy - totalSectionH, sectionLabelW, totalSectionH, "① 자금\n조달계획", { size: 7, align: "center", bg: GRAY_LIGHT });

  // 자기자금 라벨
  cell(ctx, ML + sectionLabelW, cy - selfSectionH, subLabelW, selfSectionH, "자기\n자금", { size: 7, align: "center", bg: GRAY_LIGHT });

  // 자기자금 행들
  let ry = cy;
  for (const row of selfRows) {
    cell(ctx, ML + sectionLabelW + subLabelW, ry - itemRowH, descColW, itemRowH, row.label + (row.note ? `  (${row.note})` : ""), { size: 7 });
    cell(ctx, ML + sectionLabelW + subLabelW + descColW, ry - itemRowH, valueColW, itemRowH, row.value, { size: 7.5, align: "right" });
    ry -= itemRowH;
  }
  // ⑦ 소계
  cell(ctx, ML + sectionLabelW + subLabelW, ry - subtotalRowH, descColW, subtotalRowH, "⑦ 소계", { size: 7, bg: GRAY_LIGHT });
  cell(ctx, ML + sectionLabelW + subLabelW + descColW, ry - subtotalRowH, valueColW, subtotalRowH, fmtRequired(selfTotal) + "  원", { size: 7.5, align: "right", bg: GRAY_LIGHT });
  ry -= subtotalRowH;

  // 차입금 라벨
  cell(ctx, ML + sectionLabelW, ry - loanSectionH, subLabelW, loanSectionH, "차입금 등", { size: 7, align: "center", bg: GRAY_LIGHT });

  // 차입금 행들
  for (const row of loanRows) {
    cell(ctx, ML + sectionLabelW + subLabelW, ry - itemRowH, descColW, itemRowH, row.label + (row.note ? `  (${row.note})` : ""), { size: 7 });
    cell(ctx, ML + sectionLabelW + subLabelW + descColW, ry - itemRowH, valueColW, itemRowH, row.value, { size: 7.5, align: "right" });
    ry -= itemRowH;
  }
  // ⑫ 소계
  cell(ctx, ML + sectionLabelW + subLabelW, ry - subtotalRowH, descColW, subtotalRowH, "⑫ 소계", { size: 7, bg: GRAY_LIGHT });
  cell(ctx, ML + sectionLabelW + subLabelW + descColW, ry - subtotalRowH, valueColW, subtotalRowH, fmtRequired(loanTotal) + "  원", { size: 7.5, align: "right", bg: GRAY_LIGHT });
  ry -= subtotalRowH;

  cy = ry;

  // ⑬ 합계
  const totalRowH = 13;
  cell(ctx, ML, cy - totalRowH, sectionLabelW + subLabelW, totalRowH, "⑬ 합계", { size: 7, align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + sectionLabelW + subLabelW, cy - totalRowH, descColW, totalRowH, "", { size: 7 });
  cell(ctx, ML + sectionLabelW + subLabelW + descColW, cy - totalRowH, valueColW, totalRowH, fmtRequired(grandTotal) + "  원", { size: 7.5, align: "right" });
  cy -= totalRowH;

  // ── ⑭ 조달자금 지급방식 ──
  const payRowH = 12;
  const payRows = [
    { label: "총 거래금액", value: fmtRequired(tradeAmount) + "  원" },
    { label: "⑮ 계좌이체 금액", value: fmt(items.cashPayment) + "  원" },
    { label: "⑯ 보증금ㆍ대출 승계 금액", value: fmt(items.depositSuccession) + "  원" },
    { label: "⑰ 현금 및 그 밖의 지급방식 금액", value: fmt(items.transferAmount) + "  원" },
  ];
  const payLabelW = sectionLabelW + subLabelW;
  cell(ctx, ML, cy - payRowH * payRows.length, payLabelW, payRowH * payRows.length, "⑭ 조달자금\n지급방식", { size: 7, align: "center", bg: GRAY_LIGHT });
  for (const row of payRows) {
    cell(ctx, ML + payLabelW, cy - payRowH, descColW, payRowH, row.label, { size: 7 });
    cell(ctx, ML + payLabelW + descColW, cy - payRowH, valueColW, payRowH, row.value, { size: 7.5, align: "right" });
    cy -= payRowH;
  }

  // ── ⑱ 입주 계획 ──
  const moveInH = 14;
  cell(ctx, ML, cy - moveInH, payLabelW, moveInH, "⑱ 입주 계획", { size: 7, align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + payLabelW, cy - moveInH, mainColW, moveInH, items.moveInPlan ? `입주 예정 시기: ${items.moveInPlan}` : "[ ] 본인입주   [ ] 본인 외 가족입주   [ ] 임대(전ㆍ월세)   [ ] 그 밖의 경우", { size: 7 });
  cy -= moveInH;

  cy -= 8;

  // ── 제출 문구 ──
  txt(ctx, "「부동산 거래신고 등에 관한 법률 시행령」 별표 1 제2호나목에 따라 위와 같이 주택취득자금 조달 및 입주계획서를 제출합니다.", ML, cy, 6.5, GRAY_DARK);
  cy -= 14;

  // 날짜
  const dateW = font.widthOfTextAtSize(todayStr(), 9);
  txt(ctx, todayStr(), (PW - dateW) / 2, cy, 9);
  cy -= 16;

  // 제출인 서명
  const sigTxt = `제출인       ${base.name || ""}           (서명 또는 인)`;
  const sigW = font.widthOfTextAtSize(sigTxt, 9);
  txt(ctx, sigTxt, (PW - sigW) / 2, cy, 9);
  cy -= 14;

  // 귀하
  const guihaTxt = "시장ㆍ군수ㆍ구청장 귀하";
  txt(ctx, guihaTxt, ML, cy, 9);
}

// ══════════════════════════════════════════════════════════════
// 토지 서식 (별지 제1호의4서식)
// ══════════════════════════════════════════════════════════════
async function buildLandPdf(
  pdfDoc: PDFDocument,
  font: PDFFont,
  step1: FundingStep1Data,
  result: FundingExtractResult
) {
  if (step1.formType !== "land") return;
  const base = step1.baseInfo;
  const items = result.items as LandFundingItems;

  const selfTotal = SELF_FUND_KEYS.reduce((s, k) => {
    const v = (items as HousingFundingItems)[k];
    return s + (typeof v === "number" ? v : 0);
  }, 0);
  const loanTotal = LOAN_KEYS.reduce((s, k) => {
    const v = (items as HousingFundingItems)[k];
    return s + (typeof v === "number" ? v : 0);
  }, 0);
  const grandTotal = selfTotal + loanTotal;
  const tradeTotal = (base.landParcels || []).reduce(
    (s, p) => s + (typeof p.tradeAmount === "number" ? p.tradeAmount : 0), 0
  );

  const page = pdfDoc.addPage([PW, PH]);
  const ctx: Ctx = { page, font };

  let cy = PH - MT;

  txt(ctx, "■ 부동산 거래신고 등에 관한 법률 시행규칙 [별지 제1호의4서식]", ML, cy, 5.5, GRAY_DARK);
  cy -= 13;

  const titleTxt = "토지취득자금 조달계획서";
  const titleW = font.widthOfTextAtSize(titleTxt, 16);
  txt(ctx, titleTxt, (PW - titleW) / 2, cy, 16);
  cy -= 10;

  txt(ctx, "※ 색상이 어두운 난은 신청인이 적지 않으며, [  ]에는 해당되는 곳에 √표시를 합니다.", ML, cy, 6, GRAY_DARK);
  cy -= 9;

  // 접수번호 행
  const hdrH = 14;
  cell(ctx, ML, cy - hdrH, CW * 0.33, hdrH, "접수번호", { size: 7, align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + CW * 0.33, cy - hdrH, CW * 0.33, hdrH, "접수일시", { size: 7, align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + CW * 0.66, cy - hdrH, CW * 0.34, hdrH, "처리기간", { size: 7, align: "center", bg: GRAY_LIGHT });
  cy -= hdrH;

  // 제출인
  const rowH = 13;
  const labelW = 28;
  const idW = CW - labelW;
  cell(ctx, ML, cy - rowH * 2, labelW, rowH * 2, "제출인\n(매수인)", { size: 7, align: "center", bg: GRAY_LIGHT });
  const nameColW = idW * 0.45;
  const idColW = idW - nameColW;
  cell(ctx, ML + labelW, cy - rowH, nameColW, rowH, "성명(법인명)", { size: 6.5, bg: GRAY_LIGHT });
  cell(ctx, ML + labelW + nameColW, cy - rowH, idColW, rowH, "주민등록번호", { size: 6.5, bg: GRAY_LIGHT });
  cy -= rowH;
  cell(ctx, ML + labelW, cy - rowH, nameColW, rowH, base.name || "", { size: 8 });
  cell(ctx, ML + labelW + nameColW, cy - rowH, idColW, rowH, maskId(base.idNumberFront, base.idNumberBack), { size: 8 });
  cy -= rowH;
  const addrColW = idW * 0.62;
  const telColW = idW - addrColW;
  cell(ctx, ML + labelW, cy - rowH, addrColW, rowH, "주소(법인소재지)", { size: 6.5, bg: GRAY_LIGHT });
  cell(ctx, ML + labelW + addrColW, cy - rowH, telColW, rowH, "(휴대)전화번호", { size: 6.5, bg: GRAY_LIGHT });
  cy -= rowH;
  cell(ctx, ML + labelW, cy - rowH, addrColW, rowH, base.address || "", { size: 7.5, paddingX: 3 });
  cell(ctx, ML + labelW + addrColW, cy - rowH, telColW, rowH, base.phone || "", { size: 7.5 });
  cy -= rowH;
  cy -= 2;

  // 취득 토지 현황 표
  const sectionLabelW = 22;
  const subLabelW = 20;
  const mainColW = CW - sectionLabelW - subLabelW;
  const locColW = mainColW * 0.5;
  const areaColW = mainColW * 0.2;
  const amtColW = mainColW - locColW - areaColW;

  const parcels = (base.landParcels || []).slice(0, 3);
  const parcelRowH = 13;
  const parcelSectionH = (parcels.length + 1) * parcelRowH; // +1 헤더
  cell(ctx, ML, cy - parcelSectionH, sectionLabelW + subLabelW, parcelSectionH, "취득 토지 현황", { size: 7, align: "center", bg: GRAY_LIGHT });
  // 헤더
  cell(ctx, ML + sectionLabelW + subLabelW, cy - parcelRowH, locColW, parcelRowH, "소재지", { size: 7, align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + sectionLabelW + subLabelW + locColW, cy - parcelRowH, areaColW, parcelRowH, "면적", { size: 7, align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + sectionLabelW + subLabelW + locColW + areaColW, cy - parcelRowH, amtColW, parcelRowH, "거래금액(원)", { size: 7, align: "center", bg: GRAY_LIGHT });
  cy -= parcelRowH;
  for (let i = 0; i < Math.max(parcels.length, 1); i++) {
    const p = parcels[i];
    cell(ctx, ML + sectionLabelW + subLabelW, cy - parcelRowH, locColW, parcelRowH, p?.location || "", { size: 7 });
    cell(ctx, ML + sectionLabelW + subLabelW + locColW, cy - parcelRowH, areaColW, parcelRowH, p?.area || "", { size: 7, align: "center" });
    cell(ctx, ML + sectionLabelW + subLabelW + locColW + areaColW, cy - parcelRowH, amtColW, parcelRowH, fmt(p?.tradeAmount) + "  원", { size: 7, align: "right" });
    cy -= parcelRowH;
  }
  cy -= 2;

  // 자금조달
  const itemRowH = 14;
  const subtotalRowH = 13;
  const valueColW = mainColW * 0.38;
  const descColW = mainColW - valueColW;

  const selfRows = [
    { label: "② 금융기관 예금액", value: fmt(items.deposit) + "  원" },
    { label: "③ 주식ㆍ채권 매각대금", value: fmt(items.stocks) + "  원" },
    { label: "④ 증여ㆍ상속", value: fmt((items.gift ?? 0) + (items.inheritance ?? 0)) + "  원" },
    { label: "⑤ 현금 등 그 밖의 자금", value: fmt(items.cash) + "  원" },
    { label: "⑥ 부동산 처분대금 등", value: fmt(items.realEstateSale) + "  원" },
  ];
  const loanRows = [
    { label: "⑧ 금융기관 대출액 합계", value: fmt((items.mortgageLoan ?? 0) + (items.creditLoan ?? 0) + (items.businessLoan ?? 0)) + "  원" },
    { label: "⑨ 취득주택의 임대보증금", value: fmt(items.rentalDeposit) + "  원" },
    { label: "⑩ 회사지원금ㆍ사채", value: fmt(items.companySupportOrPrivateLoan) + "  원" },
    { label: "⑪ 그 밖의 차입금", value: fmt(items.otherLoan) + "  원" + (items.otherLoanRelation ? `  (${items.otherLoanRelation})` : "") },
    { label: "토지보상금", value: fmt(items.landCompensation) + "  원" },
  ];

  const selfSectionH = selfRows.length * itemRowH + subtotalRowH;
  const loanSectionH = loanRows.length * itemRowH + subtotalRowH;

  cell(ctx, ML, cy - selfSectionH - loanSectionH, sectionLabelW, selfSectionH + loanSectionH, "① 자금\n조달계획", { size: 7, align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + sectionLabelW, cy - selfSectionH, subLabelW, selfSectionH, "자기\n자금", { size: 7, align: "center", bg: GRAY_LIGHT });

  let ry = cy;
  for (const row of selfRows) {
    cell(ctx, ML + sectionLabelW + subLabelW, ry - itemRowH, descColW, itemRowH, row.label, { size: 7 });
    cell(ctx, ML + sectionLabelW + subLabelW + descColW, ry - itemRowH, valueColW, itemRowH, row.value, { size: 7.5, align: "right" });
    ry -= itemRowH;
  }
  cell(ctx, ML + sectionLabelW + subLabelW, ry - subtotalRowH, descColW, subtotalRowH, "⑦ 소계", { size: 7, bg: GRAY_LIGHT });
  cell(ctx, ML + sectionLabelW + subLabelW + descColW, ry - subtotalRowH, valueColW, subtotalRowH, fmtRequired(selfTotal) + "  원", { size: 7.5, align: "right", bg: GRAY_LIGHT });
  ry -= subtotalRowH;

  cell(ctx, ML + sectionLabelW, ry - loanSectionH, subLabelW, loanSectionH, "차입금 등", { size: 7, align: "center", bg: GRAY_LIGHT });
  for (const row of loanRows) {
    cell(ctx, ML + sectionLabelW + subLabelW, ry - itemRowH, descColW, itemRowH, row.label, { size: 7 });
    cell(ctx, ML + sectionLabelW + subLabelW + descColW, ry - itemRowH, valueColW, itemRowH, row.value, { size: 7.5, align: "right" });
    ry -= itemRowH;
  }
  cell(ctx, ML + sectionLabelW + subLabelW, ry - subtotalRowH, descColW, subtotalRowH, "⑫ 소계", { size: 7, bg: GRAY_LIGHT });
  cell(ctx, ML + sectionLabelW + subLabelW + descColW, ry - subtotalRowH, valueColW, subtotalRowH, fmtRequired(loanTotal) + "  원", { size: 7.5, align: "right", bg: GRAY_LIGHT });
  ry -= subtotalRowH;

  cy = ry;

  // ⑬ 합계
  cell(ctx, ML, cy - subtotalRowH, sectionLabelW + subLabelW, subtotalRowH, "⑬ 합계", { size: 7, align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + sectionLabelW + subLabelW, cy - subtotalRowH, descColW, subtotalRowH, "", { size: 7 });
  cell(ctx, ML + sectionLabelW + subLabelW + descColW, cy - subtotalRowH, valueColW, subtotalRowH, fmtRequired(grandTotal) + "  원", { size: 7.5, align: "right" });
  cy -= subtotalRowH;

  // 토지이용계획
  const luH = 14;
  cell(ctx, ML, cy - luH, sectionLabelW + subLabelW, luH, "토지이용계획", { size: 7, align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + sectionLabelW + subLabelW, cy - luH, mainColW, luH, items.landUsePlan || "", { size: 7 });
  cy -= luH;

  cy -= 8;

  txt(ctx, "「부동산 거래신고 등에 관한 법률 시행령」에 따라 위와 같이 토지취득자금 조달계획서를 제출합니다.", ML, cy, 6.5, GRAY_DARK);
  cy -= 14;

  const dateW = font.widthOfTextAtSize(todayStr(), 9);
  txt(ctx, todayStr(), (PW - dateW) / 2, cy, 9);
  cy -= 16;

  const sigTxt = `제출인       ${base.name || ""}           (서명 또는 인)`;
  const sigW = font.widthOfTextAtSize(sigTxt, 9);
  txt(ctx, sigTxt, (PW - sigW) / 2, cy, 9);
  cy -= 14;

  txt(ctx, "시장ㆍ군수ㆍ구청장 귀하", ML, cy, 9);
}

// ── 공개 함수 ──────────────────────────────────────────────────

export async function generateFundingPlanPdf(
  step1: FundingStep1Data,
  result: FundingExtractResult
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

  if (step1.formType === "housing") {
    await buildHousingPdf(pdfDoc, font, step1, result);
  } else {
    await buildLandPdf(pdfDoc, font, step1, result);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
}
