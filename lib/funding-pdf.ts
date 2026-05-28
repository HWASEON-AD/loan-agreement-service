// 자금조달계획서 PDF 생성 로직 (pdf-lib + fontkit)
// - 주택: 별지 제1호의3 서식 레이아웃
// - 토지: 별지 제1호의4 서식 레이아웃
// 서버 사이드에서만 실행 (Node fs 사용)

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

// 한글 폰트 파일 경로 (기존 pdf-generator.ts와 동일)
const FONT_PATH = path.join(
  process.cwd(),
  "assets",
  "fonts",
  "NotoSansKR-Regular.otf"
);

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
    console.error("[funding-pdf] 한글 폰트 로드 실패:", err);
    return null;
  }
}

// A4 크기 상수
const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 50;
const CONTENT_WIDTH = A4.width - MARGIN * 2;

// 색상
const COLOR_BLACK = rgb(0.1, 0.1, 0.15);
const COLOR_HEADING = rgb(0.06, 0.13, 0.34);
const COLOR_GRAY = rgb(0.4, 0.45, 0.5);
const COLOR_LINE = rgb(0.7, 0.74, 0.78);
const COLOR_TABLE_HEADER_BG = rgb(0.94, 0.95, 0.98);

// 금액 표시: null/0 → "-", 숫자 → "50,000,000"
function formatAmount(v: number | null): string {
  if (v === null || v === undefined) return "-";
  if (v === 0) return "-";
  return v.toLocaleString("ko-KR");
}

// 텍스트 줄바꿈 (문자 단위)
function wrapLine(
  font: PDFFont,
  text: string,
  fontSize: number,
  maxWidth: number
): string[] {
  if (!text) return [""];
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

// 자기자금 합계 (giftTaxFiled 등 boolean 제외)
function calcSelfFundTotal(items: HousingFundingItems): number {
  return SELF_FUND_KEYS.reduce((sum, key) => {
    const v = items[key];
    if (typeof v === "number") return sum + v;
    return sum;
  }, 0);
}

// 차입금 합계
function calcLoanTotal(items: HousingFundingItems): number {
  return LOAN_KEYS.reduce((sum, key) => {
    const v = items[key];
    if (typeof v === "number") return sum + v;
    return sum;
  }, 0);
}

// 토지 필지 거래금액 합계
function calcLandTradeTotal(parcels: LandParcel[]): number {
  return parcels.reduce(
    (sum, p) => sum + (typeof p.tradeAmount === "number" ? p.tradeAmount : 0),
    0
  );
}

// 주민등록번호 마스킹 (뒷 7자리 → 첫 1자리 + "******")
function maskIdNumber(front: string, back: string): string {
  const safeFront = front || "";
  const safeBack = back || "";
  const masked =
    safeBack.length > 0 ? safeBack.charAt(0) + "******" : "*******";
  return `${safeFront}-${masked}`;
}

// 오늘 날짜 (YYYY년 M월 D일)
function todayKorean(): string {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ─────────────────────────────────────────────────────
// PDF 생성 컨텍스트
// ─────────────────────────────────────────────────────
interface PdfCtx {
  pdfDoc: PDFDocument;
  font: PDFFont;
  page: PDFPage;
  cursorY: number;
}

// 새 페이지 추가 (필요 시)
function ensureSpace(ctx: PdfCtx, requiredHeight: number) {
  if (ctx.cursorY - requiredHeight < MARGIN) {
    ctx.page = ctx.pdfDoc.addPage([A4.width, A4.height]);
    ctx.cursorY = A4.height - MARGIN;
  }
}

// 일반 텍스트 1줄 그리기
function drawText(
  ctx: PdfCtx,
  text: string,
  options?: {
    x?: number;
    size?: number;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
  }
) {
  const size = options?.size ?? 10;
  const x = options?.x ?? MARGIN;
  const color = options?.color ?? COLOR_BLACK;
  ensureSpace(ctx, size + 4);
  ctx.page.drawText(text, {
    x,
    y: ctx.cursorY,
    size,
    font: ctx.font,
    color,
  });
}

// 가운데 정렬 텍스트
function drawCenterText(
  ctx: PdfCtx,
  text: string,
  size: number,
  color = COLOR_HEADING
) {
  ensureSpace(ctx, size + 4);
  const width = ctx.font.widthOfTextAtSize(text, size);
  const x = (A4.width - width) / 2;
  ctx.page.drawText(text, {
    x,
    y: ctx.cursorY,
    size,
    font: ctx.font,
    color,
  });
}

// 가로 구분선
function drawHorizontalLine(ctx: PdfCtx) {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.cursorY },
    end: { x: A4.width - MARGIN, y: ctx.cursorY },
    thickness: 0.5,
    color: COLOR_LINE,
  });
}

