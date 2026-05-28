# loan-agreement-service — 전체 플로우 분석 및 SMTP 전환 기획

작성일: 2026-05-28
대상 프로젝트: `C:\Users\gtmin\Dropbox\5.개발\loan-agreement-service\`

---

## 1. 전체 플로우 단계별 현황

### 1-1. 플로우 맵

| 단계 | 경로 / API | 구현 상태 | 비고 |
|------|-----------|-----------|------|
| Step 1 — 금액·기간 입력 | `/create/step/1` → `Step1Amount.tsx` | 구현됨 | |
| Step 2 — 당사자 정보 입력 | `/create/step/2` → `Step2Parties.tsx` | 구현됨 | 생년월일 6자리 포함 |
| Step 3 — 약정서 미리보기 | `/create/step/3` → `Step3Preview.tsx` | 구현됨 | |
| 약정서 DB 저장 | `POST /api/agreements/create` | 구현됨 | 주문(Order)도 동시 생성 |
| Step 4 — 대여자 OTP 발송 | `POST /api/otp/send` (signerType=lender) | 구현됨 | |
| Step 4 — 대여자 OTP 검증 | `POST /api/otp/verify` (signerType=lender) | 구현됨 | |
| Step 4 — 대여자 서명 | `POST /api/agreements/[id]/sign-lender` | 구현됨 | OTP used=true 서버 재확인 |
| Step 5 — 차용자 서명 요청 이메일 | `POST /api/agreements/[id]/request-borrower` | 구현됨 | 토큰 만료 7일 갱신 포함 |
| Step 5 — 차용자 서명 완료 폴링 | `GET /api/agreements/[id]` (3초 간격) | 구현됨 | |
| 차용자 서명 페이지 | `/sign/[token]` → `BorrowerSign.tsx` | 구현됨 | |
| 차용자 OTP 발송/검증 | `/api/otp/send`, `/api/otp/verify` (signerType=borrower) | 구현됨 | token 파라미터로 약정서 조회 |
| 차용자 서명 처리 | `POST /api/agreements/[id]/sign-borrower` | 구현됨 | PDF 생성 + 대여자 알림 이메일 |
| Step 6 — 결제 | `POST /api/payment/confirm` | 구현됨 (Mock/실모드 분기) | 토스페이먼츠 위젯 미연동 이슈 있음 |
| 완료 페이지 | `/complete/[id]` → `CompleteView` | 구현됨 | |
| 관리자 내용증명 마킹 | `POST /api/admin/orders/[id]/mark-sent` | 구현됨 | 등기번호 이메일 발송 포함 |
| 관리자 내용증명 마킹 (약정서 ID 기준) | `POST /api/admin/agreements/[id]/mark-sent` | 구현됨 | 동일 기능, 파라미터만 다름 |

### 1-2. 플로우 다이어그램 (텍스트)

```
[대여자]                        [서비스]                        [차용자]
  |                               |                               |
  |--- Step1~2 (금액/당사자 입력) -->|                               |
  |                               |-- POST /api/agreements/create ->|
  |                               |   (Agreement + Order 생성)      |
  |--- Step4 OTP 발송 요청 ------->|                               |
  |<-- OTP 이메일 수신 ------------|-- sendOtpEmail() ------------>|
  |--- Step4 OTP 입력 검증 ------->|                               |
  |--- Step4 서명 (캔버스) ------->|-- sign-lender API             |
  |                               |   status: lender_signed        |
  |--- Step5 서명 요청 버튼 ------->|                               |
  |                               |-- sendBorrowerSignRequest() --->|
  |                               |   (서명 링크 이메일)            |
  |   [폴링: 3초마다 borrowerSigned 확인]                           |
  |                               |<-- /sign/[token] 접근 ---------|
  |                               |<-- 차용자 OTP 인증 + 서명 ------|
  |                               |   sign-borrower API             |
  |                               |   status: borrower_signed       |
  |                               |   PDF 생성                      |
  |<-- sendBorrowerSignedNotice() -|                               |
  |   (서명 완료 알림 이메일)       |                               |
  |--- Step6 결제 ---------------->|                               |
  |                               |-- payment/confirm API           |
  |                               |   status: paid                  |
  |<-- sendCompletionEmail() ------|-- sendCompletionEmail() ------->|
  |                               |                               |
  | [완료 페이지 /complete/[id]]   |                               |
  |                               |                               |
