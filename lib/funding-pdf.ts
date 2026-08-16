// 자금조달계획서 PDF 생성
// 주택: 공식 원본 PDF(housing-form.pdf)를 템플릿으로 로드한 뒤 데이터 오버레이
// 토지: pdf-lib으로 직접 생성 (원본 PDF 없음)
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

// 🚨🚨 한글 폰트는 **TTF** 를 써야 한다. NotoSansKR **OTF(CFF)** 는 pdf-lib(fontkit)이
//   제대로 임베드하지 못해, subset:false 로도 **한글이 엉뚱한 한자로 깨진다.**
//   (실측: 성명 "홍길동" → "唉", 주소 → "旭 … 埦123". 배경 양식지의 한글은 원본 PDF 라
//    멀쩡하고 우리가 채워 넣는 값만 깨지기 때문에 눈에 잘 띄지 않았다.)
//   NanumGothic 은 SIL OFL 이라 임베드·재배포가 자유롭다.
const FONT_PATH = path.join(process.cwd(), "public", "fonts", "NanumGothic-Regular.ttf");
const HOUSING_TEMPLATE = path.join(process.cwd(), "public", "forms", "housing-form.pdf");

// Vercel 서버리스 함수에서는 public/ 파일에 fs 접근 불가 → HTTP fallback
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

let cachedFontBytes: Uint8Array | null = null;
async function loadFont(): Promise<Uint8Array | null> {
  if (cachedFontBytes) return cachedFontBytes;
  // 1) 파일 시스템 시도 (로컬 개발)
  try {
    cachedFontBytes = new Uint8Array(await readFile(FONT_PATH));
    return cachedFontBytes;
  } catch { /* ignored */ }
  // 2) HTTP fallback (Vercel 프로덕션)
  try {
    cachedFontBytes = await fetchBytes(`${BASE_URL}/fonts/NotoSansKR-Regular.otf`);
    return cachedFontBytes;
  } catch (e) {
    console.error("[funding-pdf] 폰트 로드 최종 실패:", e);
    return null;
  }
}

let cachedTemplateBytes: Uint8Array | null = null;
async function loadTemplate(): Promise<Uint8Array | null> {
  if (cachedTemplateBytes) return cachedTemplateBytes;
  try {
    cachedTemplateBytes = new Uint8Array(await readFile(HOUSING_TEMPLATE));
    return cachedTemplateBytes;
  } catch { /* ignored */ }
  try {
    cachedTemplateBytes = await fetchBytes(`${BASE_URL}/forms/housing-form.pdf`);
    return cachedTemplateBytes;
  } catch (e) {
    console.error("[funding-pdf] 주택 템플릿 로드 최종 실패:", e);
    return null;
  }
}

const BLACK = rgb(0, 0, 0);
const DARK = rgb(0.1, 0.1, 0.1);

function n(v: number | null | undefined): string {
  if (v == null || v === 0) return "";
  return v.toLocaleString("ko-KR");
}

function maskId(front: string, back: string): string {
  if (!front && !back) return "";
  return `${front}-${back ? back.charAt(0) + "******" : "*******"}`;
}

function today(): { year: string; month: string; day: string } {
  const d = new Date();
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1),
    day: String(d.getDate()),
  };
}

// ── 텍스트 헬퍼 ────────────────────────────────────────────────

interface DrawCtx { page: PDFPage; font: PDFFont }

function drawLeft(ctx: DrawCtx, text: string, x: number, y: number, size: number) {
  if (!text) return;
  ctx.page.drawText(text, { x, y, size, font: ctx.font, color: DARK });
}

function drawRight(ctx: DrawCtx, text: string, xRight: number, y: number, size: number) {
  if (!text) return;
  const w = ctx.font.widthOfTextAtSize(text, size);
  ctx.page.drawText(text, { x: xRight - w, y, size, font: ctx.font, color: DARK });
}

