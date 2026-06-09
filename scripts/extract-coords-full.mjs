import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_PATH = path.join(__dirname, '..', 'public', 'forms', 'housing-form.pdf');

async function main() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await readFile(PDF_PATH));
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;

  for (let pageNum = 1; pageNum <= 1; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items
      .filter(item => item.str.trim().length > 0)
      .map(item => ({
        text: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        w: Math.round(item.width),
      }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    console.log(`\n=== Page ${pageNum} 전체 텍스트 ===`);
    for (const item of items) {
      console.log(`y=${String(item.y).padStart(4)} x=${String(item.x).padStart(4)} w=${String(item.w).padStart(4)}  "${item.text}"`);
    }
  }
}

main().catch(console.error);
