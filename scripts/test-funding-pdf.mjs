// 자금조달계획서 PDF 생성 통합 테스트
import { writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// TypeScript 모듈을 직접 실행할 수 없으므로 pdf-lib 직접 사용
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'fs/promises';

const TEMPLATE = path.join(__dirname, '..', 'public', 'forms', 'housing-form.pdf');
const FONT_PATH = path.join(__dirname, '..', 'public', 'fonts', 'NotoSansKR-Regular.otf');
const OUT = path.join(__dirname, '..', 'public', 'forms', 'test-overlay-result.pdf');

const BLACK = rgb(0, 0, 0);
const DARK = rgb(0.1, 0.1, 0.1);

// 샘플 데이터
const sample = {
  name: '홍길동',
  idFront: '800101',
  idBack: '1234567',
  address: '서울특별시 강남구 테헤란로 123',
  phone: '010-1234-5678',
  tradeAmount: 900000000,  // 9억
  deposit: 200000000,      // ② 예금 2억
  stocks: 50000000,        // ③ 주식 5천
  gift: 100000000,         // ④ 증여 1억
  inheritance: 0,
  cash: 30000000,          // ⑤ 현금 3천
  realEstateSale: 0,       // ⑥ 부동산
  mortgageLoan: 300000000, // ⑧ 담보대출 3억
  creditLoan: 0,
  businessLoan: 0,
  rentalDeposit: 0,        // ⑨
  companySupportOrPrivateLoan: 0,
  otherLoan: 50000000,     // ⑪ 기타 5천
  cashPayment: 850000000,  // ⑮ 계좌이체
  depositSuccession: 0,
  transferAmount: 0,
  moveInPlan: '2026년 8월',
};

function n(v) { return v ? v.toLocaleString('ko-KR') : ''; }
function maskId(f, b) { return `${f}-${b.charAt(0)}******`; }

function drawRight(page, font, text, xRight, y, size) {
  if (!text) return;
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - w, y, size, font, color: DARK });
}

function drawLeft(page, font, text, x, y, size) {
  if (!text) return;
  page.drawText(text, { x, y, size, font, color: DARK });
}

async function main() {
  const [pdfBytes, fontBytes] = await Promise.all([readFile(TEMPLATE), readFile(FONT_PATH)]);
  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(new Uint8Array(fontBytes), { subset: false });

  const page = doc.getPages()[0];
  const SZ = 8;

  // 제출인
  drawLeft(page, font, sample.name, 165, 716, SZ);
  drawLeft(page, font, maskId(sample.idFront, sample.idBack), 469, 714, SZ);
  drawLeft(page, font, sample.address, 183, 683, SZ);
  drawLeft(page, font, sample.phone, 432, 683, SZ);

  // 자기자금
  drawRight(page, font, n(sample.deposit), 333, 639, SZ);
  drawRight(page, font, n(sample.stocks), 528, 639, SZ);
  if (sample.gift) drawRight(page, font, n(sample.gift), 328, 573, SZ);
  drawRight(page, font, n(sample.cash), 526, 573, SZ);

  const selfTotal = sample.deposit + sample.stocks + sample.gift + sample.cash;
  drawRight(page, font, n(selfTotal), 528, 475, SZ);

  // 차입금
  drawRight(page, font, n(sample.mortgageLoan), 525, 425, SZ);
  drawRight(page, font, n(sample.mortgageLoan), 259, 375, SZ);  // ⑧ 합계
  drawRight(page, font, n(sample.otherLoan), 333, 287, SZ);     // ⑪

  const loanTotal = sample.mortgageLoan + sample.otherLoan;
  drawRight(page, font, n(loanTotal), 528, 257, SZ);  // ⑫ 소계

  const grandTotal = selfTotal + loanTotal;
  drawRight(page, font, n(grandTotal), 528, 243, SZ); // ⑬ 합계

  // ⑭ 지급방식
  drawRight(page, font, n(sample.tradeAmount), 493, 223, SZ);
  drawRight(page, font, n(sample.cashPayment), 493, 208, SZ);

  // 날짜
  drawRight(page, font, '2026', 466, 67, SZ);
  drawRight(page, font, '6', 497, 67, SZ);
  drawRight(page, font, '1', 528, 67, SZ);
  drawLeft(page, font, sample.name, 295, 55, SZ);

  await writeFile(OUT, await doc.save());
  console.log('테스트 PDF 생성 완료:', OUT);
}

main().catch(console.error);
