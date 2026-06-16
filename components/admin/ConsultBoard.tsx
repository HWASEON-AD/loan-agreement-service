"use client";

// 세무상담 신청 게시판 — 비밀글 스타일 (클릭하면 상담내용 열림)
import React, { useCallback, useEffect, useState } from "react";
import type { TaxConsultation } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  contacted: "처리완료",
  closed: "종료",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  contacted: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-500",
};

function formatDate(iso: string): string {
  try {
    const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return iso.slice(0, 16);
  }
}

export function ConsultBoard() {
  const [items, setItems] = useState<TaxConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tax-consult", { cache: "no-store" });
      if (res.status === 401) { setError("세션이 만료되었습니다. 새로고침 후 다시 로그인해주세요."); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "조회 실패");
      setItems(data.consultations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "서버 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  };

  const markContacted = async (id: string) => {
    setUpdating(id);
    try {
      await fetch(`/api/admin/tax-consult/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "contacted" }),
      });
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "contacted" as const } : i));
    } catch {
      // silent
    } finally {
      setUpdating(null);
    }
  };

  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">세무상담 신청 게시판</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              전체 <strong>{items.length}</strong>건 · 대기 <strong className="text-yellow-700">{pending}</strong>건
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            로그아웃
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}

        {/* 게시판 */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* 컬럼 헤더 */}
          <div className="grid grid-cols-[40px_1fr_120px_80px] border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase text-slate-500">
            <span>No</span>
            <span>신청자</span>
            <span>신청일시</span>
            <span className="text-center">상태</span>
          </div>

          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">접수된 상담 신청이 없습니다.</div>
          ) : (
            items.map((item, idx) => (
              <div key={item.id} className="border-b border-slate-100 last:border-0">
                {/* 행 — 클릭하면 내용 열림 (비밀글 스타일) */}
                <button
                  onClick={() => setOpenId(openId === item.id ? null : item.id)}
                  className="grid w-full grid-cols-[40px_1fr_120px_80px] items-center px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="text-sm text-slate-400">{items.length - idx}</span>
                  <div>
                    <span className="text-sm font-medium text-slate-800">{item.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{item.phone}</span>
                    {item.status === "pending" && (
                      <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-yellow-400 align-middle" />
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(item.createdAt)}</span>
                  <span className="text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[item.status] ?? ""}`}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </span>
                </button>

                {/* 펼침 — 상담 내용 (비밀글 열기) */}
                {openId === item.id && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="text-xs text-slate-500">이름: <strong>{item.name}</strong></span>
                      <span className="text-xs text-slate-500">연락처: <strong>{item.phone}</strong></span>
                      {item.email && <span className="text-xs text-slate-500">이메일: {item.email}</span>}
                    </div>
                    <div className="mb-4 whitespace-pre-wrap rounded-xl bg-white border border-slate-200 p-4 text-sm text-slate-700 leading-relaxed">
                      {item.content}
                    </div>
                    {item.status === "pending" && (
                      <button
                        onClick={() => markContacted(item.id)}
                        disabled={updating === item.id}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {updating === item.id ? "처리 중..." : "✓ 처리완료로 변경"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">내지마요 관리자 · 세무상담 전용</p>
      </div>
    </main>
  );
}
