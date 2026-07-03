"use client";

// 차용자 서명 페이지 — 토큰 검증 → 약정서 확인 → OTP → 서명
import React, { useEffect, useState } from "react";
import { StepForm } from "@/components/StepForm";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/OtpInput";
import { SignatureStampField } from "@/components/SignatureStampField";
import { AgreementPreview } from "@/components/AgreementPreview";
import { LegalNotice } from "@/components/ui/LegalNotice";
import { Footer } from "@/components/Footer";
import type { Agreement } from "@/lib/types";

type State = "loading" | "invalid" | "expired" | "signed" | "ready" | "done";

export function BorrowerSign({ token }: { token: string }) {
  const [state, setState] = useState<State>("loading");
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 토큰으로 약정서 조회
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/agreements/by-token/${token}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          setState("invalid");
          return;
        }
        setAgreement(data.agreement);
        if (data.expired) setState("expired");
        else if (data.alreadySigned) setState("signed");
        else setState("ready");
      } catch {
        setState("invalid");
      }
    })();
  }, [token]);

  // 서명 완료
  const handleSign = async () => {
    if (!agreement || !signature) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/agreements/${agreement.id}/sign-borrower`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, signatureImageBase64: signature }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "서명 처리 실패");
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "서명 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 상태별 안내 화면
  if (state === "loading") {
    return (
      <Centered>
        <p className="text-slate-500">서명 정보를 불러오는 중...</p>
      </Centered>
    );
  }
  if (state === "invalid") {
    return (
      <Centered>
        <LegalNotice tone="warn" title="유효하지 않은 링크">
          서명 링크가 올바르지 않습니다. 발신자에게 다시 요청해주세요.
        </LegalNotice>
      </Centered>
    );
  }
  if (state === "expired") {
    return (
      <Centered>
        <LegalNotice tone="warn" title="만료된 링크">
          서명 링크가 만료되었습니다(7일 경과). 발신자에게 재발송을
          요청해주세요.
        </LegalNotice>
      </Centered>
    );
  }
  if (state === "signed" || state === "done") {
    return (
      <Centered>
        <LegalNotice tone="info" title="서명 완료">
          <span className="font-semibold text-green-700">
            서명이 완료되었습니다 ✓
          </span>{" "}
          대여자에게 알림이 전송되었습니다. 이 창은 닫으셔도 됩니다.
        </LegalNotice>
      </Centered>
    );
  }

  // ready 상태 — 서명 진행
  return (
    <main>
      <StepForm
        step={5}
        title="대여약정서 서명"
        description="아래 약정서 내용을 확인하시고 서명해주세요."
      >
        <div className="space-y-5">
          {agreement && <AgreementPreview agreement={agreement} />}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-brand-600"
            />
            <span className="text-sm text-slate-700">
              위 약정서 내용을 모두 확인하였습니다.
            </span>
          </label>

          {confirmed && (
            <>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">
                  1. 본인인증 (이메일 OTP)
                </h3>
                <OtpInput
                  token={token}
                  signerType="borrower"
                  onVerified={() => setOtpVerified(true)}
                />
              </div>

              {otpVerified && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">
                    2. 전자서명
                  </h3>
                  <SignatureStampField
                    onChange={setSignature}
                    defaultName={agreement?.borrower?.name ?? ""}
                  />
                </div>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                onClick={handleSign}
                disabled={!otpVerified || !signature || loading}
                fullWidth
              >
                {loading ? "처리 중..." : "서명 완료"}
              </Button>
            </>
          )}
        </div>
      </StepForm>
      <Footer />
    </main>
  );
}

// 중앙 정렬 래퍼
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
