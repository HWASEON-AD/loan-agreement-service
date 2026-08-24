// 공용 입력 컴포넌트 (라벨 + 에러)
import React from "react";

// ── 날짜 입력 기본 허용 범위 ─────────────────────────────────────────────
// 브라우저의 <input type="date"> 는 min/max 가 없으면 **연도 칸에 6자리까지** 받는다.
//   실측(크롬 2026-08-24): min/max 없이 "20241225" 를 치면 값이 `202412-02-05` 가 된다.
//   → 연도가 202412 로 들어가 버려서 만기 검증에 걸리고 다음 버튼이 안 켜진다.
//   min/max 를 주면 연도 칸이 4자리에서 끊긴다(같은 조건에서 `2024-12-25` 로 정상 입력됨).
// 개별 화면에서 더 좁은 범위가 필요하면 min/max 를 직접 넘겨 덮어쓰면 된다.
export const DATE_MIN = "1900-01-01";
export const DATE_MAX = "2999-12-31";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({
  label,
  hint,
  error,
  className = "",
  id,
  ...rest
}: InputProps) {
  // 라벨↔입력칸 연결용 id. 호출부가 id/name 을 안 주는 곳이 대부분이라
  //   htmlFor 가 빈 값이 되어 **라벨을 눌러도 커서가 안 갔다**(모바일에서 특히 불편).
  //   useId 로 항상 실제 id 를 만들어 연결한다.
  const autoId = React.useId();
  const inputId = id || rest.name || autoId;
  const isDate = rest.type === "date";
  return (
    // min-w-0: 그리드·플렉스 자식은 기본값이 min-width:auto 라 내용보다 작아지지 못한다.
    //   iOS 사파리의 date 입력은 고유 너비가 커서 이게 없으면 칸이 화면 밖으로 삐져나간다.
    <div className="w-full min-w-0">
      {label && (
        <label
          htmlFor={inputId}
          className={`mb-1.5 block text-sm font-medium ${
            rest.disabled ? "text-slate-400" : "text-slate-700"
          }`}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full min-w-0 max-w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400 ${
          error ? "border-red-400" : "border-slate-300"
        } ${className}`}
        // 날짜 기본 범위는 rest 보다 앞에 둔다 — 개별 화면이 넘긴 min/max 가 이기도록.
        {...(isDate ? { min: DATE_MIN, max: DATE_MAX } : null)}
        {...rest}
      />
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
