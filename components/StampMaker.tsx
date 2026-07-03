"use client";

// 무료 도장 만들기 — 이름 입력 → 여러 디자인의 붉은 인영을 자동 생성, 갤러리에서 선택. 또는 이미지 업로드.
//   스타일: 원형·이중 / 원형·낙관(음각) / 원형·굵은선 / 사각·전각 / 사각·음각 / 타원형.
//   결과는 투명배경 PNG dataURL(빈 이름이면 null).
import { useEffect, useRef, useState } from "react";

interface Props {
  onChange?: (dataUrl: string | null) => void;
  defaultName?: string;
}

const RED = "#c8102e";
const RENDER = 400;

const STYLES = [
  { key: "circle2", label: "원형·이중" },
  { key: "circleFill", label: "원형·낙관" },
  { key: "circleBold", label: "원형·굵은선" },
  { key: "square2", label: "사각·전각" },
  { key: "squareFill", label: "사각·음각" },
  { key: "ellipse", label: "타원형" },
] as const;
type StyleKey = (typeof STYLES)[number]["key"];

export function StampMaker({ onChange, defaultName = "" }: Props) {
  const [mode, setMode] = useState<"generate" | "upload">("generate");
  const [name, setName] = useState(defaultName);
  const [variants, setVariants] = useState<Record<StyleKey, string>>(
    {} as Record<StyleKey, string>
  );
  const [selected, setSelected] = useState<StyleKey>("circle2");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (mode !== "generate") return;
    const t = name.trim();
    if (!t) {
      setVariants({} as Record<StyleKey, string>);
      onChangeRef.current?.(null);
      return;
    }
    const chars = Array.from(t).slice(0, 8);
    const next = {} as Record<StyleKey, string>;
    for (const s of STYLES) next[s.key] = renderSeal(s.key, chars);
    setVariants(next);
    onChangeRef.current?.(next[selected] ?? next.circle2);
  }, [name, mode, selected]);

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
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 (예: 홍길동)"
            maxLength={8}
            className="w-full max-w-[260px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          {name.trim() ? (
            <>
              <p className="text-xs text-slate-500">마음에 드는 디자인을 선택하세요.</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {STYLES.map((s) => {
                  const url = variants[s.key];
                  const on = selected === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        setSelected(s.key);
                        if (variants[s.key]) onChangeRef.current?.(variants[s.key]);
                      }}
                      title={s.label}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 bg-white p-1.5 transition ${
                        on
                          ? "border-brand-600 ring-2 ring-brand-600/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={s.label} className="h-16 w-16 object-contain" />
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
          <p className="mt-1 text-xs text-slate-400">투명 배경 PNG 도장 이미지를 권장합니다.</p>
        </div>
      )}
    </div>
  );
}

// ── 인영 렌더 (순수 canvas) ─────────────────────────────
function renderSeal(style: StyleKey, chars: string[]): string {
  const canvas = document.createElement("canvas");
  canvas.width = RENDER;
  canvas.height = RENDER;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, RENDER, RENDER);
  switch (style) {
    case "circle2": circle(ctx, chars, { rings: "double" }); break;
    case "circleFill": circle(ctx, chars, { fill: true }); break;
    case "circleBold": circle(ctx, chars, { rings: "bold" }); break;
    case "square2": square(ctx, chars, {}); break;
    case "squareFill": square(ctx, chars, { fill: true }); break;
    case "ellipse": ellipse(ctx, chars); break;
  }
  return canvas.toDataURL("image/png");
}

