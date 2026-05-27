// /create/step/[step] — 작성 마법사 라우터 (서버 컴포넌트 → 클라이언트 위임)
import { notFound } from "next/navigation";
import { CreateWizard } from "@/components/create/CreateWizard";

// 1~6 정적 생성
export function generateStaticParams() {
  return [1, 2, 3, 4, 5, 6].map((n) => ({ step: String(n) }));
}

export default function StepPage({ params }: { params: { step: string } }) {
  const step = Number(params.step);
  if (!Number.isInteger(step) || step < 1 || step > 6) {
    notFound();
  }
  return <CreateWizard step={step} />;
}
