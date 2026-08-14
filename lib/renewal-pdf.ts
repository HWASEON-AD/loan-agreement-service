// 계약갱신 관련 서식(통지서·확인서) PDF 생성 — pdf-lib + fontkit 한글 임베드
//
// ★ 서버 사이드 전용 (Node fs 사용).
// ★ 생성만 하고 저장하지 않는다 — 서식에는 임대인·임차인 실명과 주소가 들어간다.
//   (생성 문서 DB 미보관 원칙)
// ★ LLM 호출 0회. FormDoc 구조체를 고정 서식(표)에 그대로 배치하기만 한다.
//
// ★★ 서식이 깨지지 않게 하는 원칙
//   예전 구현은 서식을 긴 문자열로 만들어 한 줄씩 흘려 그렸다. 그러면 표를 공백으로
//   흉내내야 하고, 값이 한 글자만 길어져도 칸이 밀린다. 지금은 실제 표를 그린다.
//   ① 셀 안에서 줄바꿈시키고 ② 줄 수에 맞춰 행 높이를 늘리고 ③ 블록이 페이지에 안 들어가면
//   페이지를 넘긴다. 이 세 가지 때문에 값이 길어져도 서식이 무너지지 않는다.

import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import path from "path";
import { numberedHeadings, type DocCell, type FormDoc } from "./renewal-doc";

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

// ---------------------------------------------------------------------------
// 서식 치수 — 전부 여기 모아 둔다 (한 곳만 고치면 서식 전체가 같이 움직인다)
// ---------------------------------------------------------------------------
const PAGE = { w: 595.28, h: 841.89 }; // A4
const MARGIN = 50;
const CONTENT_W = PAGE.w - MARGIN * 2; // 495.28
const TABLE_INDENT = 14; // 섹션 제목보다 표를 조금 들여쓴다 (원 서식과 동일)
const TABLE_X = MARGIN + TABLE_INDENT;
const TABLE_W = CONTENT_W - TABLE_INDENT;

// ★ 치수를 키울 때는 반드시 확인서(표 3개 + 본문 + 참고 + 서명 2줄)를 다시 렌더해 볼 것.
//   확인서가 제일 빡빡한 서식이고, A4 한 장을 넘기면 둘째 장에 서명란만 남아 서식이 깨져 보인다.
const CELL_PAD_X = 7;
const CELL_PAD_Y = 5;
const CELL_SIZE = 9.5;
const CELL_LH = 13.5;
const CELL_MIN_H = 26;

const BODY_SIZE = 10;
const BODY_LH = 16;
const BODY_PAD = 11;
const BODY_PARA_GAP = 8;

const NOTE_SIZE = 8.5;
const NOTE_LH = 12;
const NOTE_PARA_GAP = 5;

const HEAD_SIZE = 11;
const HEAD_GAP_ABOVE = 15;
const HEAD_GAP_BELOW = 6;

// 색 (화면 미리보기와 같은 슬레이트 계열)
const C_TEXT = rgb(0.12, 0.16, 0.22);
const C_TITLE = rgb(0.06, 0.09, 0.16);
const C_MUTED = rgb(0.42, 0.47, 0.55);
const C_BORDER = rgb(0.78, 0.81, 0.85);
const C_FILL = rgb(0.957, 0.965, 0.976);

// ---------------------------------------------------------------------------
// 텍스트 유틸
// ---------------------------------------------------------------------------

/**
 * 폭에 맞춰 줄바꿈.
 * 한글은 어디서 끊어도 되지만 영문·숫자·전화번호는 단어 중간에서 끊기면 읽기 나쁘므로
 * "ASCII 연속 구간"을 하나의 토큰으로 묶어서 처리한다.
 */
