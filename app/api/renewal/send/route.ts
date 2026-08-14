// 계약갱신 요구 통지서 이메일 전송 API
//
// ★ 이 라우트는 '전송'만 한다. 통지서 내용을 DB에 저장하지 않는다.
//    (생성 문서에는 임대인·임차인 실명과 주소가 들어가므로 서버 미보관 원칙을 지킨다)
// ★ LLM 호출 0회 — 본문은 클라이언트가 정형 서식으로 만든 텍스트를 그대로 받는다.

import { NextRequest, NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { sendRenewalNoticeEmail } from "@/lib/email";

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
    // 무인증 엔드포인트이므로 남용(스팸 발송기로 악용) 방지가 필수다.
    // IP 기준 10분에 5회.
    if (!allowRequest(`renewal-send:${getIp(req)}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json(
        { error: "발송 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const to: string = (body?.to ?? "").trim();
    const cc: string = (body?.cc ?? "").trim(); // 본인 사본 수신용(선택)
    const subject: string = (body?.subject ?? "").trim();
    const noticeText: string = body?.noticeText ?? "";

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
    if (!subject || !noticeText) {
      return NextResponse.json(
        { error: "통지서 내용이 비어 있습니다." },
        { status: 400 }
      );
    }
    // 본문 길이 상한 (통지서 1장 분량을 크게 넘지 않음)
    if (noticeText.length > 8000) {
      return NextResponse.json(
        { error: "통지서 내용이 너무 깁니다." },
        { status: 400 }
      );
    }

    // 수신자별로 1건씩 순차 발송 — 실패한 대상을 정확히 알기 위해 합쳐 보내지 않는다.
    await sendRenewalNoticeEmail(to, subject, noticeText);
    if (cc) {
      await sendRenewalNoticeEmail(cc, `[사본] ${subject}`, noticeText);
    }

    return NextResponse.json({ ok: true, to, cc: cc || null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[renewal/send] 발송 실패: ${msg}`);
    return NextResponse.json(
      { error: `발송에 실패했습니다: ${msg}` },
      { status: 500 }
    );
  }
}
