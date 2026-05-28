# 자금조달계획서 AI 자동작성 기능 기획서

> 프로젝트: 내지마요 (loan-agreement-service)
> 작성일: 2026-05-28
> 작성자: 시니어 기획자/아키텍트
> 버전: 1.0

---

## 1. 기존 코드 분석 결과

### 1-1. 재활용 가능한 자산

| 자산 | 경로 | 재활용 방식 |
|---|---|---|
| 공용 UI 컴포넌트 | `components/ui/Button.tsx`, `Input.tsx`, `Card.tsx` | 그대로 import |
| Mock 모드 판별 | `lib/config.ts` → `isMockMode()` | 그대로 import |
| PDF 생성 인프라 | `lib/pdf-generator.ts` | `wrapLine()`, `loadFontBytes()` 유틸 함수 분리 또는 패턴 복사 |
| 한글 폰트 파일 | `assets/fonts/NotoSansKR-Regular.otf` | 기존 파일 그대로 사용. 추가 다운로드 불필요 |
| 전역 레이아웃 | `app/layout.tsx` | Pretendard 웹폰트, 배경색, footer 공유 |
| 브랜드 색상 체계 | `app/globals.css` + Tailwind brand-* 클래스 | 동일하게 사용 |
| ProgressBar | `components/ui/ProgressBar.tsx` | 3단계 진행 표시에 재활용 |
| LegalNotice | `components/ui/LegalNotice.tsx` | 법적 면책 문구 재활용 |

### 1-2. 신규 추가가 필요한 것

- Anthropic SDK (`@anthropic-ai/sdk`) — 아직 package.json에 없음. 신규 설치 필요
- `ANTHROPIC_API_KEY` 환경변수 — `.env.local`에 추가 필요
- 자금조달계획서 전용 타입 (`FundingPlan*`)
- 3단계 위자드 컴포넌트 4개
- API 라우트 2개 (`extract`, `pdf`)
- 공식 서식 기반 PDF 레이아웃 로직

### 1-3. 기존 패턴 채택 이유

- **pdf-lib + fontkit**: 이미 설치됨, `NotoSansKR-Regular.otf`도 있음 → 즉시 사용 가능
- **Mock 모드**: 기존 `isMockMode()` 패턴 그대로 적용 → 외부 API 키 없이 전체 플로우 테스트 가능
- **Next.js App Router + Server Actions 대신 API Route**: 기존 코드가 모두 `/api/` 라우트 패턴 사용 → 일관성 유지
- **클라이언트 상태**: 기존이 `localStorage` / `form-store.ts`(서버 메모리) 사용 → 자금조달계획서는 세션 단위 단기 데이터이므로 `sessionStorage` 활용

---

## 2. 기능 목록

### 2-1. 필수 기능

| # | 기능명 | 상세 |
|---|---|---|
| F-01 | 서식 선택 | 주택 / 토지 라디오 선택 |
| F-02 | 기본 정보 입력 | 성명, 주민등록번호(앞+뒤), 주소, 휴대전화, (주택)거래금액, (토지)소재지+면적+거래금액 최대 3필지 |
| F-03 | 자금 조달 스토리 입력 | 자연어 텍스트 입력 (최대 2,000자) |
| F-04 | AI 자동 추출 | Claude API 호출 → JSON 항목 추출. AI는 절대 수치를 만들지 않음 |
| F-05 | 추출 결과 검토 | 항목별 상태 표시 (확인됨/확인필요/미입력), AI 피드백 박스 |
| F-06 | 인라인 수정 | 각 항목 금액 직접 수정 가능 |
| F-07 | 합계 자동 검증 | 자기자금소계 + 차입금소계 vs 거래금액 차액 실시간 표시 |
| F-08 | PDF 다운로드 | A4 세로, 공식 서식 레이아웃, 한글 폰트 포함 |
| F-09 | Mock 모드 | `isMockMode()` true 시 하드코딩 샘플 결과 반환 |
| F-10 | 네비게이션 링크 | 홈(/) 헤더 및 LandingHero에 "자금조달계획서" 링크 추가 |

### 2-2. 선택 기능 (현재 범위 외, 향후 고려)

| # | 기능명 | 비고 |
|---|---|---|
| O-01 | 내용증명 연계 | 자금조달계획서 + 대여약정서 묶음 패키지 결제 |
| O-02 | 전자서명 삽입 | 작성자 서명 이미지 PDF 내 삽입 |
| O-03 | Supabase 저장 | 서식 사본 영구 보관 |
| O-04 | 이메일 발송 | 완성 PDF 이메일 전송 |

---

## 3. 기술 스택

| 항목 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js 14.2.35 (App Router) | 기존 프로젝트와 동일, 변경 없음 |
| Claude 호출 | `@anthropic-ai/sdk` (신규 설치) | 공식 SDK, SSE 스트리밍 지원, 서버사이드 전용 |
| Claude 모델 | `claude-sonnet-4-6` | 프로젝트 내 다른 AI 기능과 동일 버전 |
| PDF 생성 | `pdf-lib` + `@pdf-lib/fontkit` | 이미 설치됨, 한글 폰트 이미 있음 |
| 한글 폰트 | `assets/fonts/NotoSansKR-Regular.otf` | 기존 파일 재사용, 다운로드 불필요 |
| 상태 관리 | React `useState` + `sessionStorage` | 단기 세션 데이터, DB 저장 불필요 |
| 스타일링 | Tailwind CSS 3.4 | 기존과 동일 |
| 타입 | TypeScript 5.5 | 기존과 동일 |