// 소제목 (■ 텍스트)
function drawSectionTitle(ctx: PdfCtx, title: string) {
  ensureSpace(ctx, 18);
  drawText(ctx, `■ ${title}`, {
    size: 11,
    color: COLOR_HEADING,
  });
  ctx.cursorY -= 16;
}

// 2열 라벨/값 그리기 (인적사항용)
function drawLabelValue(
  ctx: PdfCtx,
  label: string,
  value: string,
  options?: { labelX?: number; valueX?: number; maxValueWidth?: number }
) {
  const labelX = options?.labelX ?? MARGIN;
  const valueX = options?.valueX ?? MARGIN + 80;
  const maxValueWidth =
    options?.maxValueWidth ?? A4.width - MARGIN - valueX;

  ensureSpace(ctx, 16);
  ctx.page.drawText(label, {
    x: labelX,
    y: ctx.cursorY,
    size: 10,
    font: ctx.font,
    color: COLOR_GRAY,
  });
  // 값이 길면 줄바꿈
  const wrapped = wrapLine(ctx.font, value || "-", 10, maxValueWidth);
  for (let i = 0; i < wrapped.length; i++) {
    if (i > 0) {
      ctx.cursorY -= 14;
      ensureSpace(ctx, 14);
    }
    ctx.page.drawText(wrapped[i], {
      x: valueX,
      y: ctx.cursorY,
      size: 10,
      font: ctx.font,
      color: COLOR_BLACK,
    });
  }
  ctx.cursorY -= 16;
}

// 표 행 그리기 (구분 | 금액)
interface TableRow {
  label: string;
  value: string;
  note?: string; // 추가 설명 (예: 관계)
  isSubtotal?: boolean;
}

function drawTableHeader(ctx: PdfCtx, headers: string[], cols: number[]) {
  const rowHeight = 18;
  ensureSpace(ctx, rowHeight + 4);
  // 헤더 배경
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.cursorY - 5,
    width: CONTENT_WIDTH,
    height: rowHeight,
    color: COLOR_TABLE_HEADER_BG,
  });
  for (let i = 0; i < headers.length; i++) {
    ctx.page.drawText(headers[i], {
      x: MARGIN + cols[i] + 5,
      y: ctx.cursorY + 3,
      size: 10,
      font: ctx.font,
      color: COLOR_HEADING,
    });
  }
  // 헤더 하단 라인
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.cursorY - 5 },
    end: { x: A4.width - MARGIN, y: ctx.cursorY - 5 },
    thickness: 0.5,
    color: COLOR_LINE,
  });
  ctx.cursorY -= rowHeight + 2;
}

