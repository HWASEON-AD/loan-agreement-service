"use client";

// 약정서 상세 모달 — 전체 내용 + 서명 이미지 + PDF/감사추적 다운로드
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type DashboardStatus } from "./StatusBadge";
import { formatNumber } from "@/lib/interest-calc";
import {
  FAMILY_RELATION_LABELS,
  type Agreement,
  type SignatureRecord,
} from "@/lib/types";

interface AgreementModalProps {
  agreementId: string;
  onClose: () => void;
}

interface AgreementDetail {
  agreement: Agreement;
  signatures: SignatureRecord[];
}

// 상환 방법 라벨
const REPAYMENT_LABELS: Record<string, string> = {
  lump_sum: "만기일시상환",
  installment: "분할상환",
};

// dashboardStatus 계산 (모달 헤더 배지용)
function calcDashboardStatus(a: Agreement): DashboardStatus {
  if (a.status === "cancelled") return "expired";
  if (a.lenderSigned && a.borrowerSigned) return "signed";
  return "pending";
}

// 일시 포맷 (ko-KR)
function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

// 당사자 정보 + 서명 블록
function PartyBlock({
  title,
  party,
  signature,
}: {
  title: string;
  party: Agreement["lender"];
  signature?: SignatureRecord;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div>
      <h3 className="mb-2 border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <span className="text-slate-400">성명: </span>
          <span className="font-medium text-slate-800">{party.name}</span>
        </div>
        <div>
          <span className="text-slate-400">생년월일: </span>
          {party.birth}
        </div>
        <div>
          <span className="text-slate-400">전화: </span>
          {party.phone}
        </div>
        <div>
          <span className="text-slate-400">이메일: </span>
          {party.email}
        </div>
        <div className="sm:col-span-2">
          <span className="text-slate-400">주소: </span>
          {party.address}
        </div>
      </dl>

      {/* 서명 영역 */}
      <div className="mt-3">
        <p className="mb-1 text-xs font-medium text-slate-400">서명</p>
        {signature?.signatureImageBase64 && !imgError ? (
          <img
            src={signature.signatureImageBase64}
            alt={`${party.name} 서명`}
            onError={() => setImgError(true)}
            className="max-w-[240px] rounded border border-slate-200 bg-white"
          />
        ) : imgError ? (
          <p className="text-sm text-slate-400">이미지를 불러올 수 없습니다.</p>
        ) : (
          <p className="text-sm text-slate-400">서명 이미지 없음</p>
        )}
        {signature && (
          <p className="mt-1 text-xs text-slate-500">
            서명일시: {formatDateTime(signature.signedAt)} (IP{" "}
            {signature.ipAddress})
          </p>
        )}
      </div>
    </div>
  );
}