### 설치 명령

```bash
npm install @anthropic-ai/sdk
```

### 환경변수 추가 (`.env.local`)

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 4. 데이터 구조 (타입 정의)

### 4-1. 추가 위치

파일: `lib/funding-types.ts` (신규 파일)

### 4-2. 전체 타입 정의

```typescript
// 자금조달계획서 서식 종류
export type FundingFormType = "housing" | "land";

// 항목별 상태 (AI 추출 결과 신뢰도)
export type FundingItemStatus = "confirmed" | "needs_check" | "missing";

// 주택 자금조달 항목 (금융위원회 공식 서식 기준)
export interface HousingFundingItems {
  // [자기자금]
  deposit: number | null;           // 금융기관 예금액
  stocks: number | null;            // 주식·채권 매각대금
  gift: number | null;              // 증여·상속
  giftTaxFiled: boolean | null;     // 증여세 신고 여부
  inheritance: number | null;       // 상속금액
  cash: number | null;              // 현금 등 기타
  realEstateSale: number | null;    // 부동산 처분대금

  // [차입금]
  mortgageLoan: number | null;          // 금융기관 대출액 (담보)
  creditLoan: number | null;            // 금융기관 대출액 (신용)
  businessLoan: number | null;          // 사업자 대출액
  rentalDeposit: number | null;         // 임대보증금
  companySupportOrPrivateLoan: number | null; // 회사지원금·사채
  otherLoan: number | null;             // 기타 차입금
  otherLoanRelation: string | null;     // 기타 차입금 관계

  // [거래 관련]
  transferAmount: number | null;    // 전매금액
  depositSuccession: number | null; // 보증금 승계
  cashPayment: number | null;       // 현금 직접 지불
  moveInPlan: string | null;        // 입주 예정 시기
}

// 토지 필지 정보
export interface LandParcel {
  location: string;    // 소재지
  area: string;        // 면적 (㎡ 또는 평)
  tradeAmount: number | null; // 거래금액
}

// 토지 자금조달 항목 (주택 항목 + 토지 전용)
export interface LandFundingItems extends HousingFundingItems {
  landParcels: LandParcel[];        // 토지 필지 (최대 3개)
  landCompensation: number | null;  // 토지보상금
  landUsePlan: string | null;       // 토지이용계획
}

// 기본 인적사항
export interface FundingPersonInfo {
  name: string;           // 성명
  idNumberFront: string;  // 주민등록번호 앞 6자리
  idNumberBack: string;   // 주민등록번호 뒤 7자리
  address: string;        // 주소
  phone: string;          // 휴대전화
}

// 주택: 거래금액
export interface HousingBaseInfo extends FundingPersonInfo {
  tradeAmount: number | null; // 거래금액
}

// 토지: 필지별 거래금액 (소계 자동 산출)
export interface LandBaseInfo extends FundingPersonInfo {
  landParcels: LandParcel[]; // 필지 목록
}

// Step 1 데이터 (서식 종류 + 기본 정보)
export type FundingStep1Data =
  | { formType: "housing"; baseInfo: HousingBaseInfo }
  | { formType: "land"; baseInfo: LandBaseInfo };

// AI 추출 결과 (항목 + 상태 + 피드백)
export interface FundingExtractResult {
  formType: FundingFormType;
  items: HousingFundingItems | LandFundingItems;
  itemStatus: Partial<Record<keyof HousingFundingItems | keyof LandFundingItems, FundingItemStatus>>;
  feedback: string[];   // AI 피드백 메시지 목록
  storyOriginal: string; // 원본 스토리 (수정 추적용)
}

// 위자드 전체 세션 데이터 (sessionStorage 저장)
export interface FundingWizardSession {
  step: 1 | 2 | 3;
  step1: FundingStep1Data | null;
  step2Story: string;
  step3Result: FundingExtractResult | null;
}

// API: /api/funding-plan/extract 요청 본문
export interface FundingExtractRequest {
  formType: FundingFormType;
  tradeAmount: number;   // 거래금액 (합계 검증용)
  story: string;
}

// API: /api/funding-plan/extract 응답
export interface FundingExtractResponse {
  ok: boolean;
  result?: FundingExtractResult;
  error?: string;
}

// API: /api/funding-plan/pdf 요청 본문
export interface FundingPdfRequest {
  formType: FundingFormType;
  step1: FundingStep1Data;
  result: FundingExtractResult;
}

// API: /api/funding-plan/pdf 응답
export interface FundingPdfResponse {
  ok: boolean;
  pdfBase64?: string;  // PDF를 base64로 반환
  error?: string;
}

// 항목 레이블 (UI 표시용)
export const HOUSING_ITEM_LABELS: Record<keyof HousingFundingItems, string> = {
  deposit: "금융기관 예금액",
  stocks: "주식·채권 매각대금",
  gift: "증여·상속",
  giftTaxFiled: "증여세 신고 여부",
  inheritance: "상속금액",
  cash: "현금 등 기타",
  realEstateSale: "부동산 처분대금",
  mortgageLoan: "금융기관 대출액(담보)",
  creditLoan: "금융기관 대출액(신용)",
  businessLoan: "사업자 대출액",
  rentalDeposit: "임대보증금",
  companySupportOrPrivateLoan: "회사지원금·사채",
  otherLoan: "기타 차입금",
  otherLoanRelation: "기타 차입금 관계",
  transferAmount: "전매금액",
  depositSuccession: "보증금 승계",
  cashPayment: "현금 직접 지불",
  moveInPlan: "입주 예정 시기",
};

// 자기자금 항목 키 목록
export const SELF_FUND_KEYS: (keyof HousingFundingItems)[] = [
  "deposit", "stocks", "gift", "inheritance", "cash", "realEstateSale",
];

// 차입금 항목 키 목록
export const LOAN_KEYS: (keyof HousingFundingItems)[] = [
  "mortgageLoan", "creditLoan", "businessLoan", "rentalDeposit",
  "companySupportOrPrivateLoan", "otherLoan",
];
```

