// 원본 PDF 위에 기준점 찍어서 좌표 캘리브레이션
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, '..', 'public', 'forms', 'housing-form.pdf');
const FONT_PATH = path.join(__dirname, '..', 'public', 'fonts', 'NotoSansKR-Regular.otf');
const OUT = path.join(__dirname, '..', 'public', 'forms', 'calibrate-test.pdf');

const RED = rgb(1, 0, 0);
const BLUE = rgb(0, 0, 1);
const GREEN = rgb(0, 0.6, 0);

async function main() {
  const [pdfBytes, fontBytes] = await Promise.all([readFile(TEMPLATE), readFile(FONT_PATH)]);
  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(new Uint8Array(fontBytes), { subset: false });

  const page = doc.getPages()[0];
  const { width, height } = page.getSize();
  console.log(`Page size: ${width} x ${height}`);

  // Y 기준점: 위에서 아래로 20pt 간격으로 빨간 선 + 좌표 텍스트
  for (let y = height - 20; y > 20; y -= 20) {
    page.drawLine({ start: { x: 0, y }, end: { x: 8, y }, thickness: 0.5, color: RED });
    if (y % 40 === 0) {
      page.drawText(`y=${Math.round(y)}`, { x: 0, y: y + 1, size: 4, font, color: RED });
    }
  }

  // X 기준점
  for (let x = 0; x < width; x += 20) {
    page.drawLine({ start: { x, y: height - 1 }, end: { x, y: height - 6 }, thickness: 0.5, color: BLUE });
    if (x % 60 === 0) {
      page.drawText(`${Math.round(x)}`, { x: x + 1, y: height - 10, size: 4, font, color: BLUE });
    }
  }

  // 주요 예상 좌표에 초록 마커
  const markers = [
    { x: 30, y: 790, label: '제목?' },
    { x: 30, y: 770, label: '접수번호행?' },
    { x: 30, y: 745, label: '성명라벨?' },
    { x: 30, y: 730, label: '성명값?' },
    { x: 30, y: 715, label: '주소라벨?' },
    { x: 30, y: 700, label: '주소값?' },
    { x: 30, y: 680, label: '자금조달헤더?' },
  ];

  for (const m of markers) {
    page.drawCircle({ x: m.x, y: m.y, size: 3, color: GREEN });
    page.drawText(m.label, { x: m.x + 5, y: m.y - 2, size: 5, font, color: GREEN });
  }

  await writeFile(OUT, await doc.save());
  console.log('캘리브레이션 PDF 저장:', OUT);
}

main().catch(console.error);
