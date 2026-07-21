"use client";

// 무료 도장 만들기 — 이름을 입력하면 여러 디자인의 붉은 인영(도장)을 자동 생성하고
//   갤러리에서 골라 쓰는 방식(모두싸인/싸인오케이/도뉴식). 또는 이미지 업로드.
//   · 스타일: 원형 이중테두리 / 원형 음각(낙관풍) / 굵은 단선 원 / 사각 전각 / 사각 음각 / 타원형
//   · 붉은 인주 톤. 결과는 투명배경 PNG dataURL(빈 이름이면 null).
//
// 2026-07-21 렌더 엔진 개편 — 기존 도장이 "워드로 그린 원"처럼 보이던 원인 4가지를 해결:
//   1) 글꼴: OS 기본 바탕체 → Noto Serif KR 900(본명조 최굵기, OFL 라이선스)
//      ※ 한글 전용 전서체(篆書體) 웹폰트는 눈누·공유마당·산돌구름 어디에도 없음(2026-07 실측).
//        국내 도장 생성 서비스들도 전서체 대신 궁서/명조를 쓰는 것이 사실상 표준.
//   2) 인주 질감: 밸류 노이즈 2겹(굵은 얼룩 + 잔 갈라짐)으로 알파를 깎아 인주가 고르게
//      묻지 않은 느낌을 냄. 픽셀 단위 순수 난수는 TV 노이즈처럼 보여 쓰지 않음.
//   3) 테두리: 외곽선을 따라 destination-out 으로 작은 원을 흩뿌려 가장자리를 깎아냄.
//   4) 재현성: 이름+스타일을 해시해 난수 시드로 사용 → 같은 사람은 언제 찍어도 같은 도장.
//      (계약서마다 도장 모양이 달라지면 위조 의심 대상이 되므로 필수)
import { useEffect, useRef, useState } from "react";

// 인장용 글꼴 — Noto Serif KR 900(본명조 최굵기). SIL OFL 이라 상업적 웹폰트 사용 자유.
//  ※ next/font/google 은 이 폰트의 korean 서브셋을 지원하지 않아(subsets 타입이 "latin" 뿐)
//    한글 글리프가 빠진다. 그래서 구글 폰트 CSS 를 런타임에 붙이고 로드를 기다리는 방식을 쓴다.
//    폰트 파일을 받아올 뿐 입력한 이름이 외부로 나가지는 않는다(렌더는 전부 브라우저 안에서 처리).
const SEAL_FAMILY = "Noto Serif KR";
const SEAL_FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@900&display=swap";

// 폰트 CSS <link> 를 문서에 한 번만 붙인다
function ensureSealFontLink() {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-seal-font="1"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = SEAL_FONT_CSS;
  link.setAttribute("data-seal-font", "1");
  document.head.appendChild(link);
}

interface Props {
  onChange?: (dataUrl: string | null) => void;
  onNameChange?: (name: string) => void; // 입력한 이름을 부모에 알림(파일명 등에 사용)
  defaultName?: string;
}

const RED = "#c8102e"; // 인주(주홍) 톤
const RENDER = 400; // 인영 렌더 캔버스 한 변(px, 고해상도)
// 자간·행간 여유(1=기본). 글자 중심을 인영 중심에서 이 배율만큼 벌려 살짝 넉넉하게.
// (글자 크기는 그대로 두고 간격만 넓힘. 1.1까지 올리면 4글자 상호가 사각 테두리에 닿아 1.08로 둠)
const CHAR_SPREAD = 1.08;
// 글자 크기 배율(1=기본). 살짝 줄여 테두리 여백을 넉넉하게(4글자 상호가 사각에서 빡빡하던 것 완화).
const CHAR_SCALE = 0.93;

// 제공 스타일 목록(순서 = 갤러리 순서)
const STYLES = [
  { key: "circle2", label: "원형·이중" },
  { key: "circleFill", label: "원형·낙관" },
  { key: "circleBold", label: "원형·굵은선" },
  { key: "square2", label: "사각·전각" },
  { key: "squareFill", label: "사각·음각" },
  { key: "ellipse", label: "타원형" },
] as const;
type StyleKey = (typeof STYLES)[number]["key"];