[관리자]                          |                               |
  |--- 대시보드 → mark-sent ------->|                               |
  |   (trackingNumber 입력)        |                               |
  |                               |   status: completed             |
  |<-- sendCertMailTrackingEmail() |                               |
  |   (등기번호 이메일)             |                               |
```

---

## 2. 생년월일 처리 현황

### 2-1. 타입 정의
- `lib/types.ts` Line 39: `Party.birth: string` — 생년월일 6자리 (YYMMDD), 주민번호 수집 금지 명시

### 2-2. UI 입력
- `Step2Parties.tsx` Line 44~51: `Input label="생년월일 6자리"`, maxLength=6, 숫자만 허용 (정규식 `[^0-9]` 제거), 플레이스홀더 "예: 920103"
- 유효성: `validParty()` 함수에서 `p.birth.length === 6` 강제

### 2-3. 본인 확인 활용 여부
- **현재 미활용**: birth 필드는 DB에 저장되고 약정서 PDF 텍스트에 포함되지만, OTP 발송/검증 시 birth 일치 여부를 별도로 체크하지 않는다.
- OTP 본인 확인은 이메일 수신 가능 여부(소유)로만 판단한다.
- 법적으로 이는 전자서명법 제3조의 "일반전자서명"으로 유효하며, 이전 법률검토에서 확인됨.
- 향후 강화가 필요하다면 차용자 서명 페이지에서 "생년월일 6자리 입력 후 일치 시 진행" 단계를 추가할 수 있다 (선택사항).

---

## 3. 발견된 이슈 목록

### 이슈 1 — CRITICAL: updateOrder에 trackingNumber 필드 누락
**파일:** `lib/db.ts` Line 357~380 (`updateOrder` 함수)

**문제:**
```typescript
// 현재 코드 — trackingNumber 처리 없음
const dbPatch: Record<string, unknown> = {};
if (patch.status !== undefined) dbPatch.status = patch.status;
if (patch.paymentKey !== undefined) dbPatch.payment_key = patch.paymentKey;
if (patch.paidAt !== undefined) dbPatch.paid_at = patch.paidAt;
if (patch.certMailStatus !== undefined) dbPatch.cert_mail_status = patch.certMailStatus;
if (patch.certMailSentAt !== undefined) dbPatch.cert_mail_sent_at = patch.certMailSentAt;
if (patch.notes !== undefined) dbPatch.notes = patch.notes;
// trackingNumber 가 없다!
```

**영향:** `mark-sent` API에서 `updateOrder(id, { trackingNumber })` 를 호출해도 Supabase DB에 `tracking_number` 컬럼이 업데이트되지 않는다. Mock 모드에서는 `mock-store.ts`의 `updateOrder`가 spread로 처리하므로 정상 동작하여 버그가 숨겨진다.

**수정 위치:** `lib/db.ts` Line 369 이후에 아래 한 줄 추가
```typescript
if (patch.trackingNumber !== undefined) dbPatch.tracking_number = patch.trackingNumber;
```

---

### 이슈 2 — 토스페이먼츠 위젯 미연동 (실모드 결제 불완전)
**파일:** `components/create/Step6Payment.tsx`

**문제:** 실모드(`NEXT_PUBLIC_MOCK_MODE=false`)에서 `handlePay` 함수가 `paymentKey`와 `orderId` 없이 `/api/payment/confirm`에 POST한다. 서버 측에서 이를 감지해 400을 반환하지만, 클라이언트에서는 토스페이먼츠 결제 위젯(SDK)을 호출하는 코드가 없다.

**영향:** 실모드 배포 시 결제 단계에서 오류 발생.

**수정 내용:** 실모드 시 토스페이먼츠 `@tosspayments/payment-widget-sdk` 설치 및 위젯 렌더링 코드 추가 필요. 현재는 Mock 모드로만 사용 가능. (미구현 기능으로 기획 문서에 별도 분리)

---

### 이슈 3 — 완료 이메일 발신자 주소 하드코딩 (noreply@example.com)
**파일:** `lib/email.ts` Line 26

**문제:**
```typescript
from: `${SERVICE_NAME} <noreply@example.com>`,
```
실모드에서 이 주소로 발송 시 Resend 도메인 인증 없이는 반송 처리됨. SMTP 전환으로 해결 가능.

---

### 이슈 4 — Step6Payment에서 토스 실모드 미구현 안내 노출 필요
**파일:** `components/create/Step6Payment.tsx` Line 90~93

현재 실모드(`MOCK=false`) 분기가 있으나, 위젯 SDK 없이 버튼을 누르면 400 오류가 발생한다. `MOCK=false`이고 결제 위젯 코드가 없으면 안내 메시지 표시 처리 필요.

---

### 이슈 5 — 관리자 mark-sent에서 차용자에게 등기번호 이메일 미발송
**파일:** `app/api/admin/orders/[id]/mark-sent/route.ts` Line 34~47
**파일:** `app/api/admin/agreements/[id]/mark-sent/route.ts` Line 38~44

**문제:** `sendCertMailTrackingEmail`이 `agreement.lender.email`에만 발송된다. 차용자도 내용증명 발송 사실을 알아야 하는 경우, `agreement.borrower.email`에도 발송이 필요할 수 있다. (현재는 대여자 전용 — 설계 의도인지 확인 필요)

---

### 이슈 6 — Step5 서명 링크 데모 노출 제거 필요
**파일:** `components/create/Step5RequestBorrower.tsx` Line 119~137

실 배포 시 "데모: 직접 열어 차용자 서명 진행 가능" 안내 블록은 제거하거나 개발 환경에서만 노출되도록 조건 처리가 필요하다.

---

## 4. SMTP 전환 상세 스펙

### 4-1. 현재 상태 vs 변경 후

| 항목 | 현재 (Resend) | 변경 후 (nodemailer SMTP) |
|------|--------------|--------------------------|
| 패키지 | 없음 (fetch 직접 호출) | `nodemailer` + `@types/nodemailer` |
| 발신자 | `noreply@example.com` (하드코딩) | `gt.min@hwaseon.com` |
| SMTP 서버 | - | `smtp.worksmobile.com:587` |
| 인증 | `RESEND_API_KEY` 환경변수 | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` 환경변수 |
| TLS | - | STARTTLS (포트 587 표준) |
| Mock 분기 | `isMockMode()` → console.log | 동일하게 유지 |

