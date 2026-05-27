# 대여약정서 자동화 서비스 — 개발 계획서

> 작성일: 2026-05-27 | 기반: 법률검토_및_BM기획.md + 기술스택_및_비용분석.md

---

## 1. 프로젝트 개요

**서비스명:** 가족대여닷컴 (개발 코드명: loan-agreement-service)

**핵심 가치:**
- 가족 간 금전 거래 시 국세청 조사 대비 완벽한 법적 증거 세트 제공
- 약 3만원으로 전자서명 + 우체국 내용증명 풀패키지

**서비스 요금:** 30,000원/건

**서비스 프로세스:**
```
① 금액 입력 + 무이자 한도 확인
       ↓
② 당사자 정보 입력 (대여자 A, 차용자 B)
       ↓
③ 약정서 미리보기
       ↓
④ 대여자(A) → 이메일 OTP + 서명
       ↓
⑤ 차용자(B)에게 서명 요청 링크 발송
       ↓
⑥ 차용자(B) → 이메일 OTP + 서명
       ↓
⑦ 결제 (30,000원)
       ↓
⑧ PDF 생성 + 내용증명 신청 접수 완료
       ↓
⑨ 어드민이 우체국 내용증명 발송 (영업일 2~3일)
```

---

## 2. 기술 스택

| 분류 | 기술 |
|---|---|
| 프레임워크 | Next.js 14 (App Router) + TypeScript |
| 스타일 | Tailwind CSS 4 |
| DB | Supabase (PostgreSQL) |
| 파일 저장 | Supabase Storage |
| PDF 생성 | pdf-lib |
| 서명 캔버스 | react-signature-canvas |
| 이메일 | Resend |
| 결제 | 토스페이먼츠 (Mock 지원) |
| 배포 | Vercel |

---

## 3. 폴더 구조

```
loan-agreement-service/
├── app/
│   ├── page.tsx                    # 랜딩 페이지
│   ├── create/
│   │   ├── page.tsx               # 약정서 작성 시작
│   │   └── [step]/page.tsx        # Step 1~6
│   ├── sign/
│   │   └── [token]/page.tsx       # 차용자 서명 페이지
│   ├── complete/
│   │   └── [id]/page.tsx          # 완료 페이지
│   ├── admin/
│   │   ├── page.tsx               # 관리자 로그인
│   │   └── dashboard/page.tsx     # 관리자 대시보드
│   └── api/
│       ├── agreements/
│       │   ├── create/route.ts
│       │   ├── [id]/
│       │   │   ├── sign-lender/route.ts
│       │   │   ├── request-borrower/route.ts
│       │   │   ├── sign-borrower/route.ts
│       │   │   └── pdf/route.ts
│       ├── otp/
│       │   ├── send/route.ts
│       │   └── verify/route.ts
│       ├── payment/
│       │   └── confirm/route.ts
│       └── admin/
│           ├── orders/route.ts
│           ├── orders/[id]/status/route.ts
│           └── orders/csv/route.ts
├── components/
│   ├── ui/                        # 공용 UI 컴포넌트
│   ├── LandingHero.tsx
│   ├── ProcessSteps.tsx
│   ├── PriceCard.tsx
│   ├── StepForm.tsx
│   ├── SignatureCanvas.tsx
│   ├── AgreementPreview.tsx
│   ├── OtpInput.tsx
│   └── AdminTable.tsx
├── lib/
│   ├── supabase.ts               # Supabase 클라이언트
│   ├── pdf-generator.ts          # PDF 생성 로직
│   ├── email.ts                  # Resend 이메일 발송
│   ├── otp.ts                    # OTP 생성/검증
│   ├── interest-calc.ts          # 이자 계산기
│   └── types.ts                  # TypeScript 타입 정의
├── .env.local                    # 환경변수 (gitignore)
└── .env.local.example            # 환경변수 예시
```

---

## 4. 주요 페이지 상세 설계

### 4-1. 랜딩 페이지 (/)

**섹션 구성:**

