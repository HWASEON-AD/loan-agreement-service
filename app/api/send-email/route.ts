// POST /api/send-email — CCR 등 외부 에이전트가 API Key 인증 후 이메일을 발송하는 엔드포인트
// - api_key 인증 (process.env.EMAIL_API_KEY와 비교)
// - 수신자는 서버에서 gt.min@hwaseon.com 으로 고정 (외부에서 변경 불가)
// - body가 "<"로 시작하면 HTML, 아니면 plain text 로 발송
// 기존 lib/email.ts 는 수정하지 않고 nodemailer 를 직접 사용한다.

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// 수신자 고정 — 요청 파라미터로 변경 불가 (보안)
const FIXED_TO = "gt.min@hwaseon.com";

type SendEmailRequest = {
  api_key?: string;
  subject?: string;
  body?: string;
};

export async function POST(req: NextRequest) {
  // 1) JSON 파싱
  let payload: SendEmailRequest;
  try {
    payload = (await req.json()) as SendEmailRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const { api_key, subject, body } = payload;

  // 2) API Key 인증
  if (!process.env.EMAIL_API_KEY || api_key !== process.env.EMAIL_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 3) 필수 파라미터 확인
  if (!subject || !body) {
    return NextResponse.json(
      { ok: false, error: "subject and body are required" },
      { status: 400 }
    );
  }

  // 4) SMTP 환경변수 확인
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    return NextResponse.json(
      { ok: false, error: "SMTP not configured" },
      { status: 500 }
    );
  }

  // 5) nodemailer 트랜스포터 생성 후 발송
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.worksmobile.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // 포트 587 → STARTTLS
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });

    // body가 "<"로 시작하면 HTML, 아니면 plain text
    const isHtml = body.trimStart().startsWith("<");

    await transporter.sendMail({
      from: smtpUser,
      to: FIXED_TO,
      subject,
      ...(isHtml ? { html: body } : { text: body }),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[send-email] 발송 실패 subject="${subject}": ${msg}`);
    return NextResponse.json(
      { ok: false, error: `SMTP 발송 실패: ${msg}` },
      { status: 500 }
    );
  }
}
