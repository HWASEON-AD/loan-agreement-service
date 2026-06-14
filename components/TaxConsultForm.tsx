"use client";

// 이메일 세무상담 신청 폼 — TaxConsultSection 카드 아래에 전체 폭으로 펼쳐짐
import React, { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9\-]{9,20}$/;

// isOpen은 상위(TaxConsultSection)에서 제어
export function TaxConsultForm({ isOpen }: { isOpen: boolean }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    content: "",
    agreed: false,
  });
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  // 입력 변경
  const update = (
    key: keyof typeof form,
    value: string | boolean
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 클라이언트 측 1차 검증
  const validate = (): string | null => {
    if (form.name.trim().length < 2) return "이름을 2자 이상 입력해주세요.";
    if (!PHONE_RE.test(form.phone.trim()))
      return "연락처 형식이 올바르지 않습니다.";
    if (!EMAIL_RE.test(form.email.trim()))
      return "이메일 형식이 올바르지 않습니다.";
    if (form.content.trim().length < 10)
      return "상담 내용을 10자 이상 입력해주세요.";
    if (!form.agreed) return "개인정보 수집 및 이용에 동의해주세요.";
    return null;
  };

  // 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/tax-consult/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          content: form.content.trim(),
        }),
      });
      const data: { success?: boolean; error?: string } = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "신청 처리에 실패했습니다.");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "신청 처리 중 오류가 발생했습니다."
      );
    }
  };

  // 닫혀있고 아직 제출 전이면 아무것도 렌더하지 않음
  if (!isOpen && status !== "success") return null;

  // 신청 완료 화면
  if (status === "success") {
    return (
      <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-base font-semibold text-green-800">
          신청이 완료되었습니다.
        </p>
        <p className="mt-1 text-sm text-green-700">
          영업일 1~2일 내 연락드립니다.
        </p>
      </div>
    );
  }

  // 이메일 상담 폼 — 카드 아래 전체 폭
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
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="hong@example.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              상담 내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="가족 간 3천만원 대여 후 증여세 이슈가 걱정됩니다..."
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {form.content.length}/1000자
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.agreed}
              onChange={(e) => update("agreed", e.target.checked)}
              className="mt-0.5"
            />
            <span>
              개인정보 수집 및 이용에 동의합니다. (상담 목적으로만 사용되며 처리
              후 파기됩니다)
            </span>
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            {status === "submitting" ? "신청 중..." : "신청하기"}
          </button>

          <p className="text-center text-xs text-slate-400">
            ※ 초기 상담 무료 · 영업일 1~2일 내 연락드립니다
          </p>
    </form>
  );
}
