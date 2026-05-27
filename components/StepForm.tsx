// 작성 마법사 공통 레이아웃 래퍼 (진행바 + 제목 + 본문 + 하단 버튼 영역)
import React from "react";
import { ProgressBar } from "./ui/ProgressBar";

export function StepForm({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <ProgressBar current={step} />
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {description && (
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      )}
      <div className="mt-7">{children}</div>
    </div>
  );
}
