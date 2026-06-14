// FAQ 아코디언 — 박스 전체 클릭 / 한 번에 하나만 열림
"use client";

import React, { useState } from "react";
import { Reveal } from "./ui/Reveal";

type Faq = { q: string; a: string };

export function FaqAccordion({ items }: { items: Faq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mt-10 space-y-3">
      {items.map((f, i) => {
        const isOpen = openIndex === i;
        return (
          <Reveal key={i} variant="fade-up" delay={Math.min(i, 4) * 60}>
            <div
              className={`overflow-hidden rounded-xl border bg-white transition-colors ${
                isOpen ? "border-brand-300" : "border-slate-200 hover:border-brand-200"
              }`}
            >
              {/* 헤더 — 박스 전체가 클릭 영역 */}
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full p-5 text-left"
              >
                <span className="font-medium text-slate-800">Q. {f.q}</span>
              </button>

              {/* 답변 */}
              {isOpen && (
                <p className="px-5 pb-5 text-sm leading-relaxed text-slate-500">
                  {f.a}
                </p>
              )}
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