---

## 5. 파일/폴더 구조

### 5-1. 신규 생성 파일

```
loan-agreement-service/
├── app/
│   ├── funding-plan/
│   │   └── page.tsx                   [신규] 메인 페이지 (3단계 위자드 호스트)
│   └── api/
│       └── funding-plan/
│           ├── extract/
│           │   └── route.ts           [신규] POST: 자연어 → 항목 추출
│           └── pdf/
│               └── route.ts           [신규] POST: PDF 생성
├── components/
│   └── funding/
│       ├── FundingWizard.tsx          [신규] 위자드 라우터 (step 1/2/3)
│       ├── FundingStep1Basic.tsx      [신규] Step1: 서식선택 + 기본정보
│       ├── FundingStep2Story.tsx      [신규] Step2: 스토리 입력 + AI 분석
│       └── FundingStep3Review.tsx     [신규] Step3: 검토 + 다운로드
└── lib/
    ├── funding-types.ts               [신규] 자금조달계획서 전용 타입 전체
    ├── funding-pdf.ts                 [신규] PDF 생성 로직 (주택/토지 서식)
    └── funding-prompts.ts             [신규] Claude API 프롬프트 템플릿
```

### 5-2. 수정이 필요한 기존 파일

```
├── app/layout.tsx                     [수정] 없음 (공통 footer 그대로 활용)
├── app/page.tsx                       [수정 없음] 네비 링크는 LandingHero에서 수정
├── components/LandingHero.tsx         [수정] "자금조달계획서" 버튼 추가
└── package.json                       [수정] @anthropic-ai/sdk 추가
```

---

## 6. UI 레이아웃 (와이어프레임)

### 6-1. 공통 레이아웃 (`/funding-plan`)

```
┌─────────────────────────────────────────────────┐
│  [헤더 없음 — app/layout.tsx 공통 footer만 있음]  │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  자금조달계획서 AI 자동작성                   │ │
│  │  ─────────────────────────────────────       │ │
│  │  ● Step 1: 기본 정보  ─── Step 2: 스토리 입력 ─── Step 3: 검토 │
│  │            [ProgressBar: 33% / 66% / 100%]    │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  [스텝 컴포넌트 영역]                              │
│                                                   │
│  ─────────────────────────────────────────────   │
│  ※ 본 서비스는 입력하신 내용만 서식에 기재합니다.  │
│     수치를 임의로 생성하지 않습니다.               │
└─────────────────────────────────────────────────┘
```

### 6-2. Step 1: 기본 정보 (`FundingStep1Basic`)

```
┌──────────────────────────────────────────────────────┐
│  서식 종류를 선택하세요                               │
│                                                        │
│  ○ 주택 취득자금 조달 및 입주 계획서                  │
│  ○ 토지 취득자금 조달 계획서                          │
│                                                        │
│  ── 인적사항 ──────────────────────────────────────── │
│  성명            [___________________]                 │
│  주민등록번호    [______] - [_______]                 │
│  주소            [___________________]                 │
│  휴대전화        [___________________]                 │
│                                                        │
│  ── [주택 선택 시] ──────────────────────────────────  │
│  거래금액        [___________________] 원              │
│                                                        │
│  ── [토지 선택 시] ──────────────────────────────────  │
│  필지 1 소재지   [___________________]                 │
│         면적     [___________________]                 │
│         거래금액 [___________________] 원              │
│  [+ 필지 추가] (최대 3필지)                           │
│                                                        │
│              [다음 단계 →]                            │
└──────────────────────────────────────────────────────┘
```

### 6-3. Step 2: 스토리 입력 (`FundingStep2Story`)

```
┌──────────────────────────────────────────────────────┐
│  자금 조달 상황을 편하게 설명해 주세요               │
│                                                        │
│  AI가 자동으로 항목을 분류합니다.                    │
│  금액과 출처를 최대한 구체적으로 적어주세요.         │
│                                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │ 예) 예금 5천만원 있고, 어머니한테 2억 빌렸어요. │  │
│  │     전세 보증금 5천도 있고                       │  │
│  │     현금 3천만원 있습니다                        │  │
│  │                                                  │  │
│  │                              (0/2000)            │  │
│  └────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ TIP. 이런 정보가 있으면 더 정확해요               │ │
│  │ • 금융기관 이름 (국민은행, 신한은행 등)           │ │
│  │ • 가족 관계 (어머니, 형제 등)                    │ │
│  │ • 증여/차용 구분                                 │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  [← 이전]              [AI 분석하기]                  │
│                                                        │
│  [로딩 시] 스피너 + "AI가 자금 항목을 분류하는 중..."  │
└──────────────────────────────────────────────────────┘
```

### 6-4. Step 3: 검토 및 다운로드 (`FundingStep3Review`)

