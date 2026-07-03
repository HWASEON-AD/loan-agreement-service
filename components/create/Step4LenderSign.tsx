"use client";

// Step 4: 대여자(갑) 서명 — 이메일 OTP 인증 + 서명 캔버스
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StepForm } from "@/components/StepForm";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/OtpInput";
import { SignatureStampField } from "@/components/SignatureStampField";
import { LegalNotice } from "@/components/ui/LegalNotice";
import { loadAgreementId } from "@/lib/form-store";

export function Step4LenderSign() {
  const router = useRouter();
  const [agreementId, setAgreementId] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = loadAgreementId();
    if (!id) {
      router.replace("/create/step/1");
      return;
    }
    setAgreementId(id);
  }, [router]);

  // 서명 완료 처리
  const handleSign = async () => {
    if (!agreementId || !signature) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/agreements/${agreementId}/sign-lender`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signatureImageBase64: signature }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "서명 처리 실패");
      router.push("/create/step/5");
    } catch (e) {
      setError(e instanceof Error ? e.message : "서명 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!agreementId) return null;

  return (
    <StepForm
      step={4}
      title="대여자(갑) 전자서명"
      description="본인인증 후 약정서에 전자서명을 진행합니다."
    >
      <div className="space-y-5">
        <LegalNotice tone="info" title="감사로그 안내">
          서명 시각, IP 주소, 기기 정보, 본인인증 여부, 문서 해시가 자동으로
          기록되어 서명 증거로 보관됩니다.
        </LegalNotice>

        {/* 1) OTP 인증 */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            1. 본인인증 (이메일 OTP)
          </h3>
          <OtpInput
            agreementId={agreementId}
            signerType="lender"
            onVerified={() => setOtpVerified(true)}
          />
        </div>

        {/* 2) 서명 캔버스 + 서명 완료 버튼 (OTP 인증 후에만 노출) */}
        {otpVerified && (
          <div className="space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                2. 전자서명
              </h3>
              <SignatureStampField onChange={setSignature} />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button
              onClick={handleSign}
              disabled={!signature || loading}
              fullWidth
            >
              {loading ? "처리 중..." : "서명 완료 — 다음 단계"}
            </Button>
          </div>
        )}
      </div>
    </StepForm>
  );
}