function drawTableRow(ctx: PdfCtx, row: TableRow) {
  const rowHeight = 18;
  ensureSpace(ctx, rowHeight);
  // 소계 강조
  const color = row.isSubtotal ? COLOR_HEADING : COLOR_BLACK;
  const size = row.isSubtotal ? 10.5 : 10;

  if (row.isSubtotal) {
    // 옅은 배경
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.cursorY - 5,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: rgb(0.96, 0.97, 0.99),
    });
  }
  ctx.page.drawText(row.label, {
    x: MARGIN + 5,
    y: ctx.cursorY + 3,
    size,
    font: ctx.font,
    color,
  });
  // 금액은 오른쪽 정렬
  const valueWidth = ctx.font.widthOfTextAtSize(row.value, size);
  ctx.page.drawText(row.value, {
    x: A4.width - MARGIN - 110 - valueWidth,
    y: ctx.cursorY + 3,
    size,
    font: ctx.font,
    color,
  });
  // 단위
  ctx.page.drawText("원", {
    x: A4.width - MARGIN - 15,
    y: ctx.cursorY + 3,
    size,
    font: ctx.font,
    color: COLOR_GRAY,
  });
  // 노트 (예: 관계)
  if (row.note) {
    ctx.cursorY -= rowHeight;
    ensureSpace(ctx, 14);
    ctx.page.drawText(`  └ ${row.note}`, {
      x: MARGIN + 15,
      y: ctx.cursorY + 3,
      size: 9,
      font: ctx.font,
      color: COLOR_GRAY,
    });
    ctx.cursorY -= 4;
  } else {
    ctx.cursorY -= rowHeight;
  }
  // 행 하단 라인
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.cursorY + 3 },
    end: { x: A4.width - MARGIN, y: ctx.cursorY + 3 },
    thickness: 0.3,
    color: COLOR_LINE,
  });
}