```
┌──────────────────────────────────────────────────────┐
│  추출된 자금 항목을 확인하세요                       │
│                                                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │ ⚠️ AI 피드백                                      │ │
│  │ • "기타 차입금의 관계(가족/지인 등)를 알려주세요" │ │
│  │ • "증여 항목의 증여세 신고 여부가 불명확합니다"   │ │
│  └─────────────────────────────────────────────────┘ │
│                                                        │
│  [자기자금]                                           │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 항목             금액           상태             │ │
│  │ 금융기관 예금액  50,000,000원   ✅ 확인됨        │ │
│  │ 현금 등 기타     30,000,000원   ✅ 확인됨        │ │
│  │ 부동산 처분대금  -              ❌ 미입력         │ │
│  │ ...                                               │ │
│  │                소계: 80,000,000원                 │ │
│  └─────────────────────────────────────────────────┘ │
│                                                        │
│  [차입금]                                             │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 기타 차입금      200,000,000원  ⚠️ 확인필요      │ │
│  │   └ 관계: [____________] (직접 입력)             │ │
│  │ 임대보증금       50,000,000원   ✅ 확인됨        │ │
│  │                소계: 250,000,000원               │ │
│  └─────────────────────────────────────────────────┘ │
│                                                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 합계 검증                                         │ │
│  │ 자기자금 + 차입금 = 330,000,000원                │ │
│  │ 거래금액          = 330,000,000원                │ │
│  │ 차액              = 0원  ✅                       │ │
│  └─────────────────────────────────────────────────┘ │
│                                                        │
│  [← 스토리 수정]        [PDF 다운로드]                │
└──────────────────────────────────────────────────────┘
```

### 6-5. LandingHero 수정 (네비게이션 링크 추가)

```
[기존 버튼 2개]                         [추가]
┌─────────────────────────────────────────────────────┐
│  [지금 약정서 작성하기]  [서비스 알아보기]            │
│  [자금조달계획서 작성하기]  ← 이 버튼 추가           │
└─────────────────────────────────────────────────────┘
```

### 6-6. 사용자 플로우

```
/ (홈)
  └─ [자금조달계획서 작성하기] 클릭
      └─ /funding-plan (Step 1)
          └─ 서식 선택 + 기본정보 입력 → [다음]
              └─ /funding-plan (Step 2)
                  └─ 스토리 입력 → [AI 분석하기]
                      ├─ [Mock 모드] 즉시 샘플 결과 반환
                      └─ [실모드] POST /api/funding-plan/extract → 로딩
                          └─ /funding-plan (Step 3)
                              ├─ 항목 인라인 수정 가능
                              └─ [PDF 다운로드] 클릭
                                  └─ POST /api/funding-plan/pdf
                                      └─ 브라우저 파일 다운로드
```

---

## 7. API 엔드포인트 상세 스펙

### 7-1. POST `/api/funding-plan/extract`

**목적:** 자연어 스토리 → 자금 항목 JSON 추출

**요청 본문:**
```json
{
  "formType": "housing",
  "tradeAmount": 330000000,
  "story": "예금 5천만원 있고 어머니한테 2억 빌렸어요..."
}
```

**응답 (성공):**
```json
{
  "ok": true,
  "result": {
    "formType": "housing",
    "items": {
      "deposit": 50000000,
      "cash": 30000000,
      "otherLoan": 200000000,
      "otherLoanRelation": "어머니",
      "rentalDeposit": 50000000,
      ...나머지 null
    },
    "itemStatus": {
      "deposit": "confirmed",
      "cash": "confirmed",
      "otherLoan": "needs_check",
      "rentalDeposit": "confirmed"
    },
    "feedback": [
      "기타 차입금(어머니)의 상세 관계(가족 차용인지 증여인지)를 확인해주세요.",
      "증여 항목이 없습니다. 어머니로부터 받은 금액이 차용인 경우 대여약정서가 필요합니다."
    ],
    "storyOriginal": "예금 5천만원 있고..."
  }
}
```

**응답 (실패):**
```json
{
  "ok": false,
  "error": "Claude API 호출 실패: ..."
}
```

**Mock 모드 처리:**
- `isMockMode()` === true 이면 Claude API 호출 없이 하드코딩 샘플 결과 반환
- `lib/funding-prompts.ts`의 `MOCK_EXTRACT_RESULT` 상수 사용

**Claude API 호출 방식:**
```
모델: claude-sonnet-4-6
max_tokens: 2048
temperature: 0 (결정론적 추출)
응답 형식: JSON (function calling 또는 JSON mode)
```

**오류 시 HTTP 상태코드:**
- `400`: 요청 본문 누락/오류
- `500`: Claude API 호출 실패 또는 JSON 파싱 실패

---

### 7-2. POST `/api/funding-plan/pdf`

**목적:** 검토 완료된 항목 데이터 → A4 PDF 생성 → base64 반환

**요청 본문:**
```json
{
  "formType": "housing",
  "step1": {
    "formType": "housing",
    "baseInfo": {
      "name": "홍길동",
      "idNumberFront": "900101",
      "idNumberBack": "1234567",
      "address": "서울시 강남구 ...",
      "phone": "010-1234-5678",
      "tradeAmount": 330000000
    }
  },
  "result": { ...FundingExtractResult }
}
```

**응답 (성공):**
```json
{
  "ok": true,
  "pdfBase64": "JVBERi0xLjQK..."
}
```

**클라이언트 다운로드 처리:**
```javascript
// 응답 받은 후 즉시 Blob 다운로드 트리거
const blob = new Blob([Buffer.from(pdfBase64, 'base64')], { type: 'application/pdf' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `자금조달계획서_${name}_${today}.pdf`;
a.click();
```