### 4-2. 환경변수 추가 목록

`.env.local` 에 추가:
```
SMTP_HOST=smtp.worksmobile.com
SMTP_PORT=587
SMTP_USER=gt.min@hwaseon.com
SMTP_PASS=4pZKZImiP1aD
```

Vercel 대시보드에도 동일 변수 추가 필요. `RESEND_API_KEY`는 더 이상 필요 없으므로 제거.

### 4-3. 수정 파일: `lib/email.ts` 전체 교체 스펙

기존 `sendViaResend` 함수를 `sendViaSmtp` 함수로 완전 교체한다. 나머지 내보내기 함수(`sendOtpEmail`, `sendBorrowerSignRequest` 등)는 시그니처 변경 없이 유지된다.

**교체 내용:**

```typescript
// lib/email.ts — nodemailer SMTP 버전

import { isMockMode, getBaseUrl, SERVICE_NAME } from "./config";
import nodemailer from "nodemailer";

// SMTP 트랜스포터 싱글톤 (모듈 로드 시 1회 생성)
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.worksmobile.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,          // 포트 587은 STARTTLS (secure=false)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });
}

const FROM_ADDRESS = `${SERVICE_NAME} <${process.env.SMTP_USER || "gt.min@hwaseon.com"}>`;

// SMTP 로 이메일 발송 (실모드 전용)
async function sendViaSmtp(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP_USER 또는 SMTP_PASS 환경변수가 설정되지 않았습니다.");
  }

  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });

  console.log(`[EMAIL] 발송 완료: messageId=${info.messageId} to=${to}`);
}

// 공통 발송 래퍼 — Mock 이면 콘솔 출력만
async function send(to: string, subject: string, html: string): Promise<void> {
  if (isMockMode()) {
    console.log(`[MOCK EMAIL] to=${to} subject="${subject}"`);
    return;
  }
  await sendViaSmtp(to, subject, html);
}

// 이하 sendOtpEmail, sendBorrowerSignRequest, sendBorrowerSignedNotice,
// sendCertMailTrackingEmail, sendCompletionEmail 함수는 변경 없이 유지
```

