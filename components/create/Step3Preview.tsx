"use client";

// Step 3: 약정서 미리보기 + 동의 후 약정서 생성
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StepForm } from "@/components/StepForm";
import { Button } from "@/components/ui/Button";
import { AgreementPreview } from "@/components/AgreementPreview";
import { loadForm, saveAgreementId, loadAgreementId } from "@/lib/form-store";
import type { CreateFormData } from "@/lib/types";

export function Step3Preview() {
  const router = useRouter();
  const [form, setForm] = useState<CreateFormData | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const f = loadForm();
    if (!f.amount || !f.lender.name) {
      // 데이터 없으면 step1 로
      router.replace("/create/step/1");
      return;
    }
    setForm(f);
  }, [router]);

  // 약정서 생성 → step4 로
  const handleNext = async () => {
    if (!form) return;
    setLoading(true);
    setError("");
    try {
      // 이미 생성된 약정서가 있으면 재사용
      const existingId = loadAgreementId();
      if (existingId) {
        router.push("/create/step/4");
        return;
      }

      const res = await fetch("/api/agreements/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "약정서 생성 실패");
      saveAgreementId(data.agreementId);
      router.push("/create/step/4");
    } catch (e) {
      setError(e instanceof Error ? e.message : "약정서 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!form) return null;

  return (
    <StepForm
      step={3}
      title="약정서 미리보기"
      description="입력하신 내용으로 작성된 약정서입니다. 내용을 확인해주세요."
    >
      <div className="space-y-5">
        <AgreementPreview form={form} />

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-brand-600"
          />
          <span className="text-sm text-slate-700">
            위 내용을 모두 확인하였으며, 이 내용으로 대여약정서를 작성하는 것에
            동의합니다.
          </span>
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/create/step/2")}
          >
            이전
          </Button>
          <Button
            onClick={handleNext}
            disabled={!agreed || loading}
            fullWidth
          >
            {loading ? "생성 중..." : "동의하고 서명 단계로"}
          </Button>
        </div>
      </div>
    </StepForm>
  );
}