**오류 시 HTTP 상태코드:**
- `400`: 요청 본문 누락/오류
- `500`: PDF 생성 실패 (폰트 로드 실패 포함)

---

## 8. Claude API 프롬프트 설계 (`lib/funding-prompts.ts`)

### 8-1. 시스템 프롬프트

```
당신은 주택 또는 토지 취득 자금조달계획서 작성을 보조하는 AI입니다.

[절대 원칙]
1. 사용자가 명확히 언급한 수치만 추출합니다.
2. 사용자가 언급하지 않은 항목은 반드시 null로 남깁니다.
3. 수치를 추정하거나 계산으로 유추하지 않습니다.
4. 불명확한 항목은 itemStatus를 "needs_check"로 표시하고 feedback에 안내합니다.
5. 항목이 전혀 언급되지 않은 경우 itemStatus에 넣지 않습니다.

[항목 분류 기준]
- "예금", "통장", "적금" → deposit (금융기관 예금액)
- "주식", "채권", "펀드 매도" → stocks
- "증여", "선물", "드림" → gift (증여세 신고 여부도 함께 확인)
- "상속" → inheritance
- "현금", "수중에 있는 돈" → cash
- "집 팔아서", "부동산 처분" → realEstateSale
- "대출", "담보대출", "주택담보" → mortgageLoan
- "신용대출", "마이너스 통장" → creditLoan
- "사업자 대출" → businessLoan
- "전세 보증금", "임대보증금" → rentalDeposit
- "사채", "회사 지원" → companySupportOrPrivateLoan
- "가족한테 빌림", "부모님한테", "형한테" → otherLoan (otherLoanRelation에 관계 기재)
- "전매 차익" → transferAmount
- "보증금 승계" → depositSuccession
- "잔금 현금", "직접 지불" → cashPayment

[출력 형식]
반드시 아래 JSON 구조만 출력하세요. 설명 텍스트 없이 JSON만 출력합니다.
```

### 8-2. 유저 프롬프트 템플릿

```
서식 종류: {formType === "housing" ? "주택" : "토지"}
거래금액: {tradeAmount.toLocaleString()}원

사용자 스토리:
---
{story}
---

위 스토리에서 자금 항목을 추출하여 JSON으로 반환하세요.
```

### 8-3. 기대 응답 JSON 구조

```json
{
  "items": {
    "deposit": 50000000,
    "stocks": null,
    "gift": null,
    "giftTaxFiled": null,
    "inheritance": null,
    "cash": 30000000,
    "realEstateSale": null,
    "mortgageLoan": null,
    "creditLoan": null,
    "businessLoan": null,
    "rentalDeposit": 50000000,
    "companySupportOrPrivateLoan": null,
    "otherLoan": 200000000,
    "otherLoanRelation": "어머니",
    "transferAmount": null,
    "depositSuccession": null,
    "cashPayment": null,
    "moveInPlan": null
  },
  "itemStatus": {
    "deposit": "confirmed",
    "cash": "confirmed",
    "rentalDeposit": "confirmed",
    "otherLoan": "needs_check"
  },
  "feedback": [
    "어머니로부터의 자금이 차용인지 증여인지 명확하지 않습니다. 차용이라면 대여약정서가 필요합니다.",
    "증여에 해당할 경우 증여세 신고 여부를 확인해주세요."
  ]
}
```

---

## 9. PDF 레이아웃 상세 (`lib/funding-pdf.ts`)

### 9-1. 기본 설정 (기존 pdf-generator.ts와 동일)

```
A4 크기: width=595.28pt, height=841.89pt
상하좌우 여백(margin): 50pt
폰트: assets/fonts/NotoSansKR-Regular.otf (기존 경로 그대로)
폰트 경로: path.join(process.cwd(), "assets", "fonts", "NotoSansKR-Regular.otf")
한글 폰트 로드 실패 시: Helvetica 폴백 (기존 패턴 그대로)
```

### 9-2. 주택 서식 레이아웃 (좌표 기준: 좌측하단 원점)