1. **Hero 섹션**
   - 헤드라인: "가족 간 금전 거래, 이제 법적으로 완벽하게"
   - 서브: "약정서 + 전자서명 + 우체국 내용증명 — 단 30,000원"
   - CTA 버튼: "지금 약정서 작성하기"
   - ⚠️ "절세", "증여세" 직접 문구 사용 금지

2. **문제 제기 섹션**
   - "가족 사이라 그냥 빌려줬다가 나중에..." (세무조사 시나리오)
   - 국세청이 요구하는 증거 3가지 설명

3. **서비스 프로세스 (5단계)**
   - 아이콘 + 단계별 설명
   - "전자서명 → 우체국 내용증명 → 법적효력 완성"

4. **가격 카드**
   - 기본 패키지: 30,000원 (약정서 + 전자서명 + 내용증명 2부 발송)
   - 이자 관리 구독: 월 9,900원 (옵션)

5. **법적 효력 안내**
   - 전자서명법 제3조 + 우체국 내용증명 법적 의미
   - "세무사가 감수한 양식" (파트너 확보 후 추가)

6. **FAQ 섹션**
   - 자주 묻는 질문 10개

7. **Footer**
   - 이용약관 / 개인정보처리방침
   - "본 서비스는 법률 서비스가 아닙니다" 면책 문구

---

### 4-2. 약정서 작성 (/create)

**Step 1: 금액 및 조건 설정**
```
- 대여 금액 입력 (원 단위, 최소 10만원)
- 무이자 한도 표시:
  · 무이자 한도: 2억 1,739만원 (상증세법 제41조의4, 연 4.6% 기준)
  · 한도 초과 시 → 이자율 자동 표시 (연 4.6%)
  · 월 이자금액 자동 계산
- 대여 시작일 (날짜 선택)
- 만기일 (최대 5년, 날짜 선택)
- 이자 납부일 (매월 몇 일, 무이자 시 비활성)
- 상환 방법 (만기일 일시상환 / 분할상환)
```

**Step 2: 당사자 정보**
```
대여자 (A) — 돈 빌려주는 사람
- 성명 (필수)
- 생년월일 6자리 (필수, 주민번호 수집 금지)
- 휴대폰 번호 (필수)
- 이메일 (필수, OTP 발송용)
- 주소 (필수)

차용자 (B) — 돈 빌리는 사람
- 성명 (필수)
- 생년월일 6자리 (필수)
- 휴대폰 번호 (필수)
- 이메일 (필수, 서명 요청 링크 발송)
- 주소 (필수)

가족 관계 선택
- 부모 → 자녀 / 자녀 → 부모 / 형제자매 / 배우자 / 기타
```

**Step 3: 약정서 미리보기**
```
- 입력값으로 생성된 약정서 전문 표시
- 주요 조항:
  · 대여 금액 및 이자율(또는 무이자)
  · 대여 기간 (시작일 ~ 만기일)
  · 이자 납부 방법 (매월 O일, 계좌이체)
  · 원금 상환 방법
  · 기한이익 상실 조항
- "이 내용으로 약정서를 작성합니다" 체크박스
```

**Step 4: 대여자 서명**
```
- 이메일 OTP 발송 (6자리, 10분 유효)
- OTP 입력
- 서명 캔버스 (손글씨 서명)
- "서명 완료" 버튼
- 감사로그 저장:
  · 서명 시각 (ISO 8601)
  · IP 주소
  · User-Agent
  · OTP 인증 여부 = true
  · 문서 해시 (SHA-256)
```

**Step 5: 차용자 서명 요청**
```
- B의 이메일로 서명 요청 링크 발송
- 링크: https://도메인/sign/{unique_token}
- 유효기간: 7일
- 화면: "OOO님께 서명 요청을 보냈습니다"
- 대기 화면 (서명 완료 시 자동으로 다음 단계)
- "링크 다시 보내기" 버튼
```

