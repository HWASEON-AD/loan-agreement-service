"use client";

// 세무사 대시보드 — 탭 3개: 약정서 목록 / 이체 증빙 / 세무상담 신청
// - 이름은 마스킹(서버에서 처리), 연락처/이메일은 세무상담 탭에서 전체 표시
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/interest-calc";

type Tab = "agreements" | "evidences" | "consults";

interface AgreementRow {
  id: string;
  createdAt: string;
  startDate: string;
  endDate: string;
  lenderName: string;
  borrowerName: string;
  amount: number;
  interestRate: number;
  monthlyInterest: number;
  repaymentMethod: string;
  status: string;
  lenderSigned: boolean;
  borrowerSigned: boolean;
  transferConfirmed: boolean;
  transferDate: string | null;
}

interface EvidenceItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  uploadedBy: string;
  createdAt: string;
}

interface EvidenceGroup {
  agreementId: string;
  lenderName: string;
  borrowerName: string;
  amount: number;
  evidences: EvidenceItem[];
}

interface ConsultRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  content: string;
  status: string;
  createdAt: string;
}

interface AdvisorData {
  agreements: AgreementRow[];
  evidenceGroups: EvidenceGroup[];
  consultations: ConsultRow[];
}

const TABS: { key: Tab; label: string }[] = [
  { key: "agreements", label: "약정서 목록" },
  { key: "evidences", label: "이체 증빙" },
  { key: "consults", label: "세무상담 신청" },
];

// 날짜 (KST YYYY-MM-DD)
function fmtDate(iso: string): string {
  try {
    const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  } catch {
    return iso.slice(0, 10);
  }
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function ratePct(rate: number): string {
  return rate > 0 ? `연 ${(rate * 100).toFixed(1)}%` : "무이자";
}

export function AdvisorDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("agreements");
  const [data, setData] = useState<AdvisorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/advisor/data", { cache: "no-store" });
      if (res.status === 401) {
        setError("세션이 만료되었습니다. 다시 로그인해주세요.");
        setTimeout(() => router.push("/advisor"), 1500);
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "조회 실패");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {/* 탭 */}
      <div className="mb-6 flex border-b border-slate-200">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px flex-1 border-b-2 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-brand-700 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-400">
          불러오는 중...
        </div>
      ) : tab === "agreements" ? (
        <AgreementsTab rows={data?.agreements ?? []} />
      ) : tab === "evidences" ? (
        <EvidencesTab groups={data?.evidenceGroups ?? []} />
      ) : (
        <ConsultsTab rows={data?.consultations ?? []} />
      )}
    </div>
  );
}

// ── 약정서 목록 탭 ──
function AgreementsTab({ rows }: { rows: AgreementRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-400">
        약정서가 없습니다.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">계약일</th>
            <th className="px-4 py-3">대여자</th>
            <th className="px-4 py-3">차용자</th>
            <th className="px-4 py-3 text-right">금액</th>
            <th className="px-4 py-3">기간</th>
            <th className="px-4 py-3">이자율</th>
            <th className="px-4 py-3 text-center">이체확인</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
            >
              <td className="px-4 py-3 text-slate-500">{fmtDate(r.createdAt)}</td>
              <td className="px-4 py-3 font-medium text-slate-800">
                {r.lenderName}
              </td>
              <td className="px-4 py-3 font-medium text-slate-800">
                {r.borrowerName}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                {formatNumber(r.amount)}원
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {r.startDate} ~ {r.endDate}
              </td>
              <td className="px-4 py-3 text-slate-600">{ratePct(r.interestRate)}</td>
              <td className="px-4 py-3 text-center">
                {r.transferConfirmed ? (
                  <span className="inline-block rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                    확인 {r.transferDate ? `(${r.transferDate})` : ""}
                  </span>
                ) : (
                  <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                    미확인
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 이체 증빙 탭 ──
function EvidencesTab({ groups }: { groups: EvidenceGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-400">
        업로드된 이체 증빙이 없습니다.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div
          key={g.agreementId}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">
              {g.lenderName} → {g.borrowerName}
            </p>
            <p className="text-sm text-slate-500">
              {formatNumber(g.amount)}원
            </p>
          </div>
          <ul className="space-y-2">
            {g.evidences.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span className="truncate text-sm text-slate-700">
                  📎 {e.fileName}
                  <span className="ml-2 text-xs text-slate-400">
                    {fmtSize(e.fileSize)} ·{" "}
                    {e.uploadedBy === "borrower" ? "차용자" : "대여자"} ·{" "}
                    {fmtDate(e.createdAt)}
                  </span>
                </span>
                <a
                  href={e.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg border border-brand-300 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                >
                  다운로드
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ── 세무상담 신청 탭 (연락처/이메일 전체 표시) ──
const CONSULT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "대기", color: "bg-yellow-100 text-yellow-700" },
  contacted: { label: "연락완료", color: "bg-green-100 text-green-700" },
  closed: { label: "종료", color: "bg-slate-100 text-slate-500" },
};

function ConsultsTab({ rows }: { rows: ConsultRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-slate-400">
        세무상담 신청이 없습니다.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((c) => {
        const st = CONSULT_STATUS[c.status] ?? CONSULT_STATUS.pending;
        return (
          <div
            key={c.id}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">
                {c.name}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {fmtDate(c.createdAt)}
                </span>
              </p>
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${st.color}`}
              >
                {st.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              <span>연락처: {c.phone}</span>
              <span>이메일: {c.email}</span>
            </div>
            <div className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {c.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
