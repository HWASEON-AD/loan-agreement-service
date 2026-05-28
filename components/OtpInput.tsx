"use client";

// OTP 입력 + 발송/검증 흐름 컴포넌트
import React, { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { LegalNotice } from "./ui/LegalNotice";

interface Props {
  agreementId?: string;
  token?: string; // 차용자 서명 페이지에서 토큰으로 접근 시
  signerType: "lender" | "borrower";
  // 검증 완료 시 호출
  onVerified: () => void;
}

export function OtpInput({ agreementId, token, signerType, onVerified }: Props) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [emailHint, setEmailHint] = useState("");
  const [verified, setVerified] = useState(false);

  // OTP 발송
  const handleSend = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreementId, token, signerType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "발송 실패");
      setSent(true);
      setMockCode(data.mockCode ?? null);
      setEmailHint(data.emailHint ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "인증번호 발송에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // OTP 검증
  const handleVerify = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreementId, token, signerType, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid)
        throw new Error(data.error || "인증번호가 일치하지 않습니다.");
      setVerified(true);
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "인증에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <LegalNotice tone="info">
        <span className="font-semibold text-green-700">본인인증 완료 ✓</span> 아래에서 서명을 진행해주세요.
      </LegalNotice>
    );
  }

  return (
    <div className="space-y-3">
      {!sent ? (
        <Button onClick={handleSend} disabled={loading} fullWidth>
          {loading ? "발송 중..." : "이메일로 인증번호 받기"}
        </Button>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {emailHint} 로 인증번호를 보냈습니다. (10분 유효)
          </p>
          {mockCode && (
            <LegalNotice tone="warn" title="Mock 모드 안내">
              데모 환경입니다. 발급된 인증번호:{" "}
              <span className="font-bold tracking-widest">{mockCode}</span>
            </LegalNotice>
          )}
          <Input
            label="인증번호 6자리"
            value={code}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              fullWidth
            >
              {loading ? "확인 중..." : "인증 확인"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSend}
              disabled={loading}
              fullWidth
            >
              {loading ? "발송 중..." : "인증번호 재발송"}
            </Button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