**Step 6: 결제**
```
- 결제 요약: 대여약정서 작성 + 내용증명 발송 서비스 30,000원
- 결제 수단: 카드/계좌이체 (토스페이먼츠)
- 결제 완료 → /complete/[id] 이동
- 이메일 발송: A, B 각각 확인 이메일 + PDF 다운로드 링크
```

---

### 4-3. 차용자 서명 페이지 (/sign/[token])

```
- 토큰 유효성 검증 (만료/이미 사용됨 처리)
- 약정서 내용 전문 표시
- "위 내용을 확인하였습니다" 체크박스
- 이메일 OTP 발송 → 입력
- 서명 캔버스
- "서명 완료" 버튼
- 완료 시: 대여자에게 알림 이메일 발송
```

---

### 4-4. 완료 페이지 (/complete/[id])

```
- 완료 안내: "서명이 완료되었습니다 ✓"
- 처리 예정: "영업일 2~3일 내 내용증명 발송 예정"
- 서명된 PDF 다운로드 버튼
- 이메일 확인 안내 (A, B 각각 발송됨)
- 확정일자 안내 섹션:
  · "추가 법적 효력: 확정일자"
  · "인터넷등기소(iros.go.kr)에서 직접 신청 가능 (500원)"
  · 단계별 안내 이미지
- 이자 리마인더 구독 CTA (BM1):
  · "매월 이자 납부일에 알림 받기"
  · 월 9,900원
```

---

### 4-5. 관리자 페이지 (/admin)

**로그인:**
```
- 환경변수 ADMIN_PASSWORD로 단순 인증
- 세션 쿠키 (httpOnly)
```

**대시보드:**
```
상단 통계 카드:
- 전체 주문 수
- 서명 대기 건
- 내용증명 발송 대기 건
- 이번달 매출

주문 목록 테이블:
- 접수일 | 대여자명 | 차용자명 | 금액 | 서명상태 | 결제상태 | 발송상태
- 필터: 상태별 / 날짜 범위
- 각 건 클릭 → 상세 (서명된 PDF 다운로드 + 당사자 연락처)

내용증명 발송 대기 탭:
- 발송 대기 목록
- CSV 다운로드 (인터넷 우체국 메일머지용)
  · 포함 항목: 발신인 이름/주소, 수신인 이름/주소, 내용증명 본문
- "발송 완료" 마킹 버튼 (일괄 처리)
```

---

## 5. DB 스키마 (Supabase)

### agreements 테이블
```sql
CREATE TABLE agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft',
  -- draft | lender_signed | borrower_signed | paid | processing | completed | cancelled
  
  -- 금융 정보
  amount BIGINT NOT NULL,              -- 대여 금액 (원)
  interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0, -- 연 이자율 (0이면 무이자)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  repayment_method TEXT NOT NULL,      -- 'lump_sum' | 'installment'
  interest_day INTEGER,               -- 매월 이자 납부일 (1~28)
  
  -- 대여자 정보
  lender_name TEXT NOT NULL,
  lender_birth TEXT NOT NULL,         -- 생년월일 6자리 (YYMMDD)
  lender_phone TEXT NOT NULL,
  lender_email TEXT NOT NULL,
  lender_address TEXT NOT NULL,
  
  -- 차용자 정보
  borrower_name TEXT NOT NULL,
  borrower_birth TEXT NOT NULL,
  borrower_phone TEXT NOT NULL,
  borrower_email TEXT NOT NULL,
  borrower_address TEXT NOT NULL,
  
  -- 관계
  family_relation TEXT NOT NULL,
  
  -- 서명 토큰
  lender_sign_token UUID DEFAULT gen_random_uuid(),
  borrower_sign_token UUID DEFAULT gen_random_uuid(),
  borrower_token_expires_at TIMESTAMPTZ,
  
  -- 문서
  pdf_url TEXT,
  document_hash TEXT,                 -- SHA-256
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### signatures 테이블 (감사로그)
```sql
CREATE TABLE signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES agreements(id),
  signer_type TEXT NOT NULL,          -- 'lender' | 'borrower'
  signer_name TEXT NOT NULL,
  signer_phone_masked TEXT NOT NULL,  -- 010-****-1234
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
  signature_image_url TEXT,
  document_hash TEXT NOT NULL         -- 서명 시점 문서 해시
);
```

### orders 테이블
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES agreements(id),
  amount INTEGER NOT NULL DEFAULT 30000,
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending | paid | failed | refunded
  payment_key TEXT,                   -- 토스페이먼츠 결제키
  paid_at TIMESTAMPTZ,
  cert_mail_status TEXT DEFAULT 'pending',
  -- pending | processing | sent
  cert_mail_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### otp_codes 테이블
```sql
CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES agreements(id),
  signer_type TEXT NOT NULL,          -- 'lender' | 'borrower'
  email TEXT NOT NULL,
  code TEXT NOT NULL,                 -- 6자리 숫자
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. API 라우트 명세

