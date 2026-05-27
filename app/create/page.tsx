// /create — 작성 시작 (Step 1 로 리다이렉트)
import { redirect } from "next/navigation";

export default function CreateIndex() {
  redirect("/create/step/1");
}
