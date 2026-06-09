// 원본 PDF form field 및 페이지 크기 검사 스크립트
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_PATH = path.join(__dirname, '..', 'public', 'forms', 'housing-form.pdf');

async function main() {
  const bytes = await readFile(PDF_PATH);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  const pages = doc.getPages();
  console.log(`총 페이지 수: ${pages.length}`);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    console.log(`\n[Page ${i + 1}] size: ${width.toFixed(2)} x ${height.toFixed(2)}`);
  }

  // AcroForm (fillable form fields) 확인
  try {
    const form = doc.getForm();
    const fields = form.getFields();
    if (fields.length > 0) {
      console.log(`\nAcroForm 필드 수: ${fields.length}`);
      fields.forEach(f => {
        console.log(`  - ${f.getName()} (${f.constructor.name})`);
      });
    } else {
      console.log('\nAcroForm 필드 없음 — 좌표 기반 오버레이 방식 필요');
    }
  } catch (e) {
    console.log('\nAcroForm 없음:', e.message);
  }
}

main().catch(console.error);
