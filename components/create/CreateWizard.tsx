"use client";

// 작성 마법사 라우터 — step 번호에 따라 해당 Step 컴포넌트 렌더
import React from "react";
import { Step1Amount } from "./Step1Amount";
import { Step2Parties } from "./Step2Parties";
import { Step3Preview } from "./Step3Preview";
import { Step4LenderSign } from "./Step4LenderSign";
import { Step5RequestBorrower } from "./Step5RequestBorrower";
import { Step6Payment } from "./Step6Payment";

export function CreateWizard({ step }: { step: number }) {
  switch (step) {
    case 1:
      return <Step1Amount />;
    case 2:
      return <Step2Parties />;
    case 3:
      return <Step3Preview />;
    case 4:
      return <Step4LenderSign />;
    case 5:
      return <Step5RequestBorrower />;
    case 6:
      return <Step6Payment />;
    default:
      return null;
  }
}
