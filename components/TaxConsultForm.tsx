"use client";

// 세무상담 신청 폼 — 이름, 연락처, 상담내용 (이메일 선택사항)
import React, { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

const PHONE_RE = /^[0-9\-]{9,20}$/;

export function TaxConsultForm() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    content: "",
  });
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const update = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): string | null => {
    if (form.name.trim().length < 2) return "이름을 2자 이상 입력해주세요.";
    if (!PHONE_RE.test(form.phone.trim())) return "연락처 형식이 올바르지 않습니다.";
    if (form.content.trim().length < 10) return "상담 내용을 10자 이상 입력해주세요.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/tax-consult/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          content: form.content.trim(),
        }),
      });
      const data: { success?: boolean; error?: string } = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "신청 처리에 실패했습니다.");
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "신청 처리 중 오류가 발생했습니다.");
    }
  };

  if (status === "success") {
    return (
      <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-base font-semibold text-green-800">신청이 완료되었습니다.</p>
        <p className="mt-1 text-sm text-green-700">영업일 1~2일 내 연락드립니다.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="홍길동"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          연락처 <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder="010-1234-5678"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          상담 요청사항 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.content}
          onChange={(e) => update("content", e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="가족 간 3천만원 대여 후 증여세 이슈가 걱정됩니다..."
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <p className="mt-1 text-right text-xs text-slate-400">{form.content.length}/1000자</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
      >
        {status === "submitting" ? "신청 중..." : "상담 신청하기"}
      </button>

      <p className="text-center text-xs text-slate-400">
        ※ 초기 상담 무료 · 영업일 1~2일 내 연락드립니다
      </p>
    </form>
  );
}
