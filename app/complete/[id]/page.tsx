// /complete/[id] — 완료 페이지
import { CompleteView } from "@/components/complete/CompleteView";

export default function CompletePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  return (
    <CompleteView agreementId={params.id} token={searchParams.t ?? null} />
  );
}