```
[페이지 1 — 주택 취득자금 조달 및 입주 계획서]

y=791: 제목 (fontSize=18, 가운데 정렬)
       "주택취득자금 조달 및 입주 계획서"

y=765: 부제목 (fontSize=10, color=slate)
       "(「부동산 거래신고 등에 관한 법률」제3조제4항에 따른 신고)"

y=745: 구분선 (선 두께 1pt)

[인적사항 섹션]
y=730: 소제목 "■ 인적사항" (fontSize=11, bold)
y=715: 라벨 "성명" x=50, 값 x=120 / 라벨 "주민등록번호" x=300, 값 x=400
y=700: 라벨 "주소" x=50, 값 x=120 (긴 텍스트는 wrapLine)
y=685: 라벨 "전화번호" x=50, 값 x=120
y=665: 라벨 "거래금액" x=50, 값 x=120, "(원)" x=250

[구분선]
y=650: 구분선

[자기자금 섹션]
y=635: 소제목 "■ 자기자금" (fontSize=11)
y=620: 표 헤더: "구분" x=50 | "금액(원)" x=300 | (fontSize=10, 배경없음)
       아래 항목 행 (각 행 간격 18pt):
y=605: 금융기관 예금액     | {deposit 값}
y=587: 주식·채권 매각대금  | {stocks 값}
y=569: 증여·상속           | {gift 값}  / (증여세신고: {giftTaxFiled})
y=551: 현금 등 기타        | {cash 값}
y=533: 부동산 처분대금     | {realEstateSale 값}
y=515: [소계]              | {자기자금 합계}

[구분선]
y=500: 구분선

[차입금 섹션]
y=485: 소제목 "■ 차입금"
y=470: 표 헤더
       아래 항목 행:
y=455: 금융기관 대출액(담보)  | {mortgageLoan}
y=437: 금융기관 대출액(신용)  | {creditLoan}
y=419: 사업자 대출액          | {businessLoan}
y=401: 임대보증금             | {rentalDeposit}
y=383: 회사지원금·사채        | {companySupportOrPrivateLoan}
y=365: 기타 차입금            | {otherLoan} / 관계: {otherLoanRelation}
y=347: [소계]                 | {차입금 합계}

[구분선]
y=332: 구분선

[기타 항목]
y=317: 소제목 "■ 거래 관련"
y=302: 전매금액              | {transferAmount}
y=284: 보증금 승계           | {depositSuccession}
y=266: 현금 직접 지불        | {cashPayment}
y=248: 입주 예정 시기        | {moveInPlan}

[구분선]
y=233: 구분선

[합계]
y=218: 소제목 "■ 합계"
y=203: 자기자금 소계         | {selfFundTotal}
y=185: 차입금 소계           | {loanTotal}
y=167: 합계                  | {total}
y=149: 거래금액              | {tradeAmount}
y=131: 차액 (미기재)         | {tradeAmount - total} (0이면 "일치" 표시)

[구분선]
y=116: 구분선

[서명란]
y=101: "위와 같이 자금조달계획서를 신고합니다."  (fontSize=10)
y=81:  "신고인 성명: _________________ (서명 또는 인)"  (fontSize=10)
y=61:  날짜 "____년 ____월 ____일"  (fontSize=10, 자동 입력)
y=41:  "○○○ 시장/군수/구청장 귀중"  (fontSize=10)
```

### 9-3. 토지 서식 레이아웃

주택 서식과 동일한 구조. 차이점만 기재:

```
[페이지 1]
y=791: 제목 "토지취득자금 조달계획서"
y=765: 부제목 "(「부동산 거래신고 등에 관한 법률」 제3조제4항)"

[토지 정보 섹션] — 주택의 "거래금액" 단일 행 대신 필지 표 삽입
y=720: 소제목 "■ 취득 토지 현황"
y=705: 표 헤더: "소재지" x=50 | "면적" x=250 | "거래금액(원)" x=380
       필지 1, 2, 3 행 (각 18pt 간격)
y=688: 필지 1
y=670: 필지 2 (없으면 "-")
y=652: 필지 3 (없으면 "-")
y=634: [합계]    |    |    {전체 거래금액}

[토지 전용 추가 항목] — 차입금 섹션 하단에 추가
y=?: 토지보상금  | {landCompensation}
y=?: 토지이용계획| {landUsePlan}
```

### 9-4. 금액 표시 규칙

```
null 또는 0인 항목: "-" 로 표시 (빈칸)
숫자인 항목: toLocaleString("ko-KR") → "50,000,000"
소계/합계: 항상 숫자 표시, 0이면 "0"
```

### 9-5. 항목 상태 시각 표시 (PDF에는 없음, UI에만)

PDF에는 상태 아이콘을 넣지 않는다. 최종 제출 서류이므로 불필요한 메타데이터를 제거한다.

---

## 10. 컴포넌트 상세 스펙

### 10-1. `app/funding-plan/page.tsx`

```typescript
// 서버 컴포넌트 (메타데이터 포함)
export const metadata = {
  title: "자금조달계획서 AI 자동작성 | 내지마요",
  description: "자금 조달 상황을 말로 설명하면 AI가 자동으로 서식을 채워드립니다.",
};

// 클라이언트 위자드 컴포넌트 렌더
export default function FundingPlanPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1>자금조달계획서 AI 자동작성</h1>
        <FundingWizard />
        <LegalNotice text="본 서비스는 입력하신 내용만 서식에 기재합니다." />
      </div>
    </main>
  );
}
```

### 10-2. `components/funding/FundingWizard.tsx`

```
"use client"
상태:
  - step: 1 | 2 | 3
  - step1Data: FundingStep1Data | null
  - step2Story: string
  - step3Result: FundingExtractResult | null

역할: step 번호에 따라 Step 컴포넌트 렌더 + sessionStorage 동기화

sessionStorage key: "funding_wizard_session"
저장 시점: 각 step 완료 후 (useEffect)
복원 시점: 컴포넌트 마운트 시 (step이 1이면 복원 안 함)
```

### 10-3. `components/funding/FundingStep1Basic.tsx`

```
"use client"
Props: { onNext: (data: FundingStep1Data) => void }

상태:
  - formType: "housing" | "land"
  - name, idFront, idBack, address, phone: string
  - tradeAmount: string (주택)
  - landParcels: LandParcel[] (토지, 초기 1개)

유효성 검사:
  - name: 필수, 2자 이상
  - idFront: 필수, 6자리 숫자
  - idBack: 필수, 7자리 숫자
  - address: 필수
  - phone: 필수, 010-XXXX-XXXX 패턴
  - tradeAmount (주택): 필수, 양수
  - landParcels (토지): 최소 1개, 각 소재지 + 거래금액 필수

[+ 필지 추가] 버튼: landParcels.length < 3 일 때만 노출
[필지 삭제] 버튼: landParcels.length > 1 일 때만 노출

주민등록번호 뒤 7자리 입력 필드: type="password" (화면 노출 방지)
```

### 10-4. `components/funding/FundingStep2Story.tsx`

