// 이메일 발송 — nodemailer SMTP 사용. Mock 모드에서는 console.log 만 한다.

import { isMockMode, getBaseUrl, SERVICE_NAME } from "./config";
import nodemailer, { type Transporter } from "nodemailer";
import type {
  Agreement,
  ExpiryNotifyType,
  InterestRecord,
  Subscription,
  TaxConsultation,
} from "./types";

// 관리자/세무사 알림 수신 주소
const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "gt.min@hwaseon.com";

// HTML escape (사용자 입력값을 이메일 본문에 안전하게 삽입)
function escapeHtml(value: string): string {
  return (value ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 발신자 주소 — SMTP_USER 환경변수 우선, 미설정 시 기본 주소
const FROM_EMAIL = process.env.SMTP_USER || "gt.min@hwaseon.com";
const FROM_ADDRESS = `${SERVICE_NAME} <${FROM_EMAIL}>`;

// 전역 캐시(서버리스 환경에서도 동일 인스턴스 내 재사용)로 트랜스포터를 싱글톤 보관
const globalForTransporter = globalThis as unknown as {
  __loanAgreementMailTransporter?: Transporter;
};

// SMTP 트랜스포터 싱글톤 — 모듈 1회 호출당 1회 생성 후 재사용
function getTransporter(): Transporter {
  if (globalForTransporter.__loanAgreementMailTransporter) {
    return globalForTransporter.__loanAgreementMailTransporter;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.worksmobile.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // 포트 587 → STARTTLS (secure=false)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });
  globalForTransporter.__loanAgreementMailTransporter = transporter;
  return transporter;
}

// SMTP 로 이메일 발송 (실모드 전용)
async function sendViaSmtp(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP_USER 또는 SMTP_PASS 환경변수가 설정되지 않았습니다.");
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });
    console.log(
      `[EMAIL] 발송 완료 messageId=${info.messageId} to=${to} subject="${subject}"`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[EMAIL] 발송 실패 to=${to} subject="${subject}": ${msg}`);
    throw new Error(`SMTP 발송 실패: ${msg}`);
  }
}

// 공통 발송 래퍼 — Mock 이면 콘솔 출력만
async function send(to: string, subject: string, html: string): Promise<void> {
  if (isMockMode()) {
    console.log(`[MOCK EMAIL] to=${to} subject="${subject}"`);
    return;
  }
  await sendViaSmtp(to, subject, html);
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

// KST(한국시간) 기준 "YYYY-MM-DD HH:mm" 포맷
function formatKst(iso: string): string {
  try {
    const d = new Date(iso);
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const ymd = kst.toISOString().slice(0, 10);
    const hm = kst.toISOString().slice(11, 16);
    return `${ymd} ${hm}`;
  } catch {
    return iso;
  }
}

// 세무상담 신청 관리자 알림 이메일 (신청 즉시 gt.min@hwaseon.com 수신)
export async function sendTaxConsultNotice(
  consult: TaxConsultation
): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="color:#1d4ed8;">[${SERVICE_NAME}] 세무상담 신청이 접수되었습니다</h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <tr><td style="padding:6px 0;color:#64748b;width:90px;">이름</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(consult.name)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">연락처</td><td style="padding:6px 0;">${escapeHtml(consult.phone)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">이메일</td><td style="padding:6px 0;">${escapeHtml(consult.email ?? "-")}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">신청일시</td><td style="padding:6px 0;">${formatKst(consult.createdAt)} KST</td></tr>
      </table>
      <div style="margin:6px 0;color:#64748b;font-size:13px;">상담 내용</div>
      <div style="background:#f1f5f9;border-radius:10px;padding:16px;white-space:pre-wrap;font-size:14px;color:#334155;">${escapeHtml(consult.content)}</div>
      <p style="margin-top:20px;">
        <a href="${getBaseUrl()}/admin/dashboard" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;">관리자 대시보드에서 확인하기</a>
      </p>
    </div>
  `;
  await send(
    ADMIN_EMAIL,
    `[${SERVICE_NAME}] 세무상담 신청이 접수되었습니다`,
    html
  );
}

// 세무사 일괄 발송 이메일 — 선택한 신청 목록을 HTML 테이블로 발송
export async function sendTaxConsultListEmail(
  consults: TaxConsultation[]
): Promise<void> {
  const dateStr = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const rows = consults
    .map((c) => {
      const summary =
        c.content.length > 40 ? `${c.content.slice(0, 40)}...` : c.content;
      return `
        <tr>
          <td style="border:1px solid #e2e8f0;padding:8px;">${formatKst(c.createdAt).slice(5, 10)}</td>
          <td style="border:1px solid #e2e8f0;padding:8px;">${escapeHtml(c.name)}</td>
          <td style="border:1px solid #e2e8f0;padding:8px;">${escapeHtml(c.phone)}</td>
          <td style="border:1px solid #e2e8f0;padding:8px;">${escapeHtml(c.email ?? "-")}</td>
          <td style="border:1px solid #e2e8f0;padding:8px;">${escapeHtml(summary)}</td>
        </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:720px;margin:0 auto;padding:24px;">
      <h2 style="color:#1d4ed8;">[${SERVICE_NAME}] 세무상담 신청 목록 - ${dateStr} ${consults.length}건</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="border:1px solid #e2e8f0;padding:8px;text-align:left;">신청일</th>
            <th style="border:1px solid #e2e8f0;padding:8px;text-align:left;">이름</th>
            <th style="border:1px solid #e2e8f0;padding:8px;text-align:left;">연락처</th>
            <th style="border:1px solid #e2e8f0;padding:8px;text-align:left;">이메일</th>
            <th style="border:1px solid #e2e8f0;padding:8px;text-align:left;">상담 내용 요약</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  await send(
    ADMIN_EMAIL,
    `[${SERVICE_NAME}] 세무상담 신청 목록 - ${dateStr} ${consults.length}건`,
    html
  );
}

// 만기 알림 이메일 — 대여자에게 갱신 링크와 함께 발송 (기획서 5-4)
export async function sendExpiryNoticeEmail(
  agreement: Agreement,
  notifyType: ExpiryNotifyType
): Promise<void> {
  const renewLink = `${getBaseUrl()}/renew/${agreement.id}?token=${agreement.lenderSignToken}`;

  // 발송 시점별 제목/문구 (기획서 5-4)
  const variants: Record<
    ExpiryNotifyType,
    { subject: string; heading: string; message: string }
  > = {
    "30d": {
      subject: `[${SERVICE_NAME}] 약정서 만기 1개월 전 알림`,
      heading: "약정서 만기가 1개월 남았습니다",
      message:
        "대여 약정서의 만기가 약 30일 후로 다가왔습니다. 만기 이후에도 대여 관계를 유지하시려면 갱신(연장)을 준비해주세요. 만기된 약정서는 세무조사 시 대여가 아닌 증여로 오인될 수 있습니다.",
    },
    "7d": {
      subject: `[${SERVICE_NAME}] 약정서 만기가 7일 남았습니다`,
      heading: "약정서 만기가 7일 남았습니다",
      message:
        "대여 약정서의 만기가 7일 후로 임박했습니다. 지금 갱신하지 않으면 만기 이후 대여 사실 입증이 어려워질 수 있습니다. 아래 버튼으로 즉시 갱신을 진행해주세요.",
    },
    "0d": {
      subject: `[${SERVICE_NAME}] 약정서 만기일입니다`,
      heading: "오늘이 약정서 만기일입니다",
      message:
        "대여 약정서의 만기일이 오늘입니다. 대여 관계를 유지하시려면 지금 바로 갱신을 진행해주세요. 갱신 시 기존 정보가 자동으로 채워집니다.",
    },
  };

  const v = variants[notifyType];
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#1d4ed8;">${SERVICE_NAME} — ${v.heading}</h2>
      <p>${escapeHtml(agreement.lender.name)}님, ${escapeHtml(agreement.borrower.name)}님과의 대여 약정서 만기가 다가오고 있습니다.</p>
      <div style="background:#f1f5f9;border-radius:10px;padding:16px;margin:18px 0;font-size:14px;color:#334155;">
        <p style="margin:0 0 6px 0;color:#64748b;font-size:13px;">만기일</p>
        <p style="margin:0;font-size:18px;font-weight:bold;color:#1d4ed8;">${escapeHtml(agreement.endDate)}</p>
      </div>
      <p style="font-size:14px;color:#475569;">${v.message}</p>
      <p style="margin-top:20px;">
        <a href="${renewLink}" style="display:inline-block;padding:12px 22px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;">약정서 갱신하기</a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
        본 링크는 본인 확인용 토큰을 포함합니다. 타인에게 공유하지 마세요.<br/>
        문의: ${ADMIN_EMAIL}
      </p>
    </div>
  `;
  await send(agreement.lender.email, v.subject, html);
}

// 천 단위 콤마 (이메일 본문용 — interest-calc 의존성 없이 간단 처리)
function comma(n: number): string {
  return n.toLocaleString("ko-KR");
}

// 이자 납부일 알림 이메일 — 구독자에게 발송
// 약정서 정보, 이자 금액, 납부 계좌(대여자 이름), 납부 확인 링크 포함
export async function sendInterestReminderEmail(
  subscription: Subscription,
  record: InterestRecord,
  agreement: Agreement
): Promise<void> {
  // 납부 확인 링크 — 구독 대시보드 (lenderSignToken 으로 접근)
  const dashboardUrl = `${getBaseUrl()}/subscribe/${subscription.agreementId}/dashboard?token=${agreement.lenderSignToken}`;
  const [, month, day] = record.dueDate.split("-");

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#1d4ed8;">${SERVICE_NAME} — 이자 납부일 알림</h2>
      <p>${escapeHtml(agreement.borrower.name)}님, 오늘은 이자 납부일입니다.</p>
      <div style="background:#f1f5f9;border-radius:10px;padding:16px;margin:18px 0;font-size:14px;color:#334155;">
        <p style="margin:0 0 4px 0;color:#64748b;font-size:13px;">납부일</p>
        <p style="margin:0 0 12px 0;font-size:16px;font-weight:bold;color:#1d4ed8;">${escapeHtml(record.dueDate)}</p>
        <p style="margin:0 0 4px 0;color:#64748b;font-size:13px;">이번 달 이자 금액</p>
        <p style="margin:0 0 12px 0;font-size:20px;font-weight:bold;color:#1d4ed8;">${comma(record.amount)}원</p>
        <p style="margin:0 0 4px 0;color:#64748b;font-size:13px;">받는 사람(대여자)</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#334155;">${escapeHtml(agreement.lender.name)}</p>
      </div>
      <p style="font-size:13px;color:#475569;">
        이자를 정기적으로 납부하고 기록을 남기면, 가족 간 거래가 증여가 아닌
        실제 대여임을 입증하는 강력한 증거가 됩니다.
      </p>
      <p style="margin-top:20px;">
        <a href="${dashboardUrl}" style="display:inline-block;padding:12px 22px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;">납부 확인하기</a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">문의: ${ADMIN_EMAIL}</p>
    </div>
  `;
  await send(
    subscription.email,
    `[${SERVICE_NAME}] 이자 납부일 알림 - ${Number(month)}월 ${Number(day)}일`,
    html
  );
}

// 구독 신청 완료 안내 이메일
export async function sendSubscriptionConfirmEmail(
  subscription: Subscription,
  agreement: Agreement
): Promise<void> {
  const dashboardUrl = `${getBaseUrl()}/subscribe/${subscription.agreementId}/dashboard?token=${agreement.lenderSignToken}`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#1d4ed8;">${SERVICE_NAME} — 이자 관리 구독 신청 완료</h2>
      <p>이자 관리 구독이 정상적으로 신청되었습니다.</p>
      <div style="background:#f1f5f9;border-radius:10px;padding:16px;margin:18px 0;font-size:14px;color:#334155;">
        <p style="margin:0 0 8px 0;">매월 <b>${subscription.billingDay}일</b>에 이자 납부일 알림을 보내드립니다.</p>
        <p style="margin:0;">월 이자 금액: <b>${comma(subscription.interestAmount)}원</b></p>
      </div>
      <p style="margin-top:20px;">
        <a href="${dashboardUrl}" style="display:inline-block;padding:12px 22px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;">이자 관리 현황 보기</a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">문의: ${ADMIN_EMAIL}</p>
    </div>
  `;
  await send(
    subscription.email,
    `[${SERVICE_NAME}] 이자 관리 구독이 신청되었습니다`,
    html
  );
}