function sealFont(size: number): string {
  return `bold ${size}px "Batang", "바탕", "Nanum Myeongjo", "AppleMyungjo", serif`;
}
function gridFor(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 1, rows: 2 };
  if (n === 3) return { cols: 1, rows: 3 };
  if (n === 4) return { cols: 2, rows: 2 };
  return { cols: 2, rows: Math.ceil(n / 2) };
}
function placeChars(
  ctx: CanvasRenderingContext2D, chars: string[],
  cx: number, cy: number, areaW: number, areaH: number, color: string
) {
  const n = chars.length;
  const { cols, rows } = gridFor(n);
  const cellW = areaW / cols, cellH = areaH / rows;
  const left = cx - areaW / 2, top = cy - areaH / 2;
  const fs = n === 1 ? Math.min(areaW, areaH) * 0.72 : Math.min(cellW * 0.94, cellH * 0.88);
  ctx.fillStyle = color;
  ctx.font = sealFont(fs);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  chars.forEach((ch, i) => {
    const col = Math.floor(i / rows), row = i % rows;
    const leftIndex = cols - 1 - col;
    ctx.fillText(ch, left + (leftIndex + 0.5) * cellW, top + (row + 0.5) * cellH);
  });
}
function drawTextArea(ctx: CanvasRenderingContext2D, chars: string[], cx: number, cy: number, rIn: number, color: string) {
  const { cols, rows } = gridFor(chars.length);
  let areaW: number, areaH: number;
  if (cols === 1) {
    areaW = rIn * 1.05;
    areaH = rIn * (rows <= 1 ? 1.05 : rows === 2 ? 1.5 : 1.62);
  } else {
    const side = rIn * (chars.length === 4 ? 1.3 : 1.22);
    areaW = side; areaH = side;
  }
  placeChars(ctx, chars, cx, cy, areaW, areaH, color);
}
function circle(ctx: CanvasRenderingContext2D, chars: string[], opts: { rings?: "double" | "bold"; fill?: boolean }) {
  const cx = RENDER / 2, cy = RENDER / 2, margin = 22;
  ctx.strokeStyle = RED; ctx.fillStyle = RED; ctx.lineJoin = "round"; ctx.lineCap = "round";
  if (opts.fill) {
    const r = RENDER / 2 - margin;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, r - 22, 0, Math.PI * 2); ctx.stroke();
    drawTextArea(ctx, chars, cx, cy, (r - 30) * 1.0, "#fff");
    return;
  }
  const outerLW = opts.rings === "bold" ? 22 : 13;
  const rOuter = RENDER / 2 - margin - outerLW / 2;
  ctx.lineWidth = outerLW;
  ctx.beginPath(); ctx.arc(cx, cy, rOuter, 0, Math.PI * 2); ctx.stroke();
  let rInner = rOuter;
  if (opts.rings === "double") {
    rInner = rOuter - 16; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, rInner, 0, Math.PI * 2); ctx.stroke();
  }
  drawTextArea(ctx, chars, cx, cy, rInner - (opts.rings === "bold" ? 18 : 8), RED);
}
function square(ctx: CanvasRenderingContext2D, chars: string[], opts: { fill?: boolean }) {
  const cx = RENDER / 2, cy = RENDER / 2, margin = 24;
  ctx.strokeStyle = RED; ctx.fillStyle = RED; ctx.lineJoin = "miter";
  if (opts.fill) {
    const s = margin;
    ctx.fillRect(s, s, RENDER - s * 2, RENDER - s * 2);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 5;
    const g = s + 20;
    ctx.strokeRect(g, g, RENDER - g * 2, RENDER - g * 2);
    const area = (RENDER - g * 2) * 0.86;
    placeChars(ctx, chars, cx, cy, area, area, "#fff");
    return;
  }
  const outerLW = 15, o = margin + outerLW / 2;
  ctx.lineWidth = outerLW;
  ctx.strokeRect(o, o, RENDER - o * 2, RENDER - o * 2);
  const iOff = o + 16, innerSide = RENDER - iOff * 2;
  ctx.lineWidth = 4;
  ctx.strokeRect(iOff, iOff, innerSide, innerSide);
  placeChars(ctx, chars, cx, cy, innerSide * 0.88, innerSide * 0.88, RED);
}
function ellipse(ctx: CanvasRenderingContext2D, chars: string[]) {
  const cx = RENDER / 2, cy = RENDER / 2, rx = RENDER / 2 - 30, ry = RENDER / 2 - 70;
  ctx.strokeStyle = RED; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx - 16, ry - 16, 0, 0, Math.PI * 2); ctx.stroke();
  placeChars(ctx, chars, cx, cy, (rx - 30) * 1.35, (ry - 26) * 1.4, RED);
}