```
"use client"
Props:
  { step1Data: FundingStep1Data;
    onNext: (result: FundingExtractResult) => void;
    onBack: () => void }

상태:
  - story: string (최대 2000자)
  - isLoading: boolean
  - error: string | null

[AI 분석하기] 클릭 시 동작:
  1. story 빈 값 검사 (최소 10자)
  2. isLoading = true
  3. POST /api/funding-plan/extract 호출
     - body: { formType, tradeAmount, story }
  4. 응답 ok → onNext(result) 호출
  5. 응답 오류 → error 표시
  6. finally: isLoading = false

로딩 중 버튼 비활성화 + 텍스트: "AI가 분석하는 중..."
```

### 10-5. `components/funding/FundingStep3Review.tsx`

```
"use client"
Props:
  { step1Data: FundingStep1Data;
    result: FundingExtractResult;
    onBack: () => void }

상태:
  - editableItems: HousingFundingItems | LandFundingItems  (result.items 복사본, 수정 가능)
  - isDownloading: boolean
  - downloadError: string | null

항목 표 렌더링:
  - SELF_FUND_KEYS 순서로 자기자금 행 렌더
  - LOAN_KEYS 순서로 차입금 행 렌더
  - 각 행: 항목명 | 금액 입력 필드 | 상태 아이콘
  - 금액 필드: type="number", null이면 빈 값
  - otherLoanRelation: 기타 차입금 옆 별도 텍스트 입력 필드

합계 계산:
  - selfTotal = SELF_FUND_KEYS 합산 (null 제외)
  - loanTotal = LOAN_KEYS 합산 (null 제외)
  - total = selfTotal + loanTotal
  - tradeAmount = step1Data.baseInfo.tradeAmount (또는 토지 합계)
  - diff = tradeAmount - total
  - diff === 0: 초록색 "일치"
  - diff > 0: 빨간색 "+{차액} 원 부족"
  - diff < 0: 주황색 "{차액} 원 초과"

[PDF 다운로드] 클릭 시 동작:
  1. isDownloading = true
  2. POST /api/funding-plan/pdf 호출
     - body: { formType, step1, result: { ...result, items: editableItems } }
  3. 응답 ok → pdfBase64 → Blob → 파일 다운로드
     - 파일명: "자금조달계획서_{name}_{YYYY-MM-DD}.pdf"
  4. 오류 → downloadError 표시
  5. finally: isDownloading = false
```

---

## 11. Mock 데이터 구조 (`lib/funding-prompts.ts`)

```typescript
// Mock 추출 결과 (housing 기준)
export const MOCK_EXTRACT_RESULT_HOUSING: FundingExtractResult = {
  formType: "housing",
  items: {
    deposit: 50000000,
    stocks: null,
    gift: null,
    giftTaxFiled: null,
    inheritance: null,
    cash: 30000000,
    realEstateSale: null,
    mortgageLoan: null,
    creditLoan: null,
    businessLoan: null,
    rentalDeposit: 50000000,
    companySupportOrPrivateLoan: null,
    otherLoan: 200000000,
    otherLoanRelation: "어머니",
    transferAmount: null,
    depositSuccession: null,
    cashPayment: null,
    moveInPlan: "2026년 8월",
  },
  itemStatus: {
    deposit: "confirmed",
    cash: "confirmed",
    rentalDeposit: "confirmed",
    otherLoan: "needs_check",
  },
  feedback: [
    "어머니로부터 빌린 자금이 차용인 경우 대여약정서 작성을 권장합니다.",
    "기타 차입금의 상환 조건(이자율, 상환기일)을 확인해주세요.",
  ],
  storyOriginal: "예금 5천만원 있고, 어머니한테 2억 빌렸어요. 전세 보증금 5천도 있고 현금 3천만원 있습니다.",
};

// Mock 추출 결과 (land 기준)
export const MOCK_EXTRACT_RESULT_LAND: FundingExtractResult = {
  formType: "land",
  items: {
    ...MOCK_EXTRACT_RESULT_HOUSING.items,
    landParcels: [
      { location: "경기도 성남시 분당구 백현동 123", area: "200㎡", tradeAmount: 180000000 },
      { location: "경기도 성남시 분당구 백현동 124", area: "150㎡", tradeAmount: 150000000 },
    ],
    landCompensation: null,
    landUsePlan: "주거지역",
  } as LandFundingItems,
  itemStatus: MOCK_EXTRACT_RESULT_HOUSING.itemStatus,
  feedback: MOCK_EXTRACT_RESULT_HOUSING.feedback,
  storyOriginal: MOCK_EXTRACT_RESULT_HOUSING.storyOriginal,
};
```

---

## 12. 예상 에러 시나리오 및 처리 방법

