// POST /api/tax-consult/submit — 세무상담 신청 접수
// 1) 입력값 유효성 검사
// 2) tax_consultations 테이블 INSERT (Mock 모드는 메모리 스토어)
// 3) 관리자 알림 이메일 발송 (실패해도 200)
// 4) Rate limit: IP당 3분에 1회

import { NextRequest, NextResponse } from "next/server";
import { createTaxConsultation } from "@/lib/db";
import { sendTaxConsultNotice } from "@/lib/email";
import { uuid } from "@/lib/otp";
import { getClientIp } from "@/lib/request-info";
import type {
  CreateTaxConsultationInput,
  TaxConsultation,
} from "@/lib/types";

// ─── Rate limit (메모리, IP당 3분 1회) ───
const RATE_LIMIT_MS = 3 * 60 * 1000;
const globalForRate = globalThis as unknown as {
  __taxConsultRateMap?: Map<string, number>;
};
function getRateMap(): Map<string, number> {
  if (!globalForRate.__taxConsultRateMap) {
    globalForRate.__taxConsultRateMap = new Map();
  }
  return globalForRate.__taxConsultRateMap;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9\-]{9,20}$/; // 숫자/하이픈만, 9~20자

export async function POST(req: NextRequest) {
  try {
    // Rate limit 확인
    const ip = getClientIp(req);
    const now = Date.now();
    const rateMap = getRateMap();
    const last = rateMap.get(ip);
    if (last && now - last < RATE_LIMIT_MS) {
      const wait = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
      return NextResponse.json(
        { error: `요청이 너무 잦습니다. ${wait}초 후 다시 시도해주세요.` },
        { status: 429 }
      );
    }

    const body = (await req.json()) as Partial<CreateTaxConsultationInput>;
    const name = (body.name ?? "").trim();
    const phone = (body.phone ?? "").trim();
    const email = (body.email ?? "").trim();
    const content = (body.content ?? "").trim();

    // 유효성 검사
    if (name.length < 2) {
      return NextResponse.json(
        { error: "이름을 2자 이상 입력해주세요." },
        { status: 400 }
      );
    }
    if (!PHONE_RE.test(phone)) {
      return NextResponse.json(
        { error: "연락처 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "이메일 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }
    if (content.length < 10) {
      return NextResponse.json(
        { error: "상담 내용을 10자 이상 입력해주세요." },
        { status: 400 }
      );
    }
    if (content.length > 1000) {
      return NextResponse.json(
        { error: "상담 내용은 최대 1000자까지 입력 가능합니다." },
        { status: 400 }
      );
    }

    // DB 저장
    const consult: TaxConsultation = {
      id: uuid(),
      name,
      phone,
      email,
      content,
      status: "pending",
      contactedAt: null,
      createdAt: new Date().toISOString(),
    };

    try {
      await createTaxConsultation(consult);
    } catch (dbErr) {
      console.error("[tax-consult/submit] DB 저장 실패:", dbErr);
      return NextResponse.json(
        { error: "신청 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // Rate limit 기록 (DB 저장 성공 후)
    rateMap.set(ip, now);

    // 관리자 알림 이메일 (실패해도 무시)
    try {
      await sendTaxConsultNotice(consult);
    } catch (mailErr) {
      console.error(
        "[tax-consult/submit] 관리자 알림 이메일 실패(무시):",
        mailErr
      );
    }

    return NextResponse.json({ success: true, id: consult.id });
  } catch (err) {
    console.error("[tax-consult/submit] 실패:", err);
    return NextResponse.json(
      { error: "신청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