function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  if (!text) return [""];
  if (maxWidth <= 0) return [text];

  const tokens: string[] = [];
  let ascii = "";
  for (const ch of text) {
    if (/[A-Za-z0-9.,:/@~\-_+()%]/.test(ch)) {
      ascii += ch;
      continue;
    }
    if (ascii) {
      tokens.push(ascii);
      ascii = "";
    }
    tokens.push(ch);
  }
  if (ascii) tokens.push(ascii);

  const lines: string[] = [];
  let cur = "";
  const widthOf = (s: string) => font.widthOfTextAtSize(s, size);

  for (const token of tokens) {
    // 토큰 하나가 이미 폭을 넘으면 글자 단위로 쪼갠다 (무한루프 방지)
    if (widthOf(token) > maxWidth) {
      for (const ch of token) {
        if (cur && widthOf(cur + ch) > maxWidth) {
          lines.push(cur);
          cur = "";
        }
        cur += ch;
      }
      continue;
    }
    if (cur && widthOf(cur + token) > maxWidth) {
      lines.push(cur.replace(/\s+$/, ""));
      cur = token === " " ? "" : token; // 줄 첫머리 공백은 버린다
    } else {
      cur += token;
    }
  }
  if (cur !== "") lines.push(cur.replace(/\s+$/, ""));
  return lines.length ? lines : [""];
}

/** 강제 줄바꿈(\n)을 존중하면서 폭에 맞춰 줄바꿈 */
function wrapMultiline(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const seg of text.split("\n")) {
    for (const ln of wrapText(font, seg, size, maxWidth)) out.push(ln);
  }
  return out;
}

/** 굵게 — NanumGothic 은 Regular 만 임베드하므로 살짝 겹쳐 그려 굵기를 흉내낸다 */
function drawText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  color: RGB,
  bold = false
) {
  if (text === "") return;
  page.drawText(text, { x, y, size, font, color });
  if (bold) {
    page.drawText(text, { x: x + 0.28, y, size, font, color });
    page.drawText(text, { x, y: y + 0.22, size, font, color });
  }
}

/** 자간을 벌린 글자 폭 */
function spacedWidth(font: PDFFont, text: string, size: number, spacing: number): number {
  const chars = [...text];
  return (
    chars.reduce((sum, ch) => sum + font.widthOfTextAtSize(ch, size), 0) +
    spacing * Math.max(0, chars.length - 1)
  );
}

/** 자간을 벌려 그리기 — 원 서식의 "계 약 갱 신 요 구 통 지 서" 표기 */
function drawSpacedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  spacing: number,
  color: RGB,
  bold = false
) {
  let cursor = x;
  for (const ch of [...text]) {
    drawText(page, font, ch, cursor, y, size, color, bold);
    cursor += font.widthOfTextAtSize(ch, size) + spacing;
  }
}

// ---------------------------------------------------------------------------
// 표 측정 · 그리기
// ---------------------------------------------------------------------------
type MeasuredRow = { cells: DocCell[]; lines: string[][]; height: number };

function measureTable(font: PDFFont, colWidths: number[], rows: DocCell[][]): MeasuredRow[] {
  return rows.map((cells) => {
    const lines = cells.map((cell, i) =>
      wrapMultiline(font, cell.text, CELL_SIZE, colWidths[i] - CELL_PAD_X * 2)
    );
    const maxLines = Math.max(...lines.map((l) => l.length));
    return {
      cells,
      lines,
      height: Math.max(CELL_MIN_H, maxLines * CELL_LH + CELL_PAD_Y * 2),
    };
  });
}

/** 측정된 표를 그린다. 반환값 = 표 아래쪽 y */
function drawTable(
  page: PDFPage,
  font: PDFFont,
  x: number,
  yTop: number,
  colWidths: number[],
  measured: MeasuredRow[]
): number {
  let y = yTop;
  for (const { cells, lines, height } of measured) {
    let cx = x;
    cells.forEach((cell, i) => {
      const w = colWidths[i];
      page.drawRectangle({
        x: cx,
        y: y - height,
        width: w,
        height,
        borderColor: C_BORDER,
        borderWidth: 0.8,
        color: cell.fill ? C_FILL : undefined,
      });

      const ls = lines[i];
      const padTop = (height - ls.length * CELL_LH) / 2;
      ls.forEach((ln, li) => {
        const lineTop = y - padTop - li * CELL_LH;
        const baseline = lineTop - CELL_LH / 2 - CELL_SIZE * 0.36;
        const tw = font.widthOfTextAtSize(ln, CELL_SIZE);
        const tx = cell.align === "center" ? cx + (w - tw) / 2 : cx + CELL_PAD_X;
        drawText(page, font, ln, tx, baseline, CELL_SIZE, C_TEXT, cell.bold);
      });
      cx += w;
    });
    y -= height;
  }
  return y;
}

