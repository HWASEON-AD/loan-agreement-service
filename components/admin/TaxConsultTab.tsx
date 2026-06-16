"use client";

// 세무상담 신청 관리 탭
// - 목록 테이블 (신청일, 이름, 연락처/이메일 마스킹, 상태, 내용 보기)
// - 상태 뱃지 (pending/contacted/closed)
// - CSV 다운로드
// - 체크박스 선택 후 세무사 이메일 발송 (/api/admin/tax-consult)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { TaxConsultation, TaxConsultStatus } from "@/lib/types";

// 상태 뱃지 매핑
const STATUS_MAP: Record<
  TaxConsultStatus,
  { label: string; color: string }
> = {
  pending: { label: "대기", color: "bg-yellow-100 text-yellow-700" },
  contacted: { label: "연락완료", color: "bg-green-100 text-green-700" },
  closed: { label: "종료", color: "bg-slate-100 text-slate-500" },
};

// 연락처 마스킹 (010-1234-5678 -> 010-****-5678)
function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
  }
  return phone.replace(/\d(?=\d{4})/g, "*");
}

// 이메일 마스킹 (hong@example.com -> ho**@example.com)
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ""}*@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

// 신청일 표기 (YYYY-MM-DD)
function formatDate(iso: string): string {
  try {
    const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  } catch {
    return iso.slice(0, 10);
  }
}

// CSV 셀 이스케이프
function csvCell(value: string): string {
  const v = (value ?? "").toString();
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function TaxConsultTab() {
  const router = useRouter();
  const [items, setItems] = useState<TaxConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<TaxConsultation | null>(null);

  // 목록 로드
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tax-consult", { cache: "no-store" });
      if (res.status === 401) {
        setError("세션이 만료되었습니다. 다시 로그인해주세요.");
        setTimeout(() => router.push("/admin"), 1500);
        return;
      }
      const data: { consultations?: TaxConsultation[]; error?: string } =
        await res.json();
      if (!res.ok) throw new Error(data.error || "조회 실패");
      setItems(data.consultations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  // 통계
  const stats = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      contacted: items.filter((i) => i.status === "contacted").length,
    };
  }, [items]);

  const allChecked = items.length > 0 && checked.size === items.length;

  // 체크 토글
  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 전체 선택 토글
  const toggleAll = () => {
    setChecked((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))
    );
  };

  // CSV 다운로드
  const downloadCsv = () => {
    const header = ["신청일", "이름", "연락처", "이메일", "상담내용", "상태"];
    const lines: string[] = [header.map(csvCell).join(",")];
    for (const i of items) {
      lines.push(
        [
          formatDate(i.createdAt),
          i.name,
          i.phone,
          i.email ?? "",
          i.content,
          STATUS_MAP[i.status].label,
        ]
          .map(csvCell)
          .join(",")
      );
    }
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const ymd = new Date(Date.now() + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-consult-${ymd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 세무사 이메일 발송
  const sendEmail = async () => {
    if (checked.size === 0) {
      setMessage("발송할 항목을 선택해주세요.");
      return;
    }
    setSending(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/tax-consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(checked) }),
      });
      const data: { success?: boolean; sent?: number; error?: string } =
        await res.json();
      if (!res.ok) throw new Error(data.error || "발송 실패");
      setMessage(`${data.sent ?? checked.size}건을 세무사 이메일로 발송했습니다.`);
      setChecked(new Set());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "이메일 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {/* 요약 + 액션 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          전체 <span className="font-semibold text-slate-900">{stats.total}</span>건
          {" · "}대기 <span className="font-semibold text-yellow-700">{stats.pending}</span>건
          {" · "}연락완료 <span className="font-semibold text-green-700">{stats.contacted}</span>건
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={downloadCsv}
            disabled={items.length === 0}
            className="px-4 py-2"
          >
            CSV 다운로드
          </Button>
          <Button
            onClick={sendEmail}
            disabled={sending || checked.size === 0}
            className="px-4 py-2"
          >
            {sending ? "발송 중..." : `세무사 이메일 발송 (${checked.size})`}
          </Button>
        </div>
      </div>

      {message && (
        <p className="mb-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
          {message}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* 데스크톱 테이블 */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                />
              </th>
              <th className="px-4 py-3">신청일</th>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">연락처</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-center">내용</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  불러오는 중...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  세무상담 신청이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((i) => (
                <tr
                  key={i.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checked.has(i.id)}
                      onChange={() => toggle(i.id)}
                      aria-label={`${i.name} 선택`}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(i.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {i.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums">
                    {maskPhone(i.phone)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {i.email ? maskEmail(i.email) : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_MAP[i.status].color}`}
                    >
                      {STATUS_MAP[i.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setDetail(i)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      보기
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-400">
            불러오는 중...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-400">
            세무상담 신청이 없습니다.
          </div>
        ) : (
          items.map((i) => (
            <div
              key={i.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={checked.has(i.id)}
                    onChange={() => toggle(i.id)}
                  />
                  {formatDate(i.createdAt)}
                </label>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_MAP[i.status].color}`}
                >
                  {STATUS_MAP[i.status].label}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-800">{i.name}</p>
              <p className="mt-1 text-sm text-slate-600">{maskPhone(i.phone)}</p>
              {i.email && <p className="text-sm text-slate-600">{maskEmail(i.email)}</p>}
              <button
                onClick={() => setDetail(i)}
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                내용 보기
              </button>
            </div>
          ))
        )}
      </div>

      {/* 상세 모달 */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">상담 신청 상세</h3>
              <button
                onClick={() => setDetail(null)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-slate-500">신청일</dt>
                <dd className="text-slate-800">{formatDate(detail.createdAt)}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-slate-500">이름</dt>
                <dd className="font-medium text-slate-800">{detail.name}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-slate-500">연락처</dt>
                <dd className="text-slate-800">{detail.phone}</dd>
              </div>
              {detail.email && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-slate-500">이메일</dt>
                  <dd className="text-slate-800">{detail.email}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4">
              <p className="mb-1 text-sm text-slate-500">상담 내용</p>
              <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                {detail.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
