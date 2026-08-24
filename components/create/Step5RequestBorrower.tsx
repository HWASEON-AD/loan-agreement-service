"use client";

// Step 5: 차용자(을)에게 서명 요청 + 서명 완료 대기 (폴링)
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StepForm } from "@/components/StepForm";
import { Button } from "@/components/ui/Button";
import { LegalNotice } from "@/components/ui/LegalNotice";
import { loadAgreementId, loadLenderToken } from "@/lib/form-store";

export function Step5RequestBorrower() {
  const router = useRouter();
  const [agreementId, setAgreementId] = useState<string | null>(null);
  const [borrowerName, setBorrowerName] = useState("");
  const [signLink, setSignLink] = useState("");
  const [requested, setRequested] = useState(false);
  const [borrowerSigned, setBorrowerSigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = loadAgreementId();
    if (!id) {
      router.replace("/create/step/1");
      return;
    }
    setAgreementId(id);
  }, [router]);

  // 서명 요청 발송
  const handleRequest = useCallback(async () => {
    if (!agreementId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/agreements/${agreementId}/request-borrower`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: loadLenderToken() }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청 발송 실패");
      setRequested(true);
      setSignLink(data.signLink);

      // 차용자 이름 조회
      const aRes = await fetch(`/api/agreements/${agreementId}`, {
        cache: "no-store",
      });
      const aData = await aRes.json();
      if (aRes.ok) setBorrowerName(aData.agreement.borrower.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "서명 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [agreementId]);

  // 차용자 서명 완료 폴링
  useEffect(() => {
    if (!requested || !agreementId || borrowerSigned) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/agreements/${agreementId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (res.ok && data.agreement.borrowerSigned) {
          setBorrowerSigned(true);
          clearInterval(timer);
        }
      } catch {
        // 폴링 실패는 무시하고 계속 시도
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [requested, agreementId, borrowerSigned]);

  // 링크 복사
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${signLink.replace(window.location.origin, "")}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 실패 시 무시
    }
  };

  if (!agreementId) return null;

  return (
    <StepForm
      step={5}
      title="차용자(을) 서명 요청"
      description="차용자에게 서명 요청 링크를 발송합니다."
    >
      <div className="space-y-5">
        {!requested ? (
          <>
            <LegalNotice tone="info">
              차용자 이메일로 서명 요청 링크가 발송됩니다. 링크는 7일간
              유효합니다.
            </LegalNotice>
            <Button onClick={handleRequest} disabled={loading} fullWidth>
              {loading ? "발송 중..." : "차용자에게 서명 요청 보내기"}
            </Button>
          </>
        ) : (
          <>
            <LegalNotice tone="info" title="서명 요청 발송 완료">
              {borrowerName ? `${borrowerName}님께 ` : ""}서명 요청을
              보냈습니다. 차용자가 서명을 완료하면 자동으로 다음 단계로
              진행됩니다.
            </LegalNotice>

            {/* 데모용: 서명 링크 직접 노출 */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-medium text-slate-500">
                서명 링크 (데모: 직접 열어 차용자 서명 진행 가능)
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={signLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-sm text-brand-700 underline"
                >
                  {signLink}
                </a>
                <Button variant="outline" onClick={copyLink}>
                  {copied ? "복사됨" : "복사"}
                </Button>
              </div>
            </div>

            {/* 대기/완료 상태 */}
            {borrowerSigned ? (
              <LegalNotice tone="info">
                <span className="font-semibold text-green-700">
                  차용자 서명 완료 ✓
                </span>{" "}
                결제 단계로 진행할 수 있습니다.
              </LegalNotice>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                차용자 서명을 기다리는 중...
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleRequest}>
                링크 다시 보내기
              </Button>
              <Button
                onClick={() => router.push("/create/step/6")}
                disabled={!borrowerSigned}
                fullWidth
              >
                결제 단계로
              </Button>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </StepForm>
  );
}