**트랜스포터 싱글톤 패턴 주의사항:**
- Next.js App Router는 서버리스 환경이므로 모듈 수준 싱글톤은 요청마다 재생성될 수 있다.
- `nodemailer.createTransport`는 가벼운 연산이므로 함수 내에서 매 호출마다 생성해도 성능 문제없다.
- 연결 풀링이 필요한 경우에만 `globalThis` 싱글톤 패턴을 적용한다.

### 4-4. package.json 추가 의존성

```json
"nodemailer": "^6.9.15"
```

devDependencies:
```json
"@types/nodemailer": "^6.4.16"
```

설치 명령:
```
npm install nodemailer
npm install -D @types/nodemailer
```

### 4-5. SMTP 연결 검증 방법

개발 환경에서 아래 임시 스크립트로 SMTP 연결 선행 테스트:

```typescript
// scripts/test-smtp.ts (임시 테스트용, 커밋 금지)
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.worksmobile.com",
  port: 587,
  secure: false,
  auth: {
    user: "gt.min@hwaseon.com",
    pass: "4pZKZImiP1aD",
  },
});

transporter.verify((error, success) => {
  if (error) console.error("SMTP 연결 실패:", error);
  else console.log("SMTP 연결 성공:", success);
});
```

---

## 5. updateOrder trackingNumber 패치 수정

### 수정 파일: `lib/db.ts`

**위치:** `updateOrder` 함수 내 (Line 364~370 사이)

**현재 코드:**
```typescript
const dbPatch: Record<string, unknown> = {};
if (patch.status !== undefined) dbPatch.status = patch.status;
if (patch.paymentKey !== undefined) dbPatch.payment_key = patch.paymentKey;
if (patch.paidAt !== undefined) dbPatch.paid_at = patch.paidAt;
if (patch.certMailStatus !== undefined) dbPatch.cert_mail_status = patch.certMailStatus;
if (patch.certMailSentAt !== undefined) dbPatch.cert_mail_sent_at = patch.certMailSentAt;
if (patch.notes !== undefined) dbPatch.notes = patch.notes;
```

**수정 후 코드 (trackingNumber 1줄 추가):**
```typescript
const dbPatch: Record<string, unknown> = {};
if (patch.status !== undefined) dbPatch.status = patch.status;
if (patch.paymentKey !== undefined) dbPatch.payment_key = patch.paymentKey;
if (patch.paidAt !== undefined) dbPatch.paid_at = patch.paidAt;
if (patch.certMailStatus !== undefined) dbPatch.cert_mail_status = patch.certMailStatus;
if (patch.certMailSentAt !== undefined) dbPatch.cert_mail_sent_at = patch.certMailSentAt;
if (patch.trackingNumber !== undefined) dbPatch.tracking_number = patch.trackingNumber; // 추가
if (patch.notes !== undefined) dbPatch.notes = patch.notes;
```

