// 단계 진행 표시 바 (Step X/6)
import React from "react";

const STEP_LABELS = [
  "금액·조건",
  "당사자 정보",
  "미리보기",
  "대여자 서명",
  "차용자 요청",
  "결제",
];

export function ProgressBar({ current }: { current: number }) {
  const total = STEP_LABELS.length;
  const pct = Math.round((current / total) * 100);

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-brand-700">
          Step {current} / {total}
        </span>
        <span className="text-slate-500">{STEP_LABELS[current - 1]}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