### POST /api/agreements/create
```typescript
// Request
{
  amount: number,
  interestRate: number,
  startDate: string,
  endDate: string,
  repaymentMethod: 'lump_sum' | 'installment',
  interestDay?: number,
  lender: { name, birth, phone, email, address },
  borrower: { name, birth, phone, email, address },
  familyRelation: string
}
// Response
{ agreementId: string }
```

### POST /api/otp/send
```typescript
// Request
{ agreementId: string, signerType: 'lender' | 'borrower' }
// Response
{ success: boolean, expiresAt: string }
```

### POST /api/otp/verify
```typescript
// Request
{ agreementId: string, signerType: 'lender' | 'borrower', code: string }
// Response
{ valid: boolean }
```

### POST /api/agreements/[id]/sign-lender
```typescript
// Request
{ signatureImageBase64: string, ipAddress: string, userAgent: string }
// Response
{ success: boolean }
```

### POST /api/agreements/[id]/request-borrower
```typescript
// 차용자에게 서명 요청 이메일 발송
// Response
{ success: boolean, token: string }
```

### POST /api/agreements/[id]/sign-borrower
```typescript
// Request (토큰 기반 인증)
{ token: string, signatureImageBase64: string, ipAddress: string, userAgent: string }
// Response
{ success: boolean }
```

### POST /api/payment/confirm
```typescript
// 토스페이먼츠 결제 완료 처리
// Request
{ paymentKey: string, orderId: string, amount: number }
// Response
{ success: boolean, pdfUrl: string }
```

### GET /api/admin/orders
```typescript
// Query: status, page, limit
// Response
{ orders: Order[], total: number }
```

### GET /api/admin/orders/csv
```typescript
// 내용증명 발송 대기 목록 CSV 다운로드
// 포맷: 발신인정보, 수신인정보, 내용증명본문
```

---

## 7. 핵심 로직

### 7-1. 이자 계산기 (lib/interest-calc.ts)
```typescript
const 적정이자율 = 0.046; // 연 4.6% (상증세법 제41조의4)
const 무이자한도 = 217390000; // 2억 1,739만원 (= 1,000만원 / 0.046)

function calcMonthlyInterest(amount: number, annualRate: number): number {
  return Math.round(amount * annualRate / 12);
}

function isInterestFree(amount: number): boolean {
  return amount <= 무이자한도;
}
```

### 7-2. PDF 생성 (lib/pdf-generator.ts)
- pdf-lib 사용
- 약정서 양식 텍스트 치환
- 서명 이미지 삽입
- 감사로그 페이지 자동 추가
- SHA-256 해시 생성

### 7-3. OTP (lib/otp.ts)
- 6자리 숫자 코드
- 유효시간: 10분
- Supabase otp_codes 테이블 저장
- Resend 이메일 발송

### 7-4. 감사로그 저장
```typescript
// 서명 완료 시 저장
{
  agreement_id,
  signer_type: 'lender' | 'borrower',
  signer_name,
  signer_phone_masked: '010-****-1234',
  signed_at: new Date().toISOString(),
  ip_address: req.headers['x-forwarded-for'],
  user_agent: req.headers['user-agent'],
  otp_verified: true,
  signature_image_url,
  document_hash: sha256(pdfBuffer)
}
```

