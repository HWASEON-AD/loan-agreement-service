"use client";

// 손글씨 서명 캔버스 — react-signature-canvas 래퍼
import React, { useRef, useState } from "react";
import SignaturePad from "react-signature-canvas";
import { Button } from "./ui/Button";

interface Props {
  // 서명 완료 시 base64 PNG dataURL 전달
  onChange?: (dataUrl: string | null) => void;
}

export function SignatureCanvasField({ onChange }: Props) {
  const padRef = useRef<SignaturePad>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  // 그리기 종료 시 dataURL 추출
  const handleEnd = () => {
    const pad = padRef.current;
    if (pad && !pad.isEmpty()) {
      setHasDrawn(true);
      // 캔버스 전체를 PNG dataURL 로 (서버에서 PNG 임베드)
      const dataUrl = pad.getCanvas().toDataURL("image/png");
      onChange?.(dataUrl);
    }
  };

  // 지우기
  const handleClear = () => {
    padRef.current?.clear();
    setHasDrawn(false);
    onChange?.(null);
  };

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-xl border-2 border-dashed border-brand-300 bg-white">
        <SignaturePad
          ref={padRef}
          onEnd={handleEnd}
          canvasProps={{
            className: "sig-canvas w-full",
            height: 200,
            // width 는 부모 폭에 맞춰 CSS 로 100% 처리
            style: { width: "100%", height: 200, touchAction: "none" },
          }}
          penColor="#0f172a"
          backgroundColor="rgba(255,255,255,1)"
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          위 영역에 마우스 또는 손가락으로 서명해주세요.
        </p>
        <Button variant="ghost" type="button" onClick={handleClear}>
          다시 쓰기
        </Button>
      </div>
      {!hasDrawn && (
        <p className="mt-1 text-xs text-amber-600">아직 서명하지 않았습니다.</p>
      )}
    </div>
  );
}