// ─────────────────────────────────────────────────────
// 주택 서식 생성
// ─────────────────────────────────────────────────────
async function buildHousingPdf(
  ctx: PdfCtx,
  step1: FundingStep1Data,
  result: FundingExtractResult
) {
  if (step1.formType !== "housing") return;
  const base = step1.baseInfo;
  const items = result.items as HousingFundingItems;
  const tradeAmount = base.tradeAmount ?? 0;
  const selfTotal = calcSelfFundTotal(items);
  const loanTotal = calcLoanTotal(items);
  const total = selfTotal + loanTotal;
  const diff = tradeAmount - total;

  // 제목
  drawCenterText(ctx, "주택취득자금 조달 및 입주 계획서", 18);
  ctx.cursorY -= 24;
  drawCenterText(
    ctx,
    "(「부동산 거래신고 등에 관한 법률」 제3조제4항에 따른 신고)",
    9,
    COLOR_GRAY
  );
  ctx.cursorY -= 20;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 인적사항
  drawSectionTitle(ctx, "인적사항");
  drawLabelValue(ctx, "성명", base.name);
  drawLabelValue(
    ctx,
    "주민등록번호",
    maskIdNumber(base.idNumberFront, base.idNumberBack)
  );
  drawLabelValue(ctx, "주소", base.address);
  drawLabelValue(ctx, "전화번호", base.phone);
  drawLabelValue(
    ctx,
    "거래금액",
    `${formatAmount(tradeAmount)} 원`
  );

  ctx.cursorY -= 4;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 자기자금
  drawSectionTitle(ctx, "자기자금");
  drawTableHeader(ctx, ["구분", "금액(원)"], [0, CONTENT_WIDTH - 150]);

  drawTableRow(ctx, {
    label: "금융기관 예금액",
    value: formatAmount(items.deposit),
  });
  drawTableRow(ctx, {
    label: "주식·채권 매각대금",
    value: formatAmount(items.stocks),
  });
  drawTableRow(ctx, {
    label: "증여",
    value: formatAmount(items.gift),
    note:
      items.giftTaxFiled === true
        ? "증여세 신고: 완료"
        : items.giftTaxFiled === false
        ? "증여세 신고: 미신고"
        : items.gift !== null
        ? "증여세 신고: 미확인"
        : undefined,
  });
  drawTableRow(ctx, {
    label: "상속",
    value: formatAmount(items.inheritance),
  });
  drawTableRow(ctx, {
    label: "현금 등 기타",
    value: formatAmount(items.cash),
  });
  drawTableRow(ctx, {
    label: "부동산 처분대금",
    value: formatAmount(items.realEstateSale),
  });
  drawTableRow(ctx, {
    label: "[자기자금 소계]",
    value: selfTotal.toLocaleString("ko-KR"),
    isSubtotal: true,
  });

  ctx.cursorY -= 12;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 차입금
  drawSectionTitle(ctx, "차입금");
  drawTableHeader(ctx, ["구분", "금액(원)"], [0, CONTENT_WIDTH - 150]);

  drawTableRow(ctx, {
    label: "금융기관 대출액 (담보)",
    value: formatAmount(items.mortgageLoan),
  });
  drawTableRow(ctx, {
    label: "금융기관 대출액 (신용)",
    value: formatAmount(items.creditLoan),
  });
  drawTableRow(ctx, {
    label: "사업자 대출액",
    value: formatAmount(items.businessLoan),
  });
  drawTableRow(ctx, {
    label: "임대보증금",
    value: formatAmount(items.rentalDeposit),
  });
  drawTableRow(ctx, {
    label: "회사지원금·사채",
    value: formatAmount(items.companySupportOrPrivateLoan),
  });
  drawTableRow(ctx, {
    label: "기타 차입금",
    value: formatAmount(items.otherLoan),
    note: items.otherLoanRelation
      ? `관계: ${items.otherLoanRelation}`
      : items.otherLoan !== null
      ? "관계: 미확인"
      : undefined,
  });
  drawTableRow(ctx, {
    label: "[차입금 소계]",
    value: loanTotal.toLocaleString("ko-KR"),
    isSubtotal: true,
  });

  ctx.cursorY -= 12;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 거래 관련
  drawSectionTitle(ctx, "거래 관련");
  drawLabelValue(
    ctx,
    "전매금액",
    `${formatAmount(items.transferAmount)} 원`
  );
  drawLabelValue(
    ctx,
    "보증금 승계",
    `${formatAmount(items.depositSuccession)} 원`
  );
  drawLabelValue(
    ctx,
    "현금 직접 지불",
    `${formatAmount(items.cashPayment)} 원`
  );
  drawLabelValue(ctx, "입주 예정 시기", items.moveInPlan ?? "-");

  ctx.cursorY -= 4;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 합계
  drawSectionTitle(ctx, "합계");
  drawTableRow(ctx, {
    label: "자기자금 소계",
    value: selfTotal.toLocaleString("ko-KR"),
  });
  drawTableRow(ctx, {
    label: "차입금 소계",
    value: loanTotal.toLocaleString("ko-KR"),
  });
  drawTableRow(ctx, {
    label: "합계",
    value: total.toLocaleString("ko-KR"),
    isSubtotal: true,
  });
  drawTableRow(ctx, {
    label: "거래금액",
    value: tradeAmount.toLocaleString("ko-KR"),
  });
  drawTableRow(ctx, {
    label: "차액 (거래금액 - 합계)",
    value:
      diff === 0 ? "0 (일치)" : `${diff.toLocaleString("ko-KR")}`,
    isSubtotal: true,
  });

  ctx.cursorY -= 12;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 서명란
  drawText(ctx, "위와 같이 자금조달계획서를 신고합니다.", {
    size: 10,
  });
  ctx.cursorY -= 24;
  drawCenterText(ctx, todayKorean(), 10, COLOR_BLACK);
  ctx.cursorY -= 24;
  drawCenterText(
    ctx,
    `신고인 : ${base.name}                   (서명 또는 인)`,
    10,
    COLOR_BLACK
  );
  ctx.cursorY -= 24;
  drawCenterText(ctx, "○○○ 시장 / 군수 / 구청장 귀중", 10, COLOR_GRAY);
}

