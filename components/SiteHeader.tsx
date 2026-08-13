"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 group">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white font-bold text-lg leading-none select-none">
        /
      </span>
      <span className="text-lg font-bold text-slate-900 group-hover:text-brand-700 transition-colors">
        내지마요
      </span>
    </Link>
  );
}

const NAV_ITEMS = [
  { href: "/create/step/1", label: "약정서 작성" },
  { href: "/funding-plan", label: "자금조달계획서 AI 자동작성" },
  { href: "/renewal", label: "계약갱신 요구 통지서" },
  { href: "/#tax-consult", label: "세무상담" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // 현재 페이지인지 판정 — 앵커(#섹션 이동) 링크는 기본 선택 표시하지 않음
  const isActive = (href: string) => {
    if (href.includes("#")) return false;
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  };

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/sign") ||
    pathname.startsWith("/complete")
  ) {
    return null;
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />

        {/* 데스크탑 네비게이션 */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-500 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 모바일 햄버거 버튼 */}
        <button
          className="md:hidden flex items-center justify-center h-10 w-10 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="17" y2="6" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="14" x2="17" y2="14" />
            </svg>
          )}
        </button>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-2 shadow-lg">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-xl px-4 py-3 text-base font-semibold transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
