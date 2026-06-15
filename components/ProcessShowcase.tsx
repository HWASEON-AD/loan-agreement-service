// 단계 설명 인터랙티브 섹션 — 우측 단계 선택 → 좌측 미디어 전환 (chamjimayo 스타일)
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Reveal } from "./ui/Reveal";

const AUTOPLAY_MS = 4500;

type Media = {
  type: "image" | "video";
  src: string;
  poster?: string; // video일 때 썸네일(선택)
};

type Step = {
  n: number;
  title: string;
  short: string; // 좌측 프레임 상단/캡션에 쓰는 짧은 설명
  desc: string; // 우측 리스트 설명
  // 실제 에셋이 준비되면 아래 media만 채우면 자동으로 표시됩니다.
  // 예) media: { type: "image", src: "/process/step1.png" }
  //     media: { type: "video", src: "/process/step1.mp4", poster: "/process/step1.jpg" }
  media?: Media;
};

const STEPS: Step[] = [
  {
    n: 1,
    title: "금액·조건 입력",
    short: "대여 금액과 기간만 입력하면 끝",
    desc: "대여 금액과 기간을 입력하면 적정 이자율이 자동 계산됩니다.",
    media: { type: "image", src: "/process/step1.png" },
  },
  {
    n: 2,
    title: "당사자 정보 입력",
    short: "대여자·차용자 정보를 간단히 적어요",
    desc: "대여자·차용자 정보를 입력합니다. (주민번호 수집 없음)",
    media: { type: "image", src: "/process/step2.png" },
  },
  {
    n: 3,
    title: "전자서명",
    short: "이메일 인증 후 양쪽이 전자서명",
    desc: "이메일 인증 후 양 당사자가 전자서명을 진행합니다.",
    media: { type: "image", src: "/process/step4_sign.png" },
  },
  {
    n: 4,
    title: "우체국 내용증명",
    short: "우체국 안 가도 바로 발송 접수",
    desc: "서명된 약정서를 우체국 내용증명으로 발송 접수합니다.",
    media: { type: "image", src: "/process/step6_payment.png" },
  },
  {
    n: 5,
    title: "법적 효력 완성",
    short: "전자서명 + 내용증명으로 증거 완성",
    desc: "전자서명 + 내용증명으로 객관적 증거가 완성됩니다.",
    media: { type: "image", src: "/process/step3_preview.png" },
  },
];

export function ProcessShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedRef = useRef(false);

  // 모션 최소화 사용자: 자동 재생 끔
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    if (mq.matches) setPaused(true);
  }, []);

  // 자동 전환 (hover/포커스 시 일시정지)
  useEffect(() => {
    if (paused || reducedRef.current) return;
    const id = setTimeout(() => {
      setActive((prev) => (prev + 1) % STEPS.length);
    }, AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [active, paused]);

  const current = STEPS[active];

  return (
    <section id="process" className="bg-white py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal as="div" variant="fade-up" className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            전자서명 → 우체국 내용증명 → <span className="text-brand-600">법적효력 완성</span>
          </h2>
          <p className="mt-3 text-slate-500">
            작성부터 발송 · 보관까지, 단 5단계로 끝나요
          </p>
        </Reveal>

        <div
          className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => !reducedRef.current && setPaused(false)}
        >
          {/* 좌측: 미디어 프레임 */}
          <Reveal variant="fade-up" className="lg:col-span-7 lg:h-full">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg lg:flex lg:h-full lg:flex-col">
              {/* 브라우저 상단바 */}
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-3 min-w-0 truncate text-sm font-medium text-slate-500">
                  {current.title}
                </span>
              </div>

              {/* 미디어 본문 (모바일 16:9 고정 · 데스크톱은 카드 높이를 채워 좌우 정렬) */}
              <div className="relative aspect-[16/9] w-full bg-slate-50 lg:aspect-auto lg:flex-1">
                {STEPS.map((s, i) => (
                  <div
                    key={s.n}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      i === active ? "opacity-100" : "pointer-events-none opacity-0"
                    }`}
                  >
                    <StepMedia step={s} />
                  </div>
                ))}
              </div>

              {/* 하단 캡션 + 진행 세그먼트 */}
              <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3">
                <p className="min-w-0 truncate text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">Step {current.n}</span>
                  {" · "}
                  {current.short}
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  {STEPS.map((s, i) => (
                    <button
                      key={s.n}
                      aria-label={`${s.n}단계 보기`}
                      onClick={() => setActive(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === active ? "w-6 bg-brand-600" : "w-2.5 bg-slate-200 hover:bg-slate-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* 우측: 단계 선택 리스트 */}
          <Reveal variant="fade-up" delay={120} className="lg:col-span-5">
            <ul className="flex h-full flex-col gap-3">
              {STEPS.map((s, i) => {
                const isActive = i === active;
                return (
                  <li key={s.n} className="flex-1">
                    <button
                      onClick={() => setActive(i)}
                      className={`group relative flex w-full items-start gap-4 overflow-hidden rounded-2xl border p-5 text-left transition-all ${
                        isActive
                          ? "border-brand-300 bg-brand-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50"
                      }`}
                    >
                      {/* 자동 재생 진행 바 */}
                      {isActive && !paused && !reducedRef.current && (
                        <span
                          key={active}
                          className="absolute bottom-0 left-0 h-0.5 bg-brand-500"
                          style={{ animation: `process-fill ${AUTOPLAY_MS}ms linear forwards` }}
                        />
                      )}

                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                          isActive
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                        }`}
                      >
                        {s.n}
                      </span>

                      <span className="min-w-0">
                        <span
                          className={`block font-semibold ${
                            isActive ? "text-brand-800" : "text-slate-900"
                          }`}
                        >
                          {s.title}
                        </span>
                        <span
                          className={`mt-1 block text-sm ${
                            isActive ? "text-brand-700/80" : "text-slate-500"
                          }`}
                        >
                          {s.desc}
                        </span>
                      </span>

                      {/* 우측 라디오 표시 */}
                      <span
                        className={`ml-auto mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          isActive ? "border-brand-500" : "border-slate-300"
                        }`}
                      >
                        {isActive && <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// 단계별 미디어 — media가 있으면 이미지/영상, 없으면 플레이스홀더
function StepMedia({ step }: { step: Step }) {
  if (step.media?.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={step.media.src}
        alt={`${step.title} 화면`}
        className="h-full w-full object-cover object-top"
      />
    );
  }
  if (step.media?.type === "video") {
    return (
      <video
        src={step.media.src}
        poster={step.media.poster}
        className="h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }
  // 플레이스홀더 (에셋 준비 전)
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-md">
        {step.n}
      </div>
      <p className="mt-4 text-lg font-semibold text-slate-700">{step.title}</p>
      <p className="mt-1 max-w-xs text-sm text-slate-500">{step.short}</p>
      <span className="mt-4 rounded-full bg-white/70 px-3 py-1 text-xs text-slate-400">
        이미지 · 영상 준비 중
      </span>
    </div>
  );
}
