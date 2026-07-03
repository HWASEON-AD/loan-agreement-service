"use client";

// 서명/도장 입력 — 탭 3개:
//   ① 직접 그리기: react-signature-canvas 손글씨
//   ② 이름으로 만들기: 이름 입력 → 여러 필기체 서명 자동 생성 → 선택
//   ③ 도장: 이름 → 붉은 인영 자동 생성(갤러리) 또는 이미지 업로드
// 선택 결과는 투명배경 PNG dataURL 로 onChange 전달(없으면 null). 기존 SignatureCanvasField 대체.
import React, { useEffect, useRef, useState } from "react";
import SignaturePad from "react-signature-canvas";
import { Button } from "./ui/Button";
import { StampMaker } from "./StampMaker";

interface Props {
  onChange?: (dataUrl: string | null) => void;
  defaultName?: string;
}

const INK = "#0f2544";
const SIG_W = 520;
const SIG_H = 200;

const SIG_STYLES = [
  { key: "script", label: "흘림체", font: 'italic 92px "Segoe Script","Bradley Hand","Apple Chancery",cursive', flourish: "underline" },
  { key: "brush", label: "붓글씨", font: '700 96px "Batang","바탕",serif', flourish: "sweep" },
  { key: "slant", label: "기울임", font: 'italic 700 90px "Nanum Pen Script","Apple SD Gothic Neo",sans-serif', flourish: "underline" },
  { key: "elegant", label: "정자체", font: '600 84px "Nanum Myeongjo","AppleMyungjo",serif', flourish: "line" },
] as const;
type SigStyle = (typeof SIG_STYLES)[number]["key"];

export function SignatureStampField({ onChange, defaultName = "" }: Props) {
  const [tab, setTab] = useState<"draw" | "type" | "stamp">("draw");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // ── 직접 그리기 ──
  const padRef = useRef<SignaturePad>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const handleEnd = () => {
    const pad = padRef.current;
    if (pad && !pad.isEmpty()) {
      setHasDrawn(true);
      onChangeRef.current?.(pad.getCanvas().toDataURL("image/png"));
    }
  };
  const handleClear = () => {
    padRef.current?.clear();
    setHasDrawn(false);
    onChangeRef.current?.(null);
  };

  // ── 이름으로 만들기 ──
  const [name, setName] = useState(defaultName);
  const [variants, setVariants] = useState<Record<SigStyle, string>>({} as Record<SigStyle, string>);
  const [pick, setPick] = useState<SigStyle>("script");
  useEffect(() => {
    if (tab !== "type") return;
    const t = name.trim();
    if (!t) {
      setVariants({} as Record<SigStyle, string>);
      onChangeRef.current?.(null);
      return;
    }
    const next = {} as Record<SigStyle, string>;
    for (const s of SIG_STYLES) next[s.key] = renderSignature(t, s.font, s.flourish, INK);
    setVariants(next);
    onChangeRef.current?.(next[pick] ?? next.script);
  }, [name, tab, pick]);

  function switchTab(t: "draw" | "type" | "stamp") {
    setTab(t);
    onChangeRef.current?.(null); // 탭 전환 시 이전 선택 초기화
  }

  return (
    <div className="w-full">
      {/* 탭 */}
      <div className="mb-3 inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
        {([
          ["draw", "직접 그리기"],
          ["type", "이름으로 만들기"],
          ["stamp", "도장"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => switchTab(k)}
            className={`rounded-md px-3 py-1.5 transition ${
              tab === k ? "bg-brand-600 text-white" : "text-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "draw" && (
        <div>
          <div className="overflow-hidden rounded-xl border-2 border-dashed border-brand-300 bg-white">
            <SignaturePad
              ref={padRef}
              onEnd={handleEnd}
              canvasProps={{
                className: "sig-canvas w-full",
                height: 200,
                style: { width: "100%", height: 200, touchAction: "none" },
              }}
              penColor={INK}
              backgroundColor="rgba(255,255,255,1)"
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-slate-400">위 영역에 마우스 또는 손가락으로 서명해주세요.</p>
            <Button variant="ghost" type="button" onClick={handleClear}>
              다시 쓰기
            </Button>
          </div>
          {!hasDrawn && <p className="mt-1 text-xs text-amber-600">아직 서명하지 않았습니다.</p>}
        </div>
      )}

      {tab === "type" && (
        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 (예: 홍길동)"
            maxLength={10}
            className="w-full max-w-[260px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          {name.trim() ? (
            <>
              <p className="text-xs text-slate-500">마음에 드는 서명을 선택하세요.</p>
              <div className="grid grid-cols-2 gap-2">
                {SIG_STYLES.map((s) => {
                  const url = variants[s.key];
                  const on = pick === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setPick(s.key)}
                      style={{ height: 88 }}
                      className={`flex items-center justify-center rounded-xl border-2 bg-white p-2 transition ${
                        on ? "border-brand-600 ring-2 ring-brand-600/20" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={s.label} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-xs text-slate-300">{s.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">이름을 입력하면 여러 스타일의 서명이 자동으로 만들어집니다.</p>
          )}
        </div>
      )}

      {tab === "stamp" && <StampMaker defaultName={defaultName} onChange={(u) => onChangeRef.current?.(u)} />}
    </div>
  );
}

// 이름 → 필기체 서명 PNG dataURL
function renderSignature(name: string, font: string, flourish: string, color: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = SIG_W;
  canvas.height = SIG_H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, SIG_W, SIG_H);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = parseInt(font.match(/(\d+)px/)?.[1] || "90", 10);
  const setF = (s: number) => (ctx.font = font.replace(/\d+px/, `${s}px`));
  setF(size);
  while (ctx.measureText(name).width > SIG_W - 80 && size > 28) {
    size -= 4;
    setF(size);
  }
  const cx = SIG_W / 2;
  const cy = SIG_H / 2 - 6;
  ctx.fillText(name, cx, cy);
  const w = ctx.measureText(name).width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const yb = cy + size * 0.5;
  if (flourish === "underline") {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - 10, yb);
    ctx.quadraticCurveTo(cx, yb + 14, cx + w / 2 + 18, yb - 4);
    ctx.stroke();
  } else if (flourish === "sweep") {
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - 16, yb + 6);
    ctx.bezierCurveTo(cx - w / 4, yb + 22, cx + w / 4, yb - 10, cx + w / 2 + 26, yb + 8);
    ctx.stroke();
  } else if (flourish === "line") {
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, yb + 4);
    ctx.lineTo(cx + w / 2, yb + 4);
    ctx.stroke();
  }
  return canvas.toDataURL("image/png");
}