// ---------------------------------------------------------------------------
// 본체
// ---------------------------------------------------------------------------

/** FormDoc → PDF 바이트 */
export async function generateRenewalNoticePdf(doc: FormDoc): Promise<Uint8Array> {
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

  let page = pdfDoc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - MARGIN;
  const bottom = MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - MARGIN;
  };
  /** 남은 높이가 need 보다 작으면 페이지를 넘긴다 */
  const ensure = (need: number) => {
    if (y - need < bottom) newPage();
  };

  // ── 제목 ────────────────────────────────────────────────────────────────
  // 원 서식처럼 글자마다 같은 간격으로 벌린다. 제목 안의 공백은 빼고 그려야
  // "주 택 임 대 차 계 약  갱 신  확 인 서" 처럼 중간만 벌어지지 않는다.
  const titleSize = 19;
  const titleSpacing = 6;
  const titleText = doc.title.replace(/\s+/g, "");
  const tw = spacedWidth(font, titleText, titleSize, titleSpacing);
  y -= 16;
  drawSpacedText(
    page,
    font,
    titleText,
    (PAGE.w - tw) / 2,
    y - titleSize,
    titleSize,
    titleSpacing,
    C_TITLE,
    true
  );
  y -= titleSize + 11;
  page.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: 1.6, color: C_TITLE });
  y -= 3;

  const headings = numberedHeadings(doc.blocks);

  const drawHeading = (text: string, muted = false) => {
    ensure(HEAD_GAP_ABOVE + HEAD_SIZE + HEAD_GAP_BELOW + 20);
    y -= HEAD_GAP_ABOVE;
    drawText(
      page,
      font,
      text,
      MARGIN,
      y - HEAD_SIZE,
      muted ? HEAD_SIZE - 1.5 : HEAD_SIZE,
      muted ? C_MUTED : C_TITLE,
      true
    );
    y -= (muted ? HEAD_SIZE - 1.5 : HEAD_SIZE) + HEAD_GAP_BELOW;
  };

  doc.blocks.forEach((block, bi) => {
    if (block.kind === "table") {
      const colWidths = block.colRatios.map((r) => TABLE_W * r);
      const measured = measureTable(font, colWidths, block.rows);
      const h = measured.reduce((s, r) => s + r.height, 0);
      drawHeading(headings[bi]);
      ensure(h);
      y = drawTable(page, font, TABLE_X, y, colWidths, measured);
      return;
    }

    if (block.kind === "body") {
      drawHeading(headings[bi]);

      // 문단 → 그릴 줄 목록 (빈 문자열은 문단 사이 간격을 뜻한다)
      const maxW = TABLE_W - BODY_PAD * 2;
      const lines: string[] = [];
      block.paragraphs.forEach((para, pi) => {
        if (pi > 0) lines.push("");
        para.forEach((line) => wrapText(font, line, BODY_SIZE, maxW).forEach((l) => lines.push(l)));
      });

      const advance = (ln: string) => (ln === "" ? BODY_PARA_GAP : BODY_LH);
      const totalH = lines.reduce((s, ln) => s + advance(ln), 0);

      // 상자가 페이지에 안 들어가면 조각내어 이어 그린다 (조각마다 테두리를 닫는다)
      let idx = 0;
      let first = true;
      while (idx < lines.length) {
        if (y - (BODY_PAD * 2 + BODY_LH) < bottom) newPage();

        const avail = y - bottom - BODY_PAD * 2;
        let used = 0;
        const chunk: string[] = [];
        while (idx < lines.length && used + advance(lines[idx]) <= avail) {
          used += advance(lines[idx]);
          chunk.push(lines[idx]);
          idx++;
        }
        if (chunk.length === 0 && idx < lines.length) {
          // 한 줄도 못 넣을 정도면(방어) 강제로 한 줄은 넣는다
          used += advance(lines[idx]);
          chunk.push(lines[idx]);
          idx++;
        }

        // 한 장에 다 들어간 경우엔 원 서식처럼 상자 아래에 약간의 여유를 준다.
        // 블록이 많은 서식(확인서)은 그 여유 때문에 한 장을 넘길 수 있으므로 주지 않는다.
        const roomy = doc.blocks.length <= 3;
        const slack = roomy && first && idx >= lines.length && totalH < 420 ? 18 : 0;
        const boxH = used + BODY_PAD * 2 + slack;
        page.drawRectangle({
          x: TABLE_X,
          y: y - boxH,
          width: TABLE_W,
          height: boxH,
          borderColor: C_BORDER,
          borderWidth: 0.8,
        });

        let ly = y - BODY_PAD;
        for (const ln of chunk) {
          if (ln === "") {
            ly -= BODY_PARA_GAP;
            continue;
          }
          drawText(page, font, ln, TABLE_X + BODY_PAD, ly - BODY_SIZE, BODY_SIZE, C_TEXT);
          ly -= BODY_LH;
        }
        y -= boxH;
        first = false;
      }
      return;
    }

    // note — 테두리 없이 작은 글씨. 주어가 법령·해설인 문장만 들어온다.
    const maxW = TABLE_W - 12;
    const noteLines: string[] = [];
    block.paragraphs.forEach((para, pi) => {
      if (pi > 0) noteLines.push("");
      para.forEach((line) => wrapText(font, line, NOTE_SIZE, maxW).forEach((l) => noteLines.push(l)));
    });
    const noteH = noteLines.reduce((s, ln) => s + (ln === "" ? NOTE_PARA_GAP : NOTE_LH), 0);
    drawHeading(headings[bi], true);
    ensure(noteH);
    for (const ln of noteLines) {
      if (ln === "") {
        y -= NOTE_PARA_GAP;
        continue;
      }
      if (y - NOTE_LH < bottom) newPage();
      drawText(page, font, ln, TABLE_X, y - NOTE_SIZE, NOTE_SIZE, C_MUTED);
      y -= NOTE_LH;
    }
  });

  // ── 날짜 · 서명란 ───────────────────────────────────────────────────────
  const dateSize = 11;
  const signSize = 11;
  const signRowH = 34;
  ensure(24 + dateSize + 26 + signRowH * doc.signatures.length);

  y -= 24;
  const dw = spacedWidth(font, doc.dateText, dateSize, 1.2);
  drawSpacedText(page, font, doc.dateText, (PAGE.w - dw) / 2, y - dateSize, dateSize, 1.2, C_TEXT);
  y -= dateSize + 26;

  // 오른쪽 정렬 서명 블록 — 라벨 / 성명 / (서명 또는 날인) 을 한 줄에 두고 밑줄을 긋는다.
  // 라벨 폭은 서명란이 여러 줄일 때 세로로 맞아야 하므로 가장 긴 라벨 기준으로 통일한다.
  const right = MARGIN + CONTENT_W;
  const suffix = "(서명 또는 날인)";
  const suffixW = font.widthOfTextAtSize(suffix, signSize - 1);
  const labelW = Math.max(...doc.signatures.map((s) => font.widthOfTextAtSize(s.label, signSize)));
  const nameW = Math.max(
    96,
    ...doc.signatures.map((s) => font.widthOfTextAtSize(s.name, signSize) + 24)
  );
  const suffixX = right - suffixW;
  const nameX = suffixX - 14 - nameW;
  const labelX = nameX - 12 - labelW;

  for (const sig of doc.signatures) {
    ensure(signRowH);
    drawText(page, font, sig.label, labelX, y - signSize, signSize, C_TITLE, true);
    drawText(
      page,
      font,
      sig.name,
      nameX + (nameW - font.widthOfTextAtSize(sig.name, signSize)) / 2,
      y - signSize,
      signSize,
      C_TEXT
    );
    drawText(page, font, suffix, suffixX, y - signSize, signSize - 1, C_TEXT);
    page.drawRectangle({
      x: nameX,
      y: y - signSize - 9,
      width: right - nameX,
      height: 0.9,
      color: C_TEXT,
    });
    y -= signRowH;
  }

  return await pdfDoc.save();
}

/** 다운로드 파일명 — {문서명}_YYYYMMDD.pdf */
export function renewalPdfFilename(dateYmd: string, title = "계약갱신요구통지서"): string {
  return `${title.replace(/\s/g, "")}_${dateYmd.replace(/-/g, "")}.pdf`;
}
