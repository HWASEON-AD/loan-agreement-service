// 법적 안내 문구 강조 박스
import React from "react";

type Tone = "info" | "warn";

export function LegalNotice({
  children,
  tone = "info",
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  title?: string;
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-brand-200 bg-brand-50 text-brand-900";
  return (
    <div className={`rounded-xl border p-4 text-sm leading-relaxed ${toneClass}`}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}
