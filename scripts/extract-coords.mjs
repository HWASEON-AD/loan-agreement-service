// pdfjs-dist로 원본 PDF 텍스트 좌표 추출
// Node.js 환경 — canvas 없이 실행하기 위해 fake canvas 설정 필요
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_PATH = path.join(__dirname, '..', 'public', 'forms', 'housing-form.pdf');

async function main() {
  // pdfjs-dist 동적 임포트 (ESM)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => null);
  if (!pdfjsLib) {
    console.log('pdfjs-dist 없음, pdf-lib 방식으로 시도');
    return tryPdfLib();
  }

  const data = new Uint8Array(await readFile(PDF_PATH));
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;

  console.log(`총 페이지: ${doc.numPages}`);
  const page = await doc.getPage(1);
  const { width, height } = page.getViewport({ scale: 1 });
  console.log(`Page 1 size: ${width} x ${height}`);

  const textContent = await page.getTextContent();

  // 각 텍스트 아이템의 위치 출력 (y 내림차순 = 폼 위에서 아래로)
  const items = textContent.items
    .filter(item => item.str.trim().length > 0)
    .map(item => ({
      text: item.str.trim(),
      x: Math.round(item.transform[4]),
      // pdfjs y는 bottom-left 기준
      y: Math.round(item.transform[5]),
    }))
    .sort((a, b) => b.y - a.y);

  console.log('\n=== 텍스트 좌표 목록 (y 내림차순) ===');
  for (const item of items.slice(0, 80)) {
    console.log(`y=${item.y.toString().padStart(4)}  x=${item.x.toString().padStart(4)}  "${item.text}"`);
  }
}

async function tryPdfLib() {
  const { PDFDocument } = await import('pdf-lib');
  const bytes = await readFile(PDF_PATH);
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();
  console.log(`Pages: ${pages.length}, Size: ${pages[0].getWidth()} x ${pages[0].getHeight()}`);
  console.log('pdf-lib은 텍스트 위치 추출 불가 — pdfjs-dist 설치 필요');
  console.log('실행: npm install pdfjs-dist');
}

main().catch(console.error);