function drawCenter(ctx: DrawCtx, text: string, xLeft: number, xRight: number, y: number, size: number) {
  if (!text) return;
  const w = ctx.font.widthOfTextAtSize(text, size);
  const x = xLeft + (xRight - xLeft - w) / 2;
  ctx.page.drawText(text, { x, y, size, font: ctx.font, color: DARK });
}

// ══════════════════════════════════════════════════════════════════
// 주택 서식 — 원본 PDF 템플릿에 오버레이
// 좌표는 extract-coords-full.mjs로 파악한 실제 위치 기반
// ══════════════════════════════════════════════════════════════════

async function buildHousingOverlay(
  pdfDoc: PDFDocument,
  font: PDFFont,
  step1: FundingStep1Data,
  result: FundingExtractResult,
) {
  if (step1.formType !== "housing") return;
  const base = step1.baseInfo;
  const items = result.items as HousingFundingItems;

  const page = pdfDoc.getPages()[0];
  const ctx: DrawCtx = { page, font };
  const SZ = 8; // 기본 글씨 크기

  // ─── 제출인 ──────────────────────────────────────────────────
  // 성명: 레이블 "성명(법인명)" 오른쪽 빈 칸 (x=165~296, y=716)
  drawLeft(ctx, base.name || "", 165, 716, SZ);
  // 주민등록번호: (x=469~556, y=714)
  drawLeft(ctx, maskId(base.idNumberFront, base.idNumberBack), 469, 714, SZ);
  // 주소: (x=183~356, y=683)
  drawLeft(ctx, base.address || "", 183, 683, SZ);
  // 전화번호: (x=432~556, y=683)
  drawLeft(ctx, base.phone || "", 432, 683, SZ);

  // ─── ① 자금조달계획 ────────────────────────────────────────────
  // 형식: 좌측 컬럼(②④⑥) / 우측 컬럼(③⑤⑦)
  // 좌측 값 → "원"(x=337) 직전 우측정렬, 우측 값 → "원"(x=532) 직전 우측정렬

  // ② 금융기관 예금액 (y=639, 좌)
  drawRight(ctx, n(items.deposit), 333, 639, SZ);

  // ③ 주식·채권·가상화폐 매각대금 (y=639, 우)
  drawRight(ctx, n(items.stocks), 528, 639, SZ);

  // ④ 증여·상속 — 증여(y=573), 상속(y=549) 각각
  if (items.gift) {
    drawRight(ctx, n(items.gift), 328, 573, SZ);
  }
  if (items.inheritance) {
    drawRight(ctx, n(items.inheritance), 328, 549, SZ);
  }

  // ⑤ 현금 등 그 밖의 자금 (y=573, 우) — "원)" 직전 x=526
  drawRight(ctx, n(items.cash), 526, 573, SZ);

  // ⑥ 부동산 처분대금 등 (y=485, 좌) — "원"(x=332) 직전
  drawRight(ctx, n(items.realEstateSale), 328, 485, SZ);

  // ⑦ 소계 (y=475, 우) — 자기자금 합계
  const selfTotal = SELF_FUND_KEYS.reduce((s, k) => {
    const v = (items as HousingFundingItems)[k];
    return s + (typeof v === "number" ? v : 0);
  }, 0);
  if (selfTotal) drawRight(ctx, n(selfTotal), 528, 475, SZ);

  // ─── 차입금 ────────────────────────────────────────────────────
  // ⑧ 금융기관 대출액 합계 — 담보/신용/사업자 각 행
  // 주택담보대출 (y=425)
  drawRight(ctx, n(items.mortgageLoan), 525, 425, SZ);
  // 신용대출 (y=410)
  drawRight(ctx, n(items.creditLoan), 525, 410, SZ);
  // 사업자대출 (y=396)
  drawRight(ctx, n(items.businessLoan), 525, 396, SZ);

  // ⑧ 소계 (y=375, "원" x=263)
  const loanBankTotal = (items.mortgageLoan ?? 0) + (items.creditLoan ?? 0) + (items.businessLoan ?? 0);
  if (loanBankTotal) drawRight(ctx, n(loanBankTotal), 259, 375, SZ);

  // ⑨ 취득주택의 임대보증금 (y=326, 좌 "원" x=337)
  drawRight(ctx, n(items.rentalDeposit), 333, 326, SZ);

  // ⑩ 회사지원금ㆍ사채 — companySupportOrPrivateLoan을 회사지원금 행에 표시 (y=322, 우)
  drawRight(ctx, n(items.companySupportOrPrivateLoan), 526, 322, SZ);

  // ⑪ 그 밖의 차입금 (y=287, 좌)
  drawRight(ctx, n(items.otherLoan), 333, 287, SZ);

  // ⑫ 소계 (y=257, 우) — 차입금 합계
  const loanTotal = LOAN_KEYS.reduce((s, k) => {
    const v = (items as HousingFundingItems)[k];
    return s + (typeof v === "number" ? v : 0);
  }, 0);
  if (loanTotal) drawRight(ctx, n(loanTotal), 528, 257, SZ);

  // ⑬ 합계 (y=243, 우) — 자기자금 + 차입금 총합
  const grandTotal = selfTotal + loanTotal;
  if (grandTotal) drawRight(ctx, n(grandTotal), 528, 243, SZ);

  // ─── ⑭ 조달자금 지급방식 ─────────────────────────────────────
  // "원" 위치 x=497 → 값 우측정렬 x=493
  const tradeAmt = base.tradeAmount ?? 0;
  drawRight(ctx, n(tradeAmt), 493, 223, SZ);          // 총 거래금액
  drawRight(ctx, n(items.cashPayment), 493, 208, SZ); // ⑮ 계좌이체
  drawRight(ctx, n(items.depositSuccession), 493, 193, SZ); // ⑯ 보증금 승계
  drawRight(ctx, n(items.transferAmount), 493, 178, SZ);    // ⑰ 현금 지급

  // ─── ⑱ 입주계획 ──────────────────────────────────────────────
  if (items.moveInPlan) {
    // "입주 예정 시기: ___년 ___월" 영역 텍스트 (y=128)
    drawLeft(ctx, items.moveInPlan, 270, 128, SZ);
  }

  // ─── 날짜 서명 ───────────────────────────────────────────────
  const { year, month, day } = today();
  drawRight(ctx, year, 466, 67, SZ);   // 년 앞
  drawRight(ctx, month, 497, 67, SZ);  // 월 앞
  drawRight(ctx, day, 528, 67, SZ);    // 일 앞
  // 제출인 성명
  drawLeft(ctx, base.name || "", 295, 55, SZ);
}