---

## 8. 법적 주의사항 (코드에 반드시 반영)

| 항목 | 적용 |
|---|---|
| 주민번호 수집 금지 | 생년월일(6자리) 입력 필드, 주민번호 입력 불가 |
| "절세"/"증여세" 문구 금지 | 모든 페이지 텍스트에서 제거 (세무사 파트너 전까지) |
| 도장 날인 금지 | 전자서명 캔버스만 사용 |
| 확정일자 대행 불가 | 안내 텍스트만 (링크: iros.go.kr) |
| 결제 명목 | "대여약정서 작성 및 내용증명 발송 서비스" |
| 이용약관 면책문구 | "본 서비스는 법률 서비스가 아닙니다" |
| 감사로그 필수 | 모든 서명에 IP+기기+OTP+해시 저장 |

---

## 9. 환경변수 (.env.local)

```env
# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Resend (이메일 발송)
RESEND_API_KEY=

# 토스페이먼츠
NEXT_PUBLIC_TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=

# 관리자
ADMIN_PASSWORD=

# Mock 모드 (외부 API 없이 개발 시)
NEXT_PUBLIC_MOCK_MODE=true
```

---

## 10. Mock 모드 지원

`NEXT_PUBLIC_MOCK_MODE=true` 설정 시:
- OTP: 콘솔에 출력, 이메일 미발송
- 결제: 자동 성공 처리 (실제 카드 정보 불필요)
- Supabase: 없어도 메모리 내 임시 저장 (새로고침 시 초기화)
- PDF: 생성하되 Storage 업로드 건너뜀

→ 외부 API 키 없이도 전체 플로우 데모 가능

---

## 11. 약정서 표준 양식

```
대 여 약 정 서

대여자(갑) : {lender_name} (생년월일 : {lender_birth})
             주소 : {lender_address}

차용자(을) : {borrower_name} (생년월일 : {borrower_birth})
             주소 : {borrower_address}

위 당사자 간에 다음과 같이 금전 대여 약정을 체결합니다.

제1조 (대여 금액)
"갑"은 "을"에게 금 {amount_korean}원({amount_number}원)을 대여한다.

제2조 (대여 기간)
대여 기간은 {start_date}부터 {end_date}까지로 한다.

제3조 (이자)
{interest_clause}
[무이자 시]: 본 대여금에 대한 이자는 없는 것으로 한다.
[이자 있을 시]: 이자율은 연 {interest_rate}%로 하며, "을"은 매월 {interest_day}일에 {monthly_interest}원을 "갑"의 지정 계좌로 이체한다.

제4조 (상환 방법)
"을"은 만기일({end_date})에 원금 전액을 "갑"에게 상환한다.
[분할상환 시]: 매월 {installment_amount}원을 {interest_day}일에 상환한다.

제5조 (기한이익 상실)
"을"이 이자 또는 원금을 2회 이상 연속하여 지급하지 아니하거나 기타 본 약정을 위반한 경우,
"갑"은 즉시 원금 전액의 반환을 청구할 수 있다.

제6조 (기타)
본 약정에 명시되지 않은 사항은 민법 및 관련 법령에 따른다.

{agreement_date}

대여자(갑): ________________ (서명)
차용자(을): ________________ (서명)
```

---

## 12. 빌드 및 실행

```bash
# 설치
npm install

# 개발 서버 (Mock 모드)
npm run dev

# 프로덕션 빌드
npm run build
npm run start
```

---

## 13. 배포 체크리스트

- [ ] Supabase 프로젝트 생성 + 스키마 적용
- [ ] Resend API 키 발급
- [ ] 토스페이먼츠 가맹점 등록
- [ ] Vercel 배포
- [ ] 환경변수 설정
- [ ] 도메인 연결
- [ ] 이용약관 / 개인정보처리방침 페이지 작성
- [ ] ADMIN_PASSWORD 설정