**영향 범위:** `mark-sent` API 2개 모두 `updateOrder`를 통해 `trackingNumber`를 저장하므로 이 수정으로 함께 해결된다.

---

## 6. 수정이 필요한 파일 전체 목록

### 필수 수정 (즉시)

| 순서 | 파일 | 수정 내용 | 긴급도 |
|------|------|-----------|--------|
| 1 | `lib/db.ts` | `updateOrder` 함수에 `trackingNumber` 처리 추가 (1줄) | 높음 |
| 2 | `lib/email.ts` | Resend → nodemailer SMTP 전환 (전체 교체) | 높음 |
| 3 | `package.json` | `nodemailer` + `@types/nodemailer` 추가 | 높음 |
| 4 | `.env.local` | `SMTP_HOST/PORT/USER/PASS` 추가, `RESEND_API_KEY` 제거 | 높음 |

### 권장 수정 (배포 전)

| 순서 | 파일 | 수정 내용 | 긴급도 |
|------|------|-----------|--------|
| 5 | `components/create/Step5RequestBorrower.tsx` | 서명 링크 데모 노출 블록 조건 처리 (`process.env.NODE_ENV === "development"`) | 중간 |
| 6 | `components/create/Step6Payment.tsx` | 토스 실모드 위젯 SDK 연동 또는 미구현 안내 | 중간 |

### 선택 수정 (향후)

| 순서 | 파일 | 수정 내용 | 긴급도 |
|------|------|-----------|--------|
| 7 | `app/api/admin/orders/[id]/mark-sent/route.ts` | 차용자에게도 등기번호 이메일 발송 추가 | 낮음 |
| 8 | `app/api/admin/agreements/[id]/mark-sent/route.ts` | 동일 | 낮음 |
| 9 | `app/sign/[token]/page.tsx` + `BorrowerSign.tsx` | 생년월일 일치 확인 단계 추가 (보안 강화) | 낮음 |

---

## 7. Vercel 환경변수 설정 체크리스트

실 배포 전 Vercel 대시보드 → Settings → Environment Variables 에서 확인:

```
# 추가 필요
SMTP_HOST=smtp.worksmobile.com
SMTP_PORT=587
SMTP_USER=gt.min@hwaseon.com
SMTP_PASS=4pZKZImiP1aD
NEXT_PUBLIC_MOCK_MODE=false

# 기존 유지
SUPABASE_URL=https://kepzsboxjulzygehmzpf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://kepzsboxjulzygehmzpf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_wCylt5aZMTj-3bOT5hEbRA_AKGzGPA7
ADMIN_PASSWORD=admin1234 (변경 권고)
NEXT_PUBLIC_BASE_URL=https://loan-agreement-service.vercel.app

# 추후 필요
TOSS_SECRET_KEY=... (토스페이먼츠 가맹점 등록 후)

# 제거
RESEND_API_KEY (더 이상 불필요)
```

---

## 8. 이메일 발송 시점 정리 (전체)

| 시점 | 수신자 | 함수 | 발송 조건 |
|------|--------|------|----------|
| OTP 요청 | 대여자 또는 차용자 | `sendOtpEmail` | `/api/otp/send` 호출 시 |
| 차용자 서명 요청 | 차용자 | `sendBorrowerSignRequest` | `request-borrower` API |
| 차용자 서명 완료 | 대여자 | `sendBorrowerSignedNotice` | `sign-borrower` API 성공 시 |
| 결제 완료 | 대여자 + 차용자 | `sendCompletionEmail` (×2) | `payment/confirm` API 성공 시 |
| 내용증명 발송 완료 | 대여자 | `sendCertMailTrackingEmail` | 관리자 `mark-sent` API |

---

다음 단계: developer 에이전트로 구현 진행
