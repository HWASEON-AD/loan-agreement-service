// 이메일 발송 — Resend 사용. Mock 모드에서는 console.log 만 한다.

import { isMockMode, getBaseUrl, SERVICE_NAME } from "./config";

// Resend API 로 이메일 발송 (실모드 전용)
async function sendViaResend(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY 가 설정되지 않았습니다.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${SERVICE_NAME} <noreply@example.com>`,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend 발송 실패 (${res.status}): ${text}`);
  }
}

// 공통 발송 래퍼 — Mock 이면 콘솔 출력
async function send(to: string, subject: string, html: string): Promise<void> {
  if (isMockMode()) {
    console.log(`[MOCK EMAIL] to=${to} subject="${subject}"`);
    return;
  }
  await sendViaResend(to, subject, html);
}

// OTP 인증번호 이메일
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2>${SERVICE_NAME} 본인인증</h2>
      <p>아래 인증번호를 입력해주세요. (10분간 유효)</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1d4ed8;">${code}</div>
    </div>
  `;
  await send(to, `[${SERVICE_NAME}] 인증번호: ${code}`, html);
}

// 차용자 서명 요청 이메일
export async function sendBorrowerSignRequest(
  to: string,
  borrowerName: string,
  lenderName: string,
  token: string
): Promise<void> {
  const link = `${getBaseUrl()}/sign/${token}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2>${SERVICE_NAME} 서명 요청</h2>
      <p>${borrowerName}님, ${lenderName}님이 대여약정서 서명을 요청하셨습니다.</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;">서명하러 가기</a></p>
      <p style="color:#888;font-size:13px;">본 링크는 7일간 유효합니다.</p>
    </div>
  `;
  await send(to, `[${SERVICE_NAME}] ${lenderName}님의 서명 요청`, html);
}

// 서명 완료 알림 이메일 (대여자에게)
export async function sendBorrowerSignedNotice(
  to: string,
  lenderName: string,
  borrowerName: string
): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2>${SERVICE_NAME} 서명 완료 안내</h2>
      <p>${lenderName}님, ${borrowerName}님이 서명을 완료하였습니다.</p>
      <p>결제를 진행하시면 내용증명 발송이 접수됩니다.</p>
    </div>
  `;
  await send(to, `[${SERVICE_NAME}] 상대방 서명이 완료되었습니다`, html);
}

// 내용증명 발송 완료 알림 이메일 (등기번호 + 조회 링크)
export async function sendCertMailTrackingEmail(
  to: string,
  name: string,
  agreementId: string,
  trackingNumber: string
): Promise<void> {
  const baseUrl = getBaseUrl();
  const trackingUrl = `https://service.epost.go.kr/trace.RetrieveDomesticObjectNumber.comm?sid1=${trackingNumber}`;
  const completeUrl = `${baseUrl}/complete/${agreementId}`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#1d4ed8;">${SERVICE_NAME} — 내용증명 발송 완료</h2>
      <p>${name}님, 우체국 내용증명이 발송되었습니다.</p>
      <div style="background:#f1f5f9;border-radius:10px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 6px 0;font-size:13px;color:#64748b;">등기번호</p>
        <p style="margin:0;font-size:22px;font-weight:bold;letter-spacing:3px;color:#1d4ed8;">${trackingNumber}</p>
      </div>
      <a href="${trackingUrl}" style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;margin-bottom:12px;">
        우체국 배송 조회하기
      </a>
      <br/>
      <a href="${completeUrl}" style="display:inline-block;padding:10px 16px;border:1px solid #cbd5e1;color:#475569;border-radius:8px;text-decoration:none;font-size:13px;margin-top:8px;">
        약정서 PDF 다운로드
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
        상대방 수령 후 배송 상태가 업데이트됩니다.<br/>
        문의: gt.min@hwaseon.com
      </p>
    </div>
  `;
  await send(to, `[${SERVICE_NAME}] 내용증명이 발송되었습니다 (등기: ${trackingNumber})`, html);
}

// 최종 확인 이메일 (결제 완료 후 PDF 다운로드 링크)
export async function sendCompletionEmail(
  to: string,
  name: string,
  agreementId: string
): Promise<void> {
  const link = `${getBaseUrl()}/complete/${agreementId}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2>${SERVICE_NAME} 접수 완료</h2>
      <p>${name}님, 대여약정서 작성 및 내용증명 발송 접수가 완료되었습니다.</p>
      <p><a href="${link}">완료 페이지에서 서명 문서 다운로드</a></p>
      <p style="color:#888;font-size:13px;">영업일 2~3일 내 내용증명이 발송됩니다.</p>
    </div>
  `;
  await send(to, `[${SERVICE_NAME}] 접수가 완료되었습니다`, html);
}
