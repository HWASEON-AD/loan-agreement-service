// 스크롤 진입 시 등장 애니메이션 (chamjimayo의 AOS zoom-y-out 스타일 재현, 외부 라이브러리 없음)
"use client";

import React, { useEffect, useRef, useState } from "react";

type RevealVariant =
  | "zoom-y-out"
  | "fade-up"
  | "fade-down"
  | "fade-left"
  | "fade-right"
  | "zoom-in";

type RevealProps = {
  children: React.ReactNode;
  /** 등장 방식 (기본 zoom-y-out — 참고 사이트와 동일) */
  variant?: RevealVariant;
  /** 시작 지연(ms) — 카드 순차 등장용 stagger */
  delay?: number;
  /** 지속 시간(ms) */
  duration?: number;
  /** 한 번만 재생할지 여부 (기본 true) */
  once?: boolean;
  className?: string;
  /** 렌더링 태그 (기본 div) */
  as?: keyof JSX.IntrinsicElements;
  /** 추가 인라인 스타일 (reveal 변수와 병합됨) */
  style?: React.CSSProperties;
};

export function Reveal({
  children,
  variant = "zoom-y-out",
  delay = 0,
  duration = 600,
  once = true,
  className = "",
  as: Tag = "div",
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // IntersectionObserver 미지원 환경에서는 즉시 노출
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setShown(false);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  const Component = Tag as React.ElementType;

  return (
    <Component
      ref={ref}
      data-reveal={variant}
      className={`${shown ? "reveal-show" : ""} ${className}`.trim()}
      style={{
        ...style,
        // CSS 변수로 딜레이/지속시간 전달
        ["--reveal-delay" as string]: `${delay}ms`,
        ["--reveal-duration" as string]: `${duration}ms`,
      }}
    >
      {children}
    </Component>
  );
}