export function AgreementModal({ agreementId, onClose }: AgreementModalProps) {
  const [detail, setDetail] = useState<AgreementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trackingInput, setTrackingInput] = useState("");
  const [markingState, setMarkingState] = useState<"idle" | "loading" | "done" | "error">("idle");

  // 상세 데이터 로드
  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/agreements/${agreementId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "상세 정보를 불러오지 못했습니다.");
        }
        if (!aborted) {
          setDetail({
            agreement: data.agreement,
            signatures: data.signatures ?? [],
          });
        }
      } catch (e) {
        if (!aborted && (e as Error).name !== "AbortError") {
          setError(
            e instanceof Error
              ? e.message
              : "상세 정보를 불러오지 못했습니다."
          );
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [agreementId]);

  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // body scroll 잠금
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // 배경 클릭 시 닫기 (모달 본문 클릭은 무시)
  const onBackdrop = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const agreement = detail?.agreement;
  const signatures = detail?.signatures ?? [];
  const lenderSig = signatures.find((s) => s.signerType === "lender");
  const borrowerSig = signatures.find((s) => s.signerType === "borrower");

  // 감사추적 PDF 다운로드 URL (lenderSignToken 사용)
  const auditCertUrl = agreement?.lenderSignToken
    ? `/api/agreements/${agreementId}/audit-cert?token=${agreement.lenderSignToken}`
    : null;

  return (
    <div
      onClick={onBackdrop}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">약정서 상세</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* 본문 */}
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
              <p className="mt-3 text-sm text-slate-400">불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="mb-4 text-sm text-red-600">{error}</p>
              <Button variant="outline" onClick={onClose}>
                닫기
              </Button>
            </div>
          ) : agreement ? (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <section>
                <h3 className="mb-2 border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700">
                  기본 정보
                </h3>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <span className="text-slate-400">생성일: </span>
                    {agreement.createdAt.slice(0, 10)}
                  </div>
                  <div className="truncate">
                    <span className="text-slate-400">약정서 ID: </span>
                    {agreement.id}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">상태: </span>
                    <StatusBadge status={calcDashboardStatus(agreement)} size="sm" />
                  </div>
                  <div>
                    <span className="text-slate-400">가족관계: </span>
                    {FAMILY_RELATION_LABELS[agreement.familyRelation] ??
                      agreement.familyRelation}
                  </div>
                </dl>
              </section>

              {/* 금융 조건 */}
              <section>
                <h3 className="mb-2 border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700">
                  금융 조건
                </h3>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <span className="text-slate-400">대여금액: </span>
                    <span className="font-medium text-slate-800">
                      {formatNumber(agreement.amount)}원
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">이자율: </span>
                    {agreement.interestRate > 0
                      ? `연 ${(agreement.interestRate * 100).toFixed(1)}%`
                      : "무이자"}
                  </div>
                  <div>
                    <span className="text-slate-400">대여기간: </span>
                    {agreement.startDate} ~ {agreement.endDate}
                  </div>
                  <div>
                    <span className="text-slate-400">상환방법: </span>
                    {REPAYMENT_LABELS[agreement.repaymentMethod] ??
                      agreement.repaymentMethod}
                    {agreement.interestDay
                      ? ` (매월 ${agreement.interestDay}일)`
                      : ""}
                  </div>
                </dl>
              </section>

              {/* 채권자 (갑) */}
              <PartyBlock
                title="채권자 (갑)"
                party={agreement.lender}
                signature={lenderSig}
              />

              {/* 채무자 (을) */}
              <PartyBlock
                title="채무자 (을)"
                party={agreement.borrower}
                signature={borrowerSig}
              />

              {/* 내용증명 발송완료 마킹 */}
              <section>
                <h3 className="mb-3 border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700">
                  내용증명 발송완료 처리
                </h3>
                {markingState === "done" ? (
                  <p className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
                    ✓ 발송완료 처리됐습니다. 고객에게 등기번호 이메일이 발송됐습니다.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={trackingInput}
                      onChange={(e) => setTrackingInput(e.target.value)}
                      placeholder="등기번호 입력 (예: 1234567890123)"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    />
                    <button
                      disabled={markingState === "loading"}
                      onClick={async () => {
                        if (!trackingInput.trim()) {
                          alert("등기번호를 입력해주세요.");
                          return;
                        }
                        setMarkingState("loading");
                        try {
                          // orderId는 agreementId 기반으로 관리자 API에서 찾음
                          const res = await fetch(`/api/admin/agreements/${agreementId}/mark-sent`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ trackingNumber: trackingInput.trim() }),
                          });
                          if (!res.ok) throw new Error("처리 실패");
                          setMarkingState("done");
                        } catch {
                          setMarkingState("error");
                        }
                      }}
                      className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                    >
                      {markingState === "loading" ? "처리 중..." : "발송완료 처리"}
                    </button>
                  </div>
                )}
                {markingState === "error" && (
                  <p className="mt-2 text-xs text-red-500">처리 중 오류가 발생했습니다. 다시 시도해주세요.</p>
                )}
              </section>

              {/* 문서 다운로드 */}
              <section>
                <h3 className="mb-2 border-b border-slate-200 pb-1 text-sm font-semibold text-slate-700">
                  문서 다운로드
                </h3>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/agreements/${agreementId}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                  >
                    약정서 PDF 다운로드
                  </a>
                  {auditCertUrl ? (
                    <button
                      onClick={async () => {
                        const res = await fetch(auditCertUrl, { method: "HEAD" });
                        if (!res.ok) {
                          alert("인증서 다운로드에 실패했습니다.");
                          return;
                        }
                        window.open(auditCertUrl, "_blank", "noreferrer");
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                    >
                      감사추적 인증서 PDF 다운로드
                    </button>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-400">
                      감사추적 인증서 (없음)
                    </span>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
