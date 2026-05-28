"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 내지마요 로고 (SVG 인라인)
function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 group">
      {/* 슬래시 아이콘 */}
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-white font-bold text-sm select-none">
        ₩
      </span>
      <span className="text-lg font-bold text-slate-900 group-hover:text-brand-700 transition-colors">
        내지마요
      </span>
    </Link>
  );
}

const NAV_ITEMS = [
  { href: "/create/step/1", label: "약정서 작성" },
  { href: "/funding-plan", label: "자금조달계획서 AI" },
];

export function SiteHeader() {
  const pathname = usePathname();

  // 관리자/서명/완료 페이지에서는 헤더 숨김
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/sign") ||
    pathname.startsWith("/complete")
  ) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Logo />
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
