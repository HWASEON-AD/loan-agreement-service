// 계약갱신 서식 기능(/renewal) 문구·구조 린트
//
// ★ 왜 필요한가
//   이 기능의 제일 큰 장기 리스크는 "운영 중 기능 표류"다.
//   6개월 뒤 누군가 좋은 뜻으로 "행사 가능합니다" 배지를 달거나 "AI로 문구 다듬기"를 붙이면
//   그 순간 개별 사안에 대한 결론·법률상담이 되어 선을 넘는다.
//   사람 기억에 맡기지 말고 기계가 막는다.
//
//   ★경계 원리: 주어가 '법령·조문·산식'이면 정보, '귀하·귀하의 계약'이면 결론.
//   → 아래 목록은 "결론형 출력"과 "LLM 개입"만 좁게 잡는다.
//     '상담'·'검토' 같은 낱말은 면책 고지에서 정당하게 쓰이므로(예: "법률상담을 하지 않습니다")
//     낱말 단위로 잡지 않는다. 오탐이 잦은 린트는 곧 무시당한다.
//
// 실행: npm run lint:renewal

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";

const ROOT = process.cwd();

// 🚨 파일 목록을 하드코딩하지 말 것.
//   이 린트가 막으려는 시나리오("6개월 뒤 누군가 좋은 뜻으로 '행사 가능' 배지를 단다")는
//   거의 확실히 **새 파일**로 온다. 열거 방식은 자기 위협모델을 못 막는다.
//   → 계약갱신 기능이 사는 디렉터리·파일명 규칙을 통째로 훑는다.
const SCAN_DIRS = ["app/renewal", "components/renewal", "app/api/renewal"];
const SCAN_LIB_PREFIX = "renewal-";
const EXTS = [".ts", ".tsx", ".mjs"];

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return out;
  }
  for (const name of entries) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) out.push(...walk(rel));
    else if (EXTS.some((e) => name.endsWith(e))) out.push(rel);
  }
  return out;
}

function collectTargets() {
  const files = [];
  for (const d of SCAN_DIRS) files.push(...walk(d));
  // lib/renewal-*.ts
  try {
    for (const name of readdirSync(join(ROOT, "lib"))) {
      if (name.startsWith(SCAN_LIB_PREFIX) && EXTS.some((e) => name.endsWith(e))) {
        files.push(`lib/${name}`);
      }
    }
  } catch {
    /* ignored */
  }
  return files.map((f) => f.split(sep).join("/")).sort();
}

const TARGETS = collectTargets();

if (TARGETS.length === 0) {
  console.error("[wording-lint] 검사 대상 파일을 하나도 찾지 못했습니다. 경로 규칙을 확인하세요.");
  process.exit(1);
}

// ① 결론형 출력 — 서비스가 이용자의 사안에 대해 답을 내려 버리는 표현
const CONCLUSION = [
  "행사 가능",
  "행사할 수 있습니다",
  "요구할 수 있습니다",
  "요건을 충족",
  "요건에 해당",
  "유효합니다",
  "무효입니다",
  "위법입니다",
  "적법합니다",
  "거절할 수 없습니다",
  "거부하면 됩니다",
  "소진되었습니다",
  "소멸하였습니다",
  "유리합니다",
  "안전합니다",
  "추천드립니다",
  "진단",
  "자가진단",
  "참고용 조언",
  "법률 자문",
];

// ② LLM/AI 개입 — 이 파이프라인의 LLM 호출은 0회여야 한다
const AI = [
  "anthropic",
  "openai",
  "@ai-sdk",
  "generateText",
  "createCompletion",
  "gpt-",
  "claude-",
];

// ③ 되살아나면 안 되는 기능 (선행 법률검토에서 명시적으로 배제한 것들)
const BANNED_FEATURE = [
  "갱신거절 통지",
  "거절 사유 선택",
  "변호사 연결",
  "전문가 검토 완료",
  "발송 대행",
];

// 주석 줄은 건너뛴다 — 금지 목록 자체를 설명하는 주석에 걸리면 린트가 무의미해진다
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

let failed = 0;

function scan(rel) {
  let src;
  try {
    src = readFileSync(join(ROOT, rel), "utf8");
  } catch {
    console.error(`[wording-lint] 대상 파일 없음: ${rel}`);
    failed++;
    return;
  }

  src.split(/\r?\n/).forEach((line, i) => {
    if (isComment(line)) return;
    const hit = (list, kind) => {
      for (const word of list) {
        if (line.toLowerCase().includes(word.toLowerCase())) {
          console.error(`[${kind}] ${rel}:${i + 1}  «${word}»`);
          console.error(`         ${line.trim().slice(0, 110)}`);
          failed++;
        }
      }
    };
    hit(CONCLUSION, "결론형 출력");
    hit(AI, "LLM 개입");
    hit(BANNED_FEATURE, "배제된 기능");
  });
}

TARGETS.forEach(scan);

if (failed > 0) {
  console.error(
    `\n❌ 계약갱신 서식 문구 검사 실패 (${failed}건)\n` +
      `   이 기능은 개별 사안에 대한 결론을 내지 않고 법령·산식·서식만 제공한다는 전제로 설계되어 있습니다.\n` +
      `   문구가 정당한 사유로 필요하다면 검사 목록(scripts/check-renewal-wording.mjs)을\n` +
      `   근거와 함께 고치고, 왜 괜찮은지 커밋 메시지에 남기세요.\n`
  );
  process.exit(1);
}

console.log(`✅ 계약갱신 서식 문구 검사 통과 (${TARGETS.length}개 파일)`);
