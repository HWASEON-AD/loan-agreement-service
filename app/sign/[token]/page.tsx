// /sign/[token] — 차용자 서명 페이지
import { BorrowerSign } from "@/components/sign/BorrowerSign";

export default function SignPage({ params }: { params: { token: string } }) {
  return <BorrowerSign token={params.token} />;
}
