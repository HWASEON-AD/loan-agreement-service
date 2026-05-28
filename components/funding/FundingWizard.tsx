"use client";
// 자금조달계획서 3단계 위자드 (상태 관리 + sessionStorage 동기화)
import React, { useEffect, useState } from "react";
import type {
  FundingStep1Data,
  FundingExtractResult,
  FundingWizardSession,
} from "@/lib/funding-types";
import { FundingStep1Basic } from "./FundingStep1Basic";
import { FundingStep2Story } from "./FundingStep2Story";
import { FundingStep3Review } from "./FundingStep3Review";

const STORAGE_KEY = "funding_wizard_session";

// 진행 단계 표시 바
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "기본 정보" },
    { n: 2, label: "스토리 입력" },
    { n: 3, label: "검토 & 다운로드" },
  ];
  const pct = Math.round((current / 3) * 100);

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-brand-700">
          Step {current} / 3
        </span>
        <span className="text-slate-500">{steps[current - 1].label}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        {steps.map((s) => (
          <div
            key={s.n}
            className={
              s.n <= current
                ? "text-brand-700 font-medium"
                : "text-slate-400"
            }
          >
            {s.n}. {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// sessionStorage 안전 접근
function loadSession(): FundingWizardSession | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed.step === 1 || parsed.step === 2 || parsed.step === 3)
    ) {
      return parsed as FundingWizardSession;
    }
  } catch (err) {
    console.error("[FundingWizard] 세션 복원 실패:", err);
  }
  return null;
}

function saveSession(session: FundingWizardSession) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.error("[FundingWizard] 세션 저장 실패:", err);
  }
}

function clearSession() {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}

export function FundingWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [step1, setStep1] = useState<FundingStep1Data | null>(null);
  const [step2Story, setStep2Story] = useState<string>("");
  const [step3Result, setStep3Result] = useState<FundingExtractResult | null>(
    null
  );
  const [hydrated, setHydrated] = useState(false);

  // 마운트 시 sessionStorage 복원 (보안: 주민번호 뒷자리는 저장하지 않음)
  useEffect(() => {
    const session = loadSession();
    if (session) {
      // step1에 idNumberBack은 저장되지 않았으므로 빈값일 수 있음
      // → step1 복원 시 idNumberBack이 비어있으면 step=1로 강제
      const hasIdBack =
        session.step1 &&
        typeof session.step1 === "object" &&
        "baseInfo" in session.step1 &&
        session.step1.baseInfo.idNumberBack &&
        session.step1.baseInfo.idNumberBack.length === 7;

      if (hasIdBack) {
        setStep(session.step);
      } else {
        setStep(1);
      }
      setStep1(session.step1);
      setStep2Story(session.step2Story);
      setStep3Result(session.step3Result);
    }
    setHydrated(true);
  }, []);

  // 상태 변화마다 sessionStorage 저장 (주민번호 뒷자리는 마스킹해서 저장)
  useEffect(() => {
    if (!hydrated) return;
    // 주민번호 뒷자리는 sessionStorage에 저장하지 않음 (보안 규칙 5)
    let safeStep1: FundingStep1Data | null = null;
    if (step1) {
      if (step1.formType === "housing") {
        safeStep1 = {
          formType: "housing",
          baseInfo: { ...step1.baseInfo, idNumberBack: "" },
        };
      } else {
        safeStep1 = {
          formType: "land",
          baseInfo: { ...step1.baseInfo, idNumberBack: "" },
        };
      }
    }
    saveSession({
      step,
      step1: safeStep1,
      step2Story,
      step3Result,
    });
  }, [step, step1, step2Story, step3Result, hydrated]);

  // Step 1 → 2
  const handleStep1Next = (data: FundingStep1Data) => {
    setStep1(data);
    setStep(2);
  };

  // Step 2 → 3
  const handleStep2Next = (story: string, result: FundingExtractResult) => {
    setStep2Story(story);
    setStep3Result(result);
    setStep(3);
  };

  // Step 2 → 1 (이전)
  const handleStep2Back = () => {
    setStep(1);
  };

  // Step 3 → 2 (이전)
  const handleStep3Back = () => {
    setStep(2);
  };

  // 처음부터 다시
  const handleReset = () => {
    clearSession();
    setStep1(null);
    setStep2Story("");
    setStep3Result(null);
    setStep(1);
  };

  if (!hydrated) {
    return (
      <div className="text-center text-sm text-slate-400">불러오는 중...</div>
    );
  }

  return (
    <div>
      <StepIndicator current={step} />

      {step === 1 && (
        <FundingStep1Basic
          initialData={step1}
          onNext={handleStep1Next}
        />
      )}

      {step === 2 && step1 && (
        <FundingStep2Story
          step1Data={step1}
          initialStory={step2Story}
          onNext={handleStep2Next}
          onBack={handleStep2Back}
        />
      )}

      {step === 3 && step1 && step3Result && (
        <FundingStep3Review
          step1Data={step1}
          result={step3Result}
          onBack={handleStep3Back}
        />
      )}

      {/* 안전망: step이 2,3인데 데이터 없으면 step 1로 리셋 */}
      {((step === 2 && !step1) ||
        (step === 3 && (!step1 || !step3Result))) && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          이전 단계 데이터가 없습니다.{" "}
          <button
            onClick={handleReset}
            className="underline font-semibold"
          >
            처음부터 다시 시작
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6 text-center">
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            처음부터 다시 작성하기
          </button>
        </div>
      )}
    </div>
  );
}