| # | 에러 상황 | 발생 위치 | 처리 방법 |
|---|---|---|---|
| E-01 | ANTHROPIC_API_KEY 미설정 | `/api/funding-plan/extract` | 500 반환 + "서버 설정 오류입니다. 관리자에게 문의하세요." |
| E-02 | Claude API 타임아웃 (30초) | `/api/funding-plan/extract` | 504 반환 + "AI 분석 시간이 초과됐습니다. 다시 시도해주세요." |
| E-03 | Claude 응답이 유효한 JSON 아님 | `/api/funding-plan/extract` | JSON.parse 실패 → retry 1회 후 500 반환. 클라이언트: "AI 응답 오류. 스토리를 더 구체적으로 입력해주세요." |
| E-04 | 스토리 10자 미만 입력 | Step 2 클라이언트 | API 호출 전 차단 + "최소 10자 이상 입력해주세요." |
| E-05 | 스토리 2000자 초과 | Step 2 클라이언트 | textarea maxLength=2000, 실시간 카운터로 제한 |
| E-06 | 한글 폰트 로드 실패 | `lib/funding-pdf.ts` | Helvetica 폴백 (기존 pdf-generator.ts 동일 패턴). PDF는 생성되나 한글 깨질 수 있음 → 콘솔 경고 출력 |
| E-07 | PDF 생성 중 메모리 오류 | `/api/funding-plan/pdf` | 500 반환 + "PDF 생성에 실패했습니다. 잠시 후 다시 시도해주세요." |
| E-08 | 주민등록번호 입력 오류 | Step 1 클라이언트 | 앞자리 6자리/뒷자리 7자리 즉시 유효성 검사, 빨간 에러 문구 |
| E-09 | 합계가 거래금액과 불일치 | Step 3 클라이언트 | PDF 다운로드 비활성화하지 않음 (사용자 선택). 경고 배너만 표시 |
| E-10 | sessionStorage 복원 실패 | FundingWizard 마운트 | try/catch → step=1로 초기화. 조용히 처리 |
| E-11 | 요청 본문 누락 | API 공통 | zod 없이 직접 검사: `if (!body.story) return 400` |
| E-12 | Claude가 존재하지 않는 항목 키 반환 | extract API | 알려진 키 목록 whitelist 필터링 후 사용. 모르는 키는 무시 |

---

## 13. 한글 폰트 처리 방안

### 현재 상황
- `assets/fonts/NotoSansKR-Regular.otf` 파일이 이미 존재함
- `lib/pdf-generator.ts`에서 동일 경로를 사용 중이며 정상 동작 확인됨

### `lib/funding-pdf.ts`에서의 폰트 로드

```typescript
// 기존 pdf-generator.ts의 FONT_PATH와 동일하게 사용
const FONT_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSansKR-Regular.otf");
```

### 폴백 전략 (기존 동일)

1. 파일 로드 시도
2. 실패 시 `console.error` 출력
3. Helvetica 스탠다드 폰트로 폴백 → 영문/숫자는 정상, 한글은 깨질 수 있음
4. PDF 자체는 정상 생성 (빌드/배포 실패 없음)

### Vercel 배포 시 주의

Vercel은 기본적으로 `public/` 외 폴더의 바이너리 접근이 가능하지만, Edge Runtime에서는 `fs` 사용 불가. 해당 API 라우트는 반드시 Node.js Runtime 사용:

```typescript
// app/api/funding-plan/pdf/route.ts 최상단에 필수 추가
export const runtime = "nodejs";
```

---

## 14. 구현 순서 (개발 가이드)

```
Phase 1: 타입 및 유틸 기반 (의존성 없음)
  1. package.json에 @anthropic-ai/sdk 추가, npm install
  2. .env.local에 ANTHROPIC_API_KEY 추가
  3. lib/funding-types.ts 작성
  4. lib/funding-prompts.ts 작성 (프롬프트 + Mock 데이터)

Phase 2: API 라우트 (서버 로직)
  5. app/api/funding-plan/extract/route.ts
     - Mock 모드: MOCK_EXTRACT_RESULT 반환
     - 실 모드: Anthropic SDK 호출 → JSON 파싱 → 반환
  6. lib/funding-pdf.ts
     - NotoSansKR 로드 (pdf-generator.ts 패턴 복사)
     - 주택 서식 레이아웃 함수 구현
     - 토지 서식 레이아웃 함수 구현
  7. app/api/funding-plan/pdf/route.ts
     - export const runtime = "nodejs"
     - funding-pdf.ts 호출 → base64 반환

Phase 3: UI 컴포넌트
  8. components/funding/FundingWizard.tsx (상태 관리, sessionStorage)
  9. components/funding/FundingStep1Basic.tsx (서식 선택 + 기본정보)
  10. components/funding/FundingStep2Story.tsx (스토리 입력 + API 호출)
  11. components/funding/FundingStep3Review.tsx (검토 + 다운로드)

Phase 4: 페이지 및 네비게이션 연결
  12. app/funding-plan/page.tsx (서버 컴포넌트 + FundingWizard 렌더)
  13. components/LandingHero.tsx 수정 (자금조달계획서 링크 추가)

Phase 5: 검증
  14. Mock 모드로 전체 플로우 End-to-End 테스트
  15. PDF 다운로드 및 한글 렌더링 확인
  16. 합계 검증 로직 확인 (일치/불일치 케이스)
  17. 실 모드 테스트 (ANTHROPIC_API_KEY 설정 후)
```

---

## 15. 보안 체크리스트

| 항목 | 처리 방법 |
|---|---|
| ANTHROPIC_API_KEY | 서버 사이드 API 라우트에서만 사용. 클라이언트 코드에 절대 노출 금지 |
| 주민등록번호 | 서버에 저장하지 않음. API 라우트에서 PDF 생성 후 즉시 반환, 메모리에도 캐시하지 않음 |
| PDF base64 | 응답 후 클라이언트 다운로드 즉시 처리, Blob URL 즉시 revoke (`URL.revokeObjectURL`) |
| 스토리 텍스트 | 서버 저장 없음. API 처리 후 메모리에서 소멸 |
| sessionStorage | 브라우저 탭 단위 격리. 민감 정보(주민번호 뒷자리)는 sessionStorage에 저장하지 않음 |

---

다음 단계: developer 에이전트로 구현 진행