// ══════════════════════════════════════════════════════════════════
// 토지 서식 — 원본 없으므로 pdf-lib으로 직접 생성 (NotoSansKR 적용)
// ══════════════════════════════════════════════════════════════════

const PW = 595.28;
const PH = 841.89;
const ML = 30;
const MR = 30;
const MT = 25;
const CW = PW - ML - MR;
const GRAY_LIGHT = rgb(0.88, 0.88, 0.88);
const WHITE = rgb(1, 1, 1);

function fmt(v: number | null | undefined): string {
  if (v == null || v === 0) return "-";
  return v.toLocaleString("ko-KR");
}

function cell(
  ctx: DrawCtx,
  x: number, y: number, w: number, h: number,
  text: string,
  opts?: { size?: number; align?: "left" | "center" | "right"; bg?: ReturnType<typeof rgb>; paddingX?: number },
) {
  const { size = 7, align = "left", bg, paddingX = 2 } = opts ?? {};
  if (bg) {
    ctx.page.drawRectangle({ x, y, width: w, height: h, color: bg, borderWidth: 0 });
  }
  ctx.page.drawRectangle({ x, y, width: w, height: h, borderColor: BLACK, borderWidth: 0.4, color: undefined });
  if (!text) return;
  const ty = y + h / 2 - size / 2 + 0.5;
  const maxW = w - paddingX * 2;
  let t = text;
  while (t.length > 1 && ctx.font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -1);
  if (align === "center") {
    const tw = ctx.font.widthOfTextAtSize(t, size);
    ctx.page.drawText(t, { x: x + paddingX + Math.max(0, (maxW - tw) / 2), y: ty, size, font: ctx.font, color: BLACK });
  } else if (align === "right") {
    const tw = ctx.font.widthOfTextAtSize(t, size);
    ctx.page.drawText(t, { x: x + w - paddingX - tw, y: ty, size, font: ctx.font, color: BLACK });
  } else {
    ctx.page.drawText(t, { x: x + paddingX, y: ty, size, font: ctx.font, color: BLACK });
  }
}

