// 계약갱신 서식(통지서·확인서) 이메일 전송 API
//
// ★ 이 라우트는 '전송'만 한다. 서식 내용을 DB에 저장하지 않는다.
//    (서식에는 임대인·임차인 실명과 주소가 들어가므로 서버 미보관 원칙을 지킨다)
// ★ LLM 호출 0회.
//
// 🚨🚨 본문을 클라이언트에서 완성된 문자열로 받지 말 것.
//   예전에는 `subject` 와 `noticeText` 를 그대로 받아 메일로 내보냈다. 무인증 공개
//   엔드포인트에서 그렇게 하면 naejimayo.com 발신으로 **임의 제목·임의 본문을 아무에게나
//   보낼 수 있는 발송기**가 된다(피싱 악용). 레이트리밋은 속도만 늦출 뿐 성격을 못 바꾼다.
//   → 지금은 **입력값(kind + 서식 입력 필드)만 받고, 문서의 문장과 제목은 서버가 만든다.**
//     완성된 문서 구조(FormDoc)를 받는 것도 부족하다 — 껍데기를 흉내내면 본문 문단에
//     임의 문구를 넣을 수 있기 때문이다(실제로 확인함). 값만 받아야 문장이 100% 서버 소유가 된다.

import { NextRequest, NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { sendRenewalNoticeEmail } from "@/lib/email";
import {
  buildFormDoc,
  buildLawLabel,
  buildSubjectFromDoc,
  isDocKind,
  isRenewalInput,
  renderDocAsText,
} from "@/lib/renewal-doc";
import { getLawStatusForDisplay } from "@/lib/law-watch";

// 이메일 형식 최소 검증
function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// 클라이언트 IP (레이트리밋 키)
function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  try {
    // 무인증 엔드포인트이므로 남용 방지가 필수다. IP 기준 10분에 5회.
    // ※ 이건 2차 방어선이다. 1차 방어선은 아래 '서버가 본문을 조립한다'는 구조 자체다.
    if (!allowRequest(`renewal-send:${getIp(req)}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json(
        { error: "발송 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const to: string = (body?.to ?? "").trim();
    const cc: string = (body?.cc ?? "").trim(); // 본인 사본 수신용(선택)
    const kind = body?.kind;
    const notice = body?.notice;

    if (!isEmail(to)) {
      return NextResponse.json(
        { error: "받는 사람 이메일 주소가 올바르지 않습니다." },
        { status: 400 }
      );
    }
    if (cc && !isEmail(cc)) {
      return NextResponse.json(
        { error: "사본 받을 이메일 주소가 올바르지 않습니다." },
        { status: 400 }
      );
    }
    if (!isDocKind(kind) || !isRenewalInput(notice)) {
      return NextResponse.json({ error: "서식 내용이 올바르지 않습니다." }, { status: 400 });
    }

    // ★ 문서의 문장·제목은 전부 서버가 만든다. 이용자 입력은 칸 안의 값으로만 들어간다.
    const law = await getLawStatusForDisplay().catch(() => null);
    const doc = buildFormDoc(kind, notice, buildLawLabel(law?.effectiveDate, law?.lawNumber));
    const subject = buildSubjectFromDoc(doc);
    const noticeText = renderDocAsText(doc);

    // 수신자별로 1건씩 순차 발송 — 실패한 대상을 정확히 알기 위해 합쳐 보내지 않는다.
    await sendRenewalNoticeEmail(to, subject, noticeText);
    if (cc) {
      await sendRenewalNoticeEmail(cc, `[사본] ${subject}`, noticeText);
    }

    return NextResponse.json({ ok: true, to, cc: cc || null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[renewal/send] 발송 실패: ${msg}`);
    return NextResponse.json({ error: `발송에 실패했습니다: ${msg}` }, { status: 500 });
  }
}
