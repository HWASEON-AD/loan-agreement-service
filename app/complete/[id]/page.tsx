// /complete/[id] — 완료 페이지
import { CompleteView } from "@/components/complete/CompleteView";

export default function CompletePage({
  params,
}: {
  params: { id: string };
}) {
  return <CompleteView agreementId={params.id} />;
}
