// 공용 버튼 컴포넌트
import React from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "white";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary:
    "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-slate-300 disabled:text-slate-500",
  secondary:
    "bg-brand-100 text-brand-800 hover:bg-brand-200 disabled:opacity-50",
  outline:
    "border border-brand-300 text-brand-700 bg-white hover:bg-brand-50 disabled:opacity-50",
  ghost: "text-brand-700 hover:bg-brand-50 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  white: "bg-white text-brand-800 hover:bg-brand-50 disabled:opacity-50",
};

// 일관된 스타일의 버튼
export function Button({
  variant = "primary",
  fullWidth,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
        variantClass[variant]
      } ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