// ─────────────────────────────────────────────────────
// 토지 서식 생성
// ─────────────────────────────────────────────────────
async function buildLandPdf(
  ctx: PdfCtx,
  step1: FundingStep1Data,
  result: FundingExtractResult
) {
  if (step1.formType !== "land") return;
  const base = step1.baseInfo;
  const items = result.items as LandFundingItems;
  const tradeAmount = calcLandTradeTotal(base.landParcels);
  const selfTotal = calcSelfFundTotal(items);
  const loanTotal = calcLoanTotal(items);
  const total = selfTotal + loanTotal;
  const diff = tradeAmount - total;

  // 제목
  drawCenterText(ctx, "토지취득자금 조달계획서", 18);
  ctx.cursorY -= 24;
  drawCenterText(
    ctx,
    "(「부동산 거래신고 등에 관한 법률」 제3조제4항)",
    9,
    COLOR_GRAY
  );
  ctx.cursorY -= 20;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 인적사항
  drawSectionTitle(ctx, "인적사항");
  drawLabelValue(ctx, "성명", base.name);
  drawLabelValue(
    ctx,
    "주민등록번호",
    maskIdNumber(base.idNumberFront, base.idNumberBack)
  );
  drawLabelValue(ctx, "주소", base.address);
  drawLabelValue(ctx, "전화번호", base.phone);

  ctx.cursorY -= 4;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 취득 토지 현황
  drawSectionTitle(ctx, "취득 토지 현황");
  drawTableHeader(ctx, ["소재지", "면적", "거래금액(원)"], [0, 260, 380]);

  for (let i = 0; i < 3; i++) {
    const p = base.landParcels[i];
    if (p) {
      ensureSpace(ctx, 18);
      ctx.page.drawText(p.location || "-", {
        x: MARGIN + 5,
        y: ctx.cursorY + 3,
        size: 10,
        font: ctx.font,
        color: COLOR_BLACK,
      });
      ctx.page.drawText(p.area || "-", {
        x: MARGIN + 260,
        y: ctx.cursorY + 3,
        size: 10,
        font: ctx.font,
        color: COLOR_BLACK,
      });
      const amtStr = formatAmount(p.tradeAmount);
      const amtWidth = ctx.font.widthOfTextAtSize(amtStr, 10);
      ctx.page.drawText(amtStr, {
        x: A4.width - MARGIN - 15 - amtWidth,
        y: ctx.cursorY + 3,
        size: 10,
        font: ctx.font,
        color: COLOR_BLACK,
      });
      ctx.cursorY -= 18;
      ctx.page.drawLine({
        start: { x: MARGIN, y: ctx.cursorY + 3 },
        end: { x: A4.width - MARGIN, y: ctx.cursorY + 3 },
        thickness: 0.3,
        color: COLOR_LINE,
      });
    } else {
      ensureSpace(ctx, 18);
      ctx.page.drawText("-", {
        x: MARGIN + 5,
        y: ctx.cursorY + 3,
        size: 10,
        font: ctx.font,
        color: COLOR_GRAY,
      });
      ctx.cursorY -= 18;
    }
  }
  drawTableRow(ctx, {
    label: "[합계]",
    value: tradeAmount.toLocaleString("ko-KR"),
    isSubtotal: true,
  });

  ctx.cursorY -= 12;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 자기자금
  drawSectionTitle(ctx, "자기자금");
  drawTableHeader(ctx, ["구분", "금액(원)"], [0, CONTENT_WIDTH - 150]);
  drawTableRow(ctx, {
    label: "금융기관 예금액",
    value: formatAmount(items.deposit),
  });
  drawTableRow(ctx, {
    label: "주식·채권 매각대금",
    value: formatAmount(items.stocks),
  });
  drawTableRow(ctx, {
    label: "증여",
    value: formatAmount(items.gift),
    note:
      items.giftTaxFiled === true
        ? "증여세 신고: 완료"
        : items.giftTaxFiled === false
        ? "증여세 신고: 미신고"
        : undefined,
  });
  drawTableRow(ctx, {
    label: "상속",
    value: formatAmount(items.inheritance),
  });
  drawTableRow(ctx, {
    label: "현금 등 기타",
    value: formatAmount(items.cash),
  });
  drawTableRow(ctx, {
    label: "부동산 처분대금",
    value: formatAmount(items.realEstateSale),
  });
  drawTableRow(ctx, {
    label: "[자기자금 소계]",
    value: selfTotal.toLocaleString("ko-KR"),
    isSubtotal: true,
  });

  ctx.cursorY -= 12;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 차입금
  drawSectionTitle(ctx, "차입금");
  drawTableHeader(ctx, ["구분", "금액(원)"], [0, CONTENT_WIDTH - 150]);
  drawTableRow(ctx, {
    label: "금융기관 대출액 (담보)",
    value: formatAmount(items.mortgageLoan),
  });
  drawTableRow(ctx, {
    label: "금융기관 대출액 (신용)",
    value: formatAmount(items.creditLoan),
  });
  drawTableRow(ctx, {
    label: "사업자 대출액",
    value: formatAmount(items.businessLoan),
  });
  drawTableRow(ctx, {
    label: "임대보증금",
    value: formatAmount(items.rentalDeposit),
  });
  drawTableRow(ctx, {
    label: "회사지원금·사채",
    value: formatAmount(items.companySupportOrPrivateLoan),
  });
  drawTableRow(ctx, {
    label: "기타 차입금",
    value: formatAmount(items.otherLoan),
    note: items.otherLoanRelation
      ? `관계: ${items.otherLoanRelation}`
      : undefined,
  });
  drawTableRow(ctx, {
    label: "[차입금 소계]",
    value: loanTotal.toLocaleString("ko-KR"),
    isSubtotal: true,
  });

  ctx.cursorY -= 12;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 토지 전용 항목
  drawSectionTitle(ctx, "토지 관련");
  drawLabelValue(
    ctx,
    "토지보상금",
    `${formatAmount(items.landCompensation)} 원`
  );
  drawLabelValue(ctx, "토지이용계획", items.landUsePlan ?? "-");

  ctx.cursorY -= 4;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 합계
  drawSectionTitle(ctx, "합계");
  drawTableRow(ctx, {
    label: "자기자금 소계",
    value: selfTotal.toLocaleString("ko-KR"),
  });
  drawTableRow(ctx, {
    label: "차입금 소계",
    value: loanTotal.toLocaleString("ko-KR"),
  });
  drawTableRow(ctx, {
    label: "합계",
    value: total.toLocaleString("ko-KR"),
    isSubtotal: true,
  });
  drawTableRow(ctx, {
    label: "거래금액",
    value: tradeAmount.toLocaleString("ko-KR"),
  });
  drawTableRow(ctx, {
    label: "차액 (거래금액 - 합계)",
    value:
      diff === 0 ? "0 (일치)" : `${diff.toLocaleString("ko-KR")}`,
    isSubtotal: true,
  });

  ctx.cursorY -= 12;
  drawHorizontalLine(ctx);
  ctx.cursorY -= 18;

  // 서명란
  drawText(ctx, "위와 같이 자금조달계획서를 신고합니다.", {
    size: 10,
  });
  ctx.cursorY -= 24;
  drawCenterText(ctx, todayKorean(), 10, COLOR_BLACK);
  ctx.cursorY -= 24;
  drawCenterText(
    ctx,
    `신고인 : ${base.name}                   (서명 또는 인)`,
    10,
    COLOR_BLACK
  );
  ctx.cursorY -= 24;
  drawCenterText(ctx, "○○○ 시장 / 군수 / 구청장 귀중", 10, COLOR_GRAY);
}

// ─────────────────────────────────────────────────────
// 외부 노출 함수: 자금조달계획서 PDF 생성 → base64
// ─────────────────────────────────────────────────────
export async function generateFundingPlanPdf(
  step1: FundingStep1Data,
  result: FundingExtractResult
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // 폰트 로드
  const fontBytes = await loadFontBytes();
  let font: PDFFont;
  if (fontBytes) {
    font = await pdfDoc.embedFont(fontBytes, { subset: true });
  } else {
    const { StandardFonts } = await import("pdf-lib");
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  // 첫 페이지
  const page = pdfDoc.addPage([A4.width, A4.height]);
  const ctx: PdfCtx = {
    pdfDoc,
    font,
    page,
    cursorY: A4.height - MARGIN,
  };

  if (step1.formType === "housing") {
    await buildHousingPdf(ctx, step1, result);
  } else {
    await buildLandPdf(ctx, step1, result);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
}