async function buildLandPdf(
  pdfDoc: PDFDocument,
  font: PDFFont,
  step1: FundingStep1Data,
  result: FundingExtractResult,
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

  const page = pdfDoc.addPage([PW, PH]);
  const ctx: DrawCtx = { page, font };
  let cy = PH - MT;

  const txt = (text: string, x: number, y: number, size: number, color = BLACK) => {
    if (!text) return;
    ctx.page.drawText(text, { x, y, size, font, color });
  };

  txt("■ 부동산 거래신고 등에 관한 법률 시행규칙 [별지 제1호의4서식]", ML, cy, 5.5, rgb(0.3, 0.3, 0.3));
  cy -= 13;

  const titleTxt = "토지취득자금 조달 및 토지이용계획서";
  const titleW = font.widthOfTextAtSize(titleTxt, 16);
  txt(titleTxt, (PW - titleW) / 2, cy, 16);
  cy -= 10;

  txt("※ 색상이 어두운 난은 신청인이 적지 않으며, [ ]에는 해당되는 곳에 √표시를 합니다.", ML, cy, 6, rgb(0.3, 0.3, 0.3));
  cy -= 9;

  // 접수번호 행
  const hdrH = 14;
  cell(ctx, ML, cy - hdrH, CW * 0.33, hdrH, "접수번호", { align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + CW * 0.33, cy - hdrH, CW * 0.33, hdrH, "접수일시", { align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + CW * 0.66, cy - hdrH, CW * 0.34, hdrH, "처리기간", { align: "center", bg: GRAY_LIGHT });
  cy -= hdrH;

  // 제출인
  const rowH = 13;
  const labelW = 28;
  const idW = CW - labelW;
  cell(ctx, ML, cy - rowH * 2, labelW, rowH * 2, "제출인\n(매수인)", { align: "center", bg: GRAY_LIGHT });
  const nameColW = idW * 0.45;
  const idColW = idW - nameColW;
  cell(ctx, ML + labelW, cy - rowH, nameColW, rowH, "성명(법인명)", { size: 6.5, bg: GRAY_LIGHT });
  cell(ctx, ML + labelW + nameColW, cy - rowH, idColW, rowH, "주민등록번호(법인ㆍ외국인등록번호)", { size: 6.5, bg: GRAY_LIGHT });
  cy -= rowH;
  cell(ctx, ML + labelW, cy - rowH, nameColW, rowH, base.name || "");
  cell(ctx, ML + labelW + nameColW, cy - rowH, idColW, rowH, maskId(base.idNumberFront, base.idNumberBack));
  cy -= rowH;
  const addrColW = idW * 0.62;
  const telColW = idW - addrColW;
  cell(ctx, ML + labelW, cy - rowH, addrColW, rowH, "주소(법인소재지)", { size: 6.5, bg: GRAY_LIGHT });
  cell(ctx, ML + labelW + addrColW, cy - rowH, telColW, rowH, "(휴대)전화번호", { size: 6.5, bg: GRAY_LIGHT });
  cy -= rowH;
  cell(ctx, ML + labelW, cy - rowH, addrColW, rowH, base.address || "", { size: 7.5 });
  cell(ctx, ML + labelW + addrColW, cy - rowH, telColW, rowH, base.phone || "", { size: 7.5 });
  cy -= rowH;
  cy -= 2;

  // 취득 토지 현황
  const sLW = 22, subLW = 20;
  const mainColW = CW - sLW - subLW;
  const locW = mainColW * 0.5, areaW = mainColW * 0.2, amtW = mainColW - locW - areaW;
  const parcels = (base.landParcels || []).slice(0, 3);
  const parcelH = 13;
  const parcelSH = (parcels.length + 1) * parcelH;
  cell(ctx, ML, cy - parcelSH, sLW + subLW, parcelSH, "취득 토지 현황", { align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + sLW + subLW, cy - parcelH, locW, parcelH, "소재지", { align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + sLW + subLW + locW, cy - parcelH, areaW, parcelH, "면적", { align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + sLW + subLW + locW + areaW, cy - parcelH, amtW, parcelH, "거래금액(원)", { align: "center", bg: GRAY_LIGHT });
  cy -= parcelH;
  for (let i = 0; i < Math.max(parcels.length, 1); i++) {
    const p = parcels[i];
    cell(ctx, ML + sLW + subLW, cy - parcelH, locW, parcelH, p?.location || "");
    cell(ctx, ML + sLW + subLW + locW, cy - parcelH, areaW, parcelH, p?.area || "", { align: "center" });
    cell(ctx, ML + sLW + subLW + locW + areaW, cy - parcelH, amtW, parcelH, p?.tradeAmount ? fmt(p.tradeAmount) + " 원" : "", { align: "right" });
    cy -= parcelH;
  }
  cy -= 2;

  // 자금조달계획 (단일 컬럼)
  const itemH = 14, subH = 13;
  const valW = mainColW * 0.38, descW = mainColW - valW;
  const selfRows = [
    { label: "② 금융기관 예금액", v: items.deposit },
    { label: "③ 주식ㆍ채권 매각대금", v: items.stocks },
    { label: "④ 증여ㆍ상속", v: (items.gift ?? 0) + (items.inheritance ?? 0) },
    { label: "⑤ 현금 등 그 밖의 자금", v: items.cash },
    { label: "⑥ 부동산 처분대금 등", v: items.realEstateSale },
  ];
  const loanRows = [
    { label: "⑧ 금융기관 대출액 합계", v: (items.mortgageLoan ?? 0) + (items.creditLoan ?? 0) + (items.businessLoan ?? 0) },
    { label: "⑨ 취득주택의 임대보증금", v: items.rentalDeposit },
    { label: "⑩ 회사지원금ㆍ사채", v: items.companySupportOrPrivateLoan },
    { label: "⑪ 그 밖의 차입금", v: items.otherLoan },
    { label: "토지보상금", v: (items as LandFundingItems).landCompensation },
  ];

  const selfSH = selfRows.length * itemH + subH;
  const loanSH = loanRows.length * itemH + subH;

  cell(ctx, ML, cy - selfSH - loanSH, sLW, selfSH + loanSH, "① 자금\n조달계획", { align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + sLW, cy - selfSH, subLW, selfSH, "자기\n자금", { align: "center", bg: GRAY_LIGHT });

  let ry = cy;
  for (const row of selfRows) {
    cell(ctx, ML + sLW + subLW, ry - itemH, descW, itemH, row.label);
    cell(ctx, ML + sLW + subLW + descW, ry - itemH, valW, itemH, row.v ? fmt(row.v) + " 원" : "", { align: "right" });
    ry -= itemH;
  }
  cell(ctx, ML + sLW + subLW, ry - subH, descW, subH, "⑦ 소계", { bg: GRAY_LIGHT });
  cell(ctx, ML + sLW + subLW + descW, ry - subH, valW, subH, selfTotal ? fmt(selfTotal) + " 원" : "", { align: "right", bg: GRAY_LIGHT });
  ry -= subH;

  cell(ctx, ML + sLW, ry - loanSH, subLW, loanSH, "차입금 등", { align: "center", bg: GRAY_LIGHT });
  for (const row of loanRows) {
    cell(ctx, ML + sLW + subLW, ry - itemH, descW, itemH, row.label);
    cell(ctx, ML + sLW + subLW + descW, ry - itemH, valW, itemH, row.v ? fmt(row.v as number) + " 원" : "", { align: "right" });
    ry -= itemH;
  }
  cell(ctx, ML + sLW + subLW, ry - subH, descW, subH, "⑫ 소계", { bg: GRAY_LIGHT });
  cell(ctx, ML + sLW + subLW + descW, ry - subH, valW, subH, loanTotal ? fmt(loanTotal) + " 원" : "", { align: "right", bg: GRAY_LIGHT });
  ry -= subH;
  cy = ry;

  cell(ctx, ML, cy - subH, sLW + subLW, subH, "⑬ 합계", { align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + sLW + subLW, cy - subH, descW, subH, "");
  cell(ctx, ML + sLW + subLW + descW, cy - subH, valW, subH, grandTotal ? fmt(grandTotal) + " 원" : "", { align: "right" });
  cy -= subH;

  // 토지이용계획
  const luH = 14;
  cell(ctx, ML, cy - luH, sLW + subLW, luH, "토지이용계획", { align: "center", bg: GRAY_LIGHT });
  cell(ctx, ML + sLW + subLW, cy - luH, mainColW, luH, (items as LandFundingItems).landUsePlan || "");
  cy -= luH;
  cy -= 8;

  txt("「부동산 거래신고 등에 관한 법률 시행령」에 따라 위와 같이 토지취득자금 조달 및 토지이용계획서를 제출합니다.", ML, cy, 6.5, rgb(0.3, 0.3, 0.3));
  cy -= 14;
  const { year, month, day } = today();
  const dateTxt = `${year}년  ${month}월  ${day}일`;
  const dw = font.widthOfTextAtSize(dateTxt, 9);
  txt(dateTxt, (PW - dw) / 2, cy, 9);
  cy -= 16;
  const sigTxt = `제출인       ${base.name || ""}           (서명 또는 인)`;
  const sw = font.widthOfTextAtSize(sigTxt, 9);
  txt(sigTxt, (PW - sw) / 2, cy, 9);
  cy -= 14;
  txt("시장ㆍ군수ㆍ구청장 귀하", ML, cy, 9);
}

// ── 공개 함수 ──────────────────────────────────────────────────────

export async function generateFundingPlanPdf(
  step1: FundingStep1Data,
  result: FundingExtractResult,
): Promise<string> {
  const fontBytes = await loadFont();

  if (step1.formType === "housing") {
    // 원본 PDF 로드 (fs 실패 시 HTTP fallback)
    const templateBytes = await loadTemplate();
    if (!templateBytes) {
      throw new Error("주택 취득자금 조달계획서 원본 PDF를 로드할 수 없습니다.");
    }

    const pdfDoc = await PDFDocument.load(templateBytes);
    pdfDoc.registerFontkit(fontkit);

    let font: PDFFont;
    if (fontBytes) {
      font = await pdfDoc.embedFont(fontBytes, { subset: false });
    } else {
      const { StandardFonts } = await import("pdf-lib");
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    await buildHousingOverlay(pdfDoc, font, step1, result);

    return Buffer.from(await pdfDoc.save()).toString("base64");
  } else {
    // 토지 서식: 직접 생성
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    let font: PDFFont;
    if (fontBytes) {
      font = await pdfDoc.embedFont(fontBytes, { subset: false });
    } else {
      const { StandardFonts } = await import("pdf-lib");
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    await buildLandPdf(pdfDoc, font, step1, result);
    return Buffer.from(await pdfDoc.save()).toString("base64");
  }
}
