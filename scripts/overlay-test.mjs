// 원본 PDF에 샘플 데이터를 오버레이해서 정확한 필드 좌표 파악
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, '..', 'public', 'forms', 'housing-form.pdf');
const FONT_PATH = path.join(__dirname, '..', 'public', 'fonts', 'NotoSansKR-Regular.otf');
const OUT = path.join(__dirname, '..', 'public', 'forms', 'overlay-test.pdf');

async function main() {
  const [pdfBytes, fontBytes] = await Promise.all([readFile(TEMPLATE), readFile(FONT_PATH)]);
  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(new Uint8Array(fontBytes), { subset: false });

  const page = doc.getPages()[0];
  const { width, height } = page.getSize();
  console.log(`Page: ${width} x ${height}`);

  const BLUE = rgb(0, 0, 0.9);
  const size = 8;

  // 제출인 정보 — 여러 y값을 시도해서 어디에 맞는지 확인
  const candidates = [
    // 이름값 후보들
    { x: 60, y: 748, text: '홍길동(y748)' },
    { x: 60, y: 740, text: '홍길동(y740)' },
    { x: 60, y: 732, text: '홍길동(y732)' },
    { x: 60, y: 724, text: '홍길동(y724)' },
    { x: 60, y: 716, text: '홍길동(y716)' },
    { x: 60, y: 708, text: '홍길동(y708)' },

    // 주민번호 후보들
    { x: 310, y: 748, text: '800101(y748)' },
    { x: 310, y: 740, text: '800101(y740)' },
    { x: 310, y: 732, text: '800101(y732)' },
    { x: 310, y: 724, text: '800101(y724)' },

    // 주소 후보들
    { x: 60, y: 710, text: '서울 강남구 테헤란로(y710)' },
    { x: 60, y: 700, text: '서울 강남구 테헤란로(y700)' },
    { x: 60, y: 692, text: '서울 강남구 테헤란로(y692)' },
    { x: 60, y: 684, text: '서울 강남구 테헤란로(y684)' },

    // 전화번호 후보들
    { x: 420, y: 700, text: '010-1234(y700)' },
    { x: 420, y: 692, text: '010-1234(y692)' },
    { x: 420, y: 684, text: '010-1234(y684)' },
  ];

  for (const c of candidates) {
    page.drawText(c.text, { x: c.x, y: c.y, size, font, color: BLUE });
  }

  await writeFile(OUT, await doc.save());
  console.log('오버레이 테스트 저장:', OUT);
}

main().catch(console.error);