// 인주 질감 강도(0 = 질감 없음)
const TEXTURES = [
  { key: "none", label: "매끈", value: 0 },
  { key: "mid", label: "보통", value: 0.5 },
  { key: "strong", label: "강함", value: 0.72 },
] as const;
type TextureKey = (typeof TEXTURES)[number]["key"];

export function StampMaker({
  onChange,
  onNameChange,
  defaultName = "",
}: Props) {
  const [mode, setMode] = useState<"generate" | "upload">("generate");
  const [name, setName] = useState(defaultName);
  const [texture, setTexture] = useState<TextureKey>("mid");
  const [variants, setVariants] = useState<Record<StyleKey, string>>(
    {} as Record<StyleKey, string>
  );
  const [selected, setSelected] = useState<StyleKey>("circle2");
  const [fontReady, setFontReady] = useState(false);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // 글꼴이 실제로 로드된 뒤에 렌더해야 한다. 로드 전에 그리면 폴백 폰트로 그려진
  // 이미지가 그대로 굳어버림(canvas 는 나중에 폰트가 와도 다시 그리지 않음).
  useEffect(() => {
    let alive = true;
    const done = () => {
      if (alive) setFontReady(true);
    };
    if (typeof document === "undefined" || !document.fonts) {
      done();
      return;
    }
    ensureSealFontLink();
    document.fonts
      .load(`900 100px "${SEAL_FAMILY}"`)
      .then(() => document.fonts.ready)
      .then(done)
      .catch(done); // 실패해도 폴백(바탕체)으로 진행
    return () => {
      alive = false;
    };
  }, []);

  // 이름/질감 변경 → 모든 스타일 인영을 오프스크린 렌더해 dataURL 갱신
  useEffect(() => {
    if (mode !== "generate" || !fontReady) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setVariants({} as Record<StyleKey, string>);
      onChangeRef.current?.(null);
      return;
    }
    const chars = Array.from(trimmed).slice(0, 8);
    const strength =
      TEXTURES.find((t) => t.key === texture)?.value ?? 0.5;
    const next = {} as Record<StyleKey, string>;
    for (const s of STYLES) {
      next[s.key] = renderSeal(s.key, chars, strength);
    }
    setVariants(next);
    // 현재 선택 스타일의 결과를 부모에 반영(선택 유지)
    onChangeRef.current?.(next[selected] ?? next.circle2);
  }, [name, mode, selected, texture, fontReady]);

  function pick(key: StyleKey) {
    setSelected(key);
    if (variants[key]) onChangeRef.current?.(variants[key]);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      onChange?.(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      onChange?.(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  return (
    <div className="w-full">
      {/* 모드 전환 */}
      <div className="mb-3 inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode("generate")}
          className={`rounded-md px-3 py-1.5 transition ${
            mode === "generate" ? "bg-brand-600 text-white" : "text-slate-500"
          }`}
        >
          이름으로 만들기
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("upload");
            onChange?.(null);
          }}
          className={`rounded-md px-3 py-1.5 transition ${
            mode === "upload" ? "bg-brand-600 text-white" : "text-slate-500"
          }`}
        >
          이미지 업로드
        </button>
      </div>

      {mode === "generate" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                onNameChange?.(e.target.value);
              }}
              placeholder="이름 (예: 홍길동 / 화선기획)"
              maxLength={8}
              className="w-full max-w-[260px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            {/* 인주 질감 강도 */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
              {TEXTURES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTexture(t.key)}
                  className={`rounded-md px-2.5 py-1.5 transition ${
                    texture === t.key
                      ? "bg-brand-600 text-white"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {name.trim() ? (
            <>
              <p className="text-xs text-slate-500">
                마음에 드는 디자인을 선택하세요.
              </p>
              {/* 디자인 갤러리 */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {STYLES.map((s) => {
                  const url = variants[s.key];
                  const on = selected === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => pick(s.key)}
                      title={s.label}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 bg-white p-1.5 transition ${
                        on
                          ? "border-brand-600 ring-2 ring-brand-600/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={s.label}
                          className="h-16 w-16 object-contain"
                        />
                      ) : (
                        <span className="h-16 w-16" />
                      )}
                      <span
                        className={`text-[10px] ${
                          on ? "font-bold text-brand-700" : "text-slate-400"
                        }`}
                      >
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">
              이름을 입력하면 여러 디자인의 붉은 인영이 자동으로 만들어집니다.
            </p>
          )}
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
          />
          <p className="mt-1 text-xs text-slate-400">
            투명 배경 PNG 도장 이미지를 권장합니다.
          </p>
        </div>
      )}
    </div>
  );
}

// ── 시드 난수 ────────────────────────────────────────────────
// 같은 이름 → 같은 도장이 나와야 하므로 Math.random() 을 쓰지 않는다.

// FNV-1a 해시: 문자열 → 32bit 정수
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// mulberry32: 시드 하나로 재현 가능한 난수열 생성
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 질감 ────────────────────────────────────────────────────

// 밸류 노이즈: 저해상 격자를 만들어 이중선형 보간 → 부드러운 얼룩
// (픽셀마다 난수를 넣으면 TV 노이즈처럼 보여 인주 느낌이 안 난다)
function valueNoise(rnd: () => number, size: number, grid: number): Float32Array {
  const g = new Float32Array((grid + 1) * (grid + 1));
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const out = new Float32Array(size * size);
  const scale = grid / size;
  for (let y = 0; y < size; y++) {
    const gy = y * scale;
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    const sy = fy * fy * (3 - 2 * fy); // smoothstep
    for (let x = 0; x < size; x++) {
      const gx = x * scale;
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      const sx = fx * fx * (3 - 2 * fx);
      const a = g[y0 * (grid + 1) + x0];
      const b = g[y0 * (grid + 1) + x0 + 1];
      const c = g[(y0 + 1) * (grid + 1) + x0];
      const d = g[(y0 + 1) * (grid + 1) + x0 + 1];
      out[y * size + x] =
        (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
  }
  return out;
}

// 인주 질감: 알파를 노이즈로 깎아 얼룩·갈라짐을 만든다
function applyInkTexture(
  ctx: CanvasRenderingContext2D,
  rnd: () => number,
  strength: number
) {
  if (strength <= 0) return;
  const img = ctx.getImageData(0, 0, RENDER, RENDER);
  const d = img.data;
  const coarse = valueNoise(rnd, RENDER, 8); // 굵은 얼룩
  const fine = valueNoise(rnd, RENDER, 40); // 잔 갈라짐
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    if (d[i + 3] === 0) continue;
    const n = coarse[p] * 0.65 + fine[p] * 0.35;
    let k = 1;
    // 알파를 얕게만 깎는다(바닥값을 높게 유지) → 획이 얇아지지 않는다.
    // ※ 핀홀(반투명 반점)은 쓰지 않는다: 문서에 작게 축소되면 반점이 "끊긴 획"처럼
    //   보여 도장 획이 부분부분 얇고 부실해 보이던 주범이었다(2026-07-21 수정).
    if (n < 0.5) k = 1 - ((0.5 - n) / 0.5) * strength * 0.45;
    d[i + 3] = Math.max(0, Math.min(255, d[i + 3] * k));
  }
  ctx.putImageData(img, 0, 0);
}

// 거친 테두리: 외곽선을 따라 destination-out 원을 흩뿌려 가장자리를 깎아낸다
function roughenEdge(
  ctx: CanvasRenderingContext2D,
  rnd: () => number,
  shape: (t: number) => { x: number; y: number },
  strength: number
) {
  if (strength <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  const steps = 520;
  for (let i = 0; i < steps; i++) {
    if (rnd() > 0.3 * strength + 0.1) continue;
    const t = (i / steps) * Math.PI * 2;
    const pt = shape(t);
    const r = (rnd() * 1.8 + 0.4) * strength;
    const off = (rnd() - 0.45) * 3.0;
    ctx.beginPath();
    ctx.arc(pt.x + Math.cos(t) * off, pt.y + Math.sin(t) * off, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── 인영 렌더 ────────────────────────────────────────────────

// 외곽선 경로 함수: t(0~2π) → 좌표. 거친 테두리를 그릴 위치를 알려준다
type ShapePath = (t: number) => { x: number; y: number };

// 스타일별로 오프스크린 캔버스에 렌더 후 PNG dataURL 반환
function renderSeal(
  style: StyleKey,
  chars: string[],
  texture: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = RENDER;
  canvas.height = RENDER;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, RENDER, RENDER);
  const rnd = mulberry32(hashStr(chars.join("") + "|" + style));
  let shape: ShapePath;
  switch (style) {
    case "circle2":
      shape = circle(ctx, chars, { rings: "double" });
      break;
    case "circleFill":
      shape = circle(ctx, chars, { fill: true });
      break;
    case "circleBold":
      shape = circle(ctx, chars, { rings: "bold" });
      break;
    case "square2":
      shape = square(ctx, chars, {});
      break;
    case "squareFill":
      shape = square(ctx, chars, { fill: true });
      break;
    case "ellipse":
      shape = ellipse(ctx, chars);
      break;
  }
  if (texture > 0) {
    roughenEdge(ctx, rnd, shape, texture);
    applyInkTexture(ctx, rnd, texture);
  }
  return canvas.toDataURL("image/png");
}

// 인장용 글꼴. 웹폰트 로드 실패 시 바탕/명조로 폴백
function sealFont(size: number): string {
  return `900 ${size}px "${SEAL_FAMILY}", "Batang", "바탕", "AppleMyungjo", serif`;
}

function gridFor(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 1, rows: 2 };
  if (n === 3) return { cols: 1, rows: 3 };
  if (n === 4) return { cols: 2, rows: 2 };
  return { cols: 2, rows: Math.ceil(n / 2) };
}

// 글자를 영역 안에 배치.
//  · 1열(2~3글자 이름): 위→아래 세로쓰기
//  · 2열 이상(4글자 이상 상호): 읽는 순서 그대로 좌→우, 위→아래
//    (전통 인장은 우→좌 세로쓰기지만 현대 한글 상호는 읽기 어려워 쓰지 않는다)
function placeChars(
  ctx: CanvasRenderingContext2D,
  chars: string[],
  cx: number,
  cy: number,
  areaW: number,
  areaH: number,
  color: string
) {
  const n = chars.length;
  const { cols, rows } = gridFor(n);
  const cellW = areaW / cols;
  const cellH = areaH / rows;
  const left = cx - areaW / 2;
  const top = cy - areaH / 2;
  const fs =
    (n === 1
      ? Math.min(areaW, areaH) * 0.86
      : Math.min(cellW * 1.16, cellH * 1.04)) * CHAR_SCALE;
  ctx.fillStyle = color;
  ctx.font = sealFont(fs);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  chars.forEach((ch, i) => {
    let col: number;
    let row: number;
    if (cols === 1) {
      col = 0;
      row = i;
    } else {
      row = Math.floor(i / cols);
      col = i % cols;
    }
    // 자간·행간을 CHAR_SPREAD 배로 — 글자 중심을 인영 중심에서 그만큼 벌린다(크기는 유지)
    const x = cx + (left + (col + 0.5) * cellW - cx) * CHAR_SPREAD;
    const y = cy + (top + (row + 0.5) * cellH - cy) * CHAR_SPREAD;
    // 전각(篆刻) 느낌: 글자를 셀에 꽉 차게 가로로 살짝 늘림
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.06, 1.0);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

// 원/타원 내부 텍스트 영역 비율 계산 후 배치
function drawTextArea(
  ctx: CanvasRenderingContext2D,
  chars: string[],
  cx: number,
  cy: number,
  rIn: number,
  color: string
) {
  const { cols, rows } = gridFor(chars.length);
  let areaW: number;
  let areaH: number;
  if (cols === 1) {
    areaW = rIn * 1.25;
    areaH = rIn * (rows <= 1 ? 1.25 : rows === 2 ? 1.72 : 1.9);
  } else {
    const side = rIn * (chars.length === 4 ? 1.5 : 1.42);
    areaW = side;
    areaH = side;
  }
  placeChars(ctx, chars, cx, cy, areaW, areaH, color);
}

// 음각(글자를 파냄)은 흰색으로 칠하지 않고 실제로 뚫어야 투명배경 PNG 에서 자연스럽다
function punchText(
  ctx: CanvasRenderingContext2D,
  draw: (tc: CanvasRenderingContext2D) => void
) {
  const tmp = document.createElement("canvas");
  tmp.width = RENDER;
  tmp.height = RENDER;
  const tc = tmp.getContext("2d")!;
  draw(tc);
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}

// 원형 인장. opts: rings("double"|"bold") 또는 fill(음각=붉은 채움+파낸 글자)
function circle(
  ctx: CanvasRenderingContext2D,
  chars: string[],
  opts: { rings?: "double" | "bold"; fill?: boolean }
): ShapePath {
  const cx = RENDER / 2;
  const cy = RENDER / 2;
  const margin = 20;
  ctx.strokeStyle = RED;
  ctx.fillStyle = RED;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (opts.fill) {
    // 음각(낙관풍): 붉은 원 채움 + 가는 안쪽선과 글자를 파냄
    const r = RENDER / 2 - margin;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    punchText(ctx, (tc) => drawTextArea(tc, chars, cx, cy, r - 28, "#000"));
    return (t) => ({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
  }

  const outerLW = opts.rings === "bold" ? 26 : 17;
  const rOuter = RENDER / 2 - margin - outerLW / 2;
  ctx.lineWidth = outerLW;
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.stroke();
  let rInner = rOuter;
  if (opts.rings === "double") {
    rInner = rOuter - 19;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawTextArea(
    ctx,
    chars,
    cx,
    cy,
    rInner - (opts.rings === "bold" ? 20 : 10),
    RED
  );
  const rEdge = rOuter + outerLW / 2;
  return (t) => ({ x: cx + Math.cos(t) * rEdge, y: cy + Math.sin(t) * rEdge });
}

// 사각 인장(전각). fill=음각(붉은 채움+파낸 글자)
function square(
  ctx: CanvasRenderingContext2D,
  chars: string[],
  opts: { fill?: boolean }
): ShapePath {
  const cx = RENDER / 2;
  const cy = RENDER / 2;
  const margin = 22;
  ctx.strokeStyle = RED;
  ctx.fillStyle = RED;
  ctx.lineJoin = "miter";

  if (opts.fill) {
    const s = margin;
    ctx.fillRect(s, s, RENDER - s * 2, RENDER - s * 2);
    const g = s + 18;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 6;
    ctx.strokeRect(g, g, RENDER - g * 2, RENDER - g * 2);
    ctx.restore();
    const area = (RENDER - g * 2) * 0.9;
    punchText(ctx, (tc) => placeChars(tc, chars, cx, cy, area, area, "#000"));
  } else {
    const outerLW = 18;
    const o = margin + outerLW / 2;
    ctx.lineWidth = outerLW;
    ctx.strokeRect(o, o, RENDER - o * 2, RENDER - o * 2);
    const iOff = o + 16;
    const innerSide = RENDER - iOff * 2;
    ctx.lineWidth = 5.5;
    ctx.strokeRect(iOff, iOff, innerSide, innerSide);
    placeChars(ctx, chars, cx, cy, innerSide * 0.92, innerSide * 0.92, RED);
  }

  // 사각 외곽 경로(t 를 둘레 길이로 환산)
  const m = margin;
  const w = RENDER - m * 2;
  return (t) => {
    const u = (((t / (Math.PI * 2)) % 1) + 1) % 1;
    const p = u * 4;
    if (p < 1) return { x: m + w * p, y: m };
    if (p < 2) return { x: m + w, y: m + w * (p - 1) };
    if (p < 3) return { x: m + w * (3 - p), y: m + w };
    return { x: m, y: m + w * (4 - p) };
  };
}

// 타원형 인장 — 이중 테두리 타원. 세로로 긴 형태.
//   ※ 가로로 긴 도장은 한국에 없음(사용자 확인, 2026-07-21). rx < ry 로 세워 둔다.
function ellipse(ctx: CanvasRenderingContext2D, chars: string[]): ShapePath {
  const cx = RENDER / 2;
  const cy = RENDER / 2;
  const rx = RENDER / 2 - 68;
  const ry = RENDER / 2 - 26;
  ctx.strokeStyle = RED;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 17, ry - 17, 0, 0, Math.PI * 2);
  ctx.stroke();
  placeChars(ctx, chars, cx, cy, (rx - 24) * 1.5, (ry - 30) * 1.62, RED);
  return (t) => ({
    x: cx + Math.cos(t) * (rx + 7),
    y: cy + Math.sin(t) * (ry + 7),
  });
}
