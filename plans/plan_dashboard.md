# 관리자 대시보드 개선 기획서

프로젝트: / 내지마요 (loan-agreement-service)
작성일: 2026-05-28
버전: 1.0

---

## 1. 배경 및 목적

### 현재 상태 분석

기존 `/admin/dashboard` 는 `AdminTable` 컴포넌트 하나로 구성되어 있다.
현재 테이블은 주문(Orders) 기준으로 조회하고 있으며, 다음과 같은 한계가 있다:

- 통계 카드가 주문 단위 집계여서 약정서 단위 현황 파악이 불가능
- 필터가 내용증명/결제 상태 중심 (약정서 서명 단계 필터 없음)
- 상세 보기가 accordion 방식으로 제한적 — 서명 이미지, 전체 약정서 내용, 감사추적 PDF 다운로드 없음
- Mock 모드에서 초기 데이터 0건이라 대시보드 기능 시연 불가
- 모바일에서 min-w-[820px] 테이블이 가로 스크롤 불편

### 개선 목표

약정서(Agreement) 중심으로 대시보드를 재편하고,
실무자가 한 화면에서 서명 진행 상황 파악 + 상세 내용 확인 + 감사추적 PDF 다운로드까지 끝낼 수 있도록 개선한다.

---

## 2. 기능 목록

### 2-1. 필수 기능

| 번호 | 기능 | 설명 |
|------|------|------|
| F-01 | 요약 카드 4종 | 전체 약정서 수 / 서명완료 수 / 오늘 생성 수 / 총 대여금액 합계 |
| F-02 | 약정서 목록 테이블 | 컬럼: 생성일 / 채권자명 / 채무자명 / 금액 / 상태 / 상세보기 버튼 |
| F-03 | 상태별 필터 탭 | 전체 / 서명대기 / 서명완료 탭 필터 |
| F-04 | 상태 배지 | 서명대기(노랑) / 서명완료(초록) / 만료(회색) 색상 구분 |
| F-05 | 상세 모달 | 약정서 전체 내용 표시 + 서명 이미지 + 감사추적 PDF 다운로드 |
| F-06 | Mock 초기 데이터 | Mock 모드 진입 시 샘플 5건 자동 주입 |
| F-07 | 모바일 반응형 | 카드 2열→1열, 테이블→카드형 전환 |

### 2-2. 선택 기능 (추후 구현 가능)

| 번호 | 기능 | 설명 |
|------|------|------|
| O-01 | 검색 | 채권자/채무자 이름 텍스트 검색 |
| O-02 | 페이지네이션 | 50건 초과 시 페이지 단위 로드 |
| O-03 | CSV 다운로드 | 약정서 목록 전체 엑셀 내보내기 |

---

## 3. 기술 스택

### 기존 스택 그대로 유지

- **Next.js 14.2 App Router + TypeScript** — 서버 컴포넌트(인증 가드) + 클라이언트 컴포넌트(인터랙션)
- **Tailwind CSS 3.4** — 반응형 유틸리티 클래스
- **Supabase / Mock 이중 모드** — `lib/db.ts`의 `listAgreements()` 함수 직접 활용
- **기존 컴포넌트 재사용** — `Button`, `Card`, `Input` UI 컴포넌트 그대로 사용

### 신규 추가 라이브러리 없음

기존 스택만으로 구현 가능. 모달은 CSS position fixed + React state로 구현.

---

## 4. 데이터 구조

### 4-1. 대시보드에서 사용할 타입 (기존 타입 재활용)

```typescript
// lib/types.ts — 기존 타입, 수정 없음

// AgreementStatus 중 대시보드 표시용 매핑
// "draft" | "lender_signed" | "borrower_signed" | "paid" | "processing" | "completed" | "cancelled"

// 대시보드 표시 상태 (기존 AgreementStatus를 3가지로 그룹화)
type DashboardStatus = "pending" | "signed" | "expired";

// 그룹화 규칙:
// pending (서명대기):   draft | lender_signed
// signed  (서명완료):   borrower_signed | paid | processing | completed
// expired (만료):       cancelled + endDate 경과 건
```

### 4-2. 대시보드 전용 API 응답 타입 (신규 정의)

`components/admin/DashboardTable.tsx` 내부에 인터페이스 선언:

```typescript
// 목록 행 단위 데이터
interface AgreementRow {
  id: string;
  createdAt: string;           // YYYY-MM-DD 표시용
  lenderName: string;          // agreement.lender.name
  borrowerName: string;        // agreement.borrower.name
  amount: number;              // 원 단위
  status: AgreementStatus;     // 원본 상태 (배지 표시용)
  dashboardStatus: DashboardStatus; // 필터 탭용 그룹 상태
  lenderSigned: boolean;
  borrowerSigned: boolean;
  endDate: string;             // 만료일 판단용
  lenderSignToken: string;     // 감사추적 PDF 다운로드 token으로 사용
  borrowerSignToken: string;
}

// 요약 카드 데이터
interface DashboardStats {
  total: number;           // 전체 약정서 수
  signedCount: number;     // 서명완료 수 (borrowerSigned === true)
  todayCount: number;      // 오늘 생성 수
  totalAmount: number;     // 총 대여금액 합계 (원)
}

// API 응답
interface DashboardResponse {
  agreements: AgreementRow[];
  stats: DashboardStats;
}
```

### 4-3. 모달 상세 데이터 타입

```typescript
// 상세 모달에서 추가 fetch하는 데이터
interface AgreementDetail {
  agreement: Agreement;          // 기존 Agreement 타입 전체
  signatures: SignatureRecord[]; // 서명 감사로그 (서명 이미지 포함)
}
```

### 4-4. Mock 초기 데이터 구조

`lib/mock-store.ts`에 초기화 함수 추가:

```typescript
// Mock 시드 데이터 5건 구조 (예시)
const SEED_AGREEMENTS: Agreement[] = [
  {
    id: "mock-001-...",
    status: "borrower_signed",   // 서명완료
    amount: 50000000,
    interestRate: 0,
    startDate: "2026-05-01",
    endDate: "2027-05-01",
    repaymentMethod: "lump_sum",
    interestDay: null,
    lender: { name: "김철수", birth: "700101", phone: "010-1234-5678", email: "chulsoo@example.com", address: "서울시 강남구" },
    borrower: { name: "김영희", birth: "950215", phone: "010-9876-5432", email: "younghee@example.com", address: "서울시 서초구" },
    familyRelation: "parent_to_child",
    lenderSignToken: "mock-lender-token-001",
    borrowerSignToken: "mock-borrower-token-001",
    borrowerTokenExpiresAt: null,
    pdfBase64: null,
    documentHash: "abc123...",
    lenderSigned: true,
    borrowerSigned: true,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-02T14:00:00.000Z",
  },
  // ... 4건 추가 (상태 다양화: draft 1건, lender_signed 1건, borrower_signed 2건, cancelled 1건)
]
```

---

## 5. API 엔드포인트 스펙

### 5-1. 신규 API: GET /api/admin/agreements

기존 `/api/admin/orders`는 주문(Order) 기준이다.
약정서(Agreement) 기준 대시보드를 위해 신규 엔드포인트를 추가한다.

**요청**

```
GET /api/admin/agreements?status=all|pending|signed
```

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| status | string | N | all(기본) / pending / signed. 서버에서 필터링 |

**인증**: `isAdminAuthenticated()` 쿠키 검증. 실패 시 401 반환.

**응답 200**

```json
{
  "agreements": [
    {
      "id": "uuid",
      "createdAt": "2026-05-28T10:00:00.000Z",
      "lenderName": "김철수",
      "borrowerName": "김영희",
      "amount": 50000000,
      "status": "borrower_signed",
      "dashboardStatus": "signed",
      "lenderSigned": true,
      "borrowerSigned": true,
      "endDate": "2027-05-01",
      "lenderSignToken": "token-xxx",
      "borrowerSignToken": "token-yyy"
    }
  ],
  "stats": {
    "total": 12,
    "signedCount": 8,
    "todayCount": 2,
    "totalAmount": 450000000
  }
}
```

**응답 401**: 미인증

**응답 500**: 서버 오류

**구현 파일**: `app/api/admin/agreements/route.ts` (신규)

**구현 로직**:
```
1. isAdminAuthenticated() 검증
2. listAgreements() 호출 (lib/db.ts — Mock/Supabase 자동 분기)
3. 각 Agreement를 AgreementRow로 변환
   - dashboardStatus 계산: lenderSigned && borrowerSigned → signed, cancelled → expired, 그 외 → pending
4. stats 집계
   - todayCount: createdAt.slice(0,10) === 오늘 날짜(KST)
   - totalAmount: 전체 amount 합산
5. status 쿼리 파라미터로 필터링
6. 최신순(createdAt desc) 정렬 반환
```

### 5-2. 기존 API 재활용

| API | 용도 |
|-----|------|
| GET /api/agreements/[id] | 상세 모달 — agreement + order 조회 |
| GET /api/agreements/[id]/audit-cert?token=xxx | 감사추적 PDF 다운로드 |
| GET /api/agreements/[id]/pdf | 약정서 PDF 다운로드 |

상세 모달에서는 별도로 `/api/agreements/[id]` + signatures를 조합해야 하므로,
signatures를 포함한 응답이 필요하다. 두 가지 방안:

**방안 A (권장)**: `/api/agreements/[id]` 응답에 signatures 필드 추가

기존 route.ts를 수정해서 `getSignaturesByAgreement(id)` 결과를 포함하여 반환.

```json
{
  "agreement": { ... },
  "order": { ... },
  "signatures": [
    {
      "signerType": "lender",
      "signerName": "김철수",
      "signedAt": "2026-05-01T10:30:00.000Z",
      "ipAddress": "123.456.789.0",
      "signatureImageBase64": "data:image/png;base64,..."
    }
  ]
}
```

**방안 B**: 모달에서 `/api/agreements/[id]` + 별도 signatures API 2번 호출

방안 A가 단순하므로 방안 A 선택.

---

## 6. 파일/폴더 구조

### 6-1. 수정 파일

| 파일 경로 | 변경 내용 |
|-----------|-----------|
| `app/admin/dashboard/page.tsx` | `AdminTable` 제거, `DashboardTable` + `DashboardStats` 임포트로 교체 |
| `app/api/agreements/[id]/route.ts` | GET 응답에 `signatures` 배열 추가 |
| `lib/mock-store.ts` | `initMockSeedData()` 함수 추가 — Mock 모드 최초 진입 시 5건 시드 |

### 6-2. 신규 파일

| 파일 경로 | 역할 |
|-----------|------|
| `app/api/admin/agreements/route.ts` | GET /api/admin/agreements 신규 엔드포인트 |
| `components/admin/DashboardTable.tsx` | 약정서 목록 테이블 컴포넌트 (클라이언트) |
| `components/admin/DashboardStats.tsx` | 요약 카드 4종 컴포넌트 (클라이언트) |
| `components/admin/AgreementModal.tsx` | 상세 모달 컴포넌트 (클라이언트) |
| `components/admin/StatusBadge.tsx` | 상태 배지 컴포넌트 (서버/클라이언트 공용) |

### 6-3. 건드리지 않는 파일

- `app/admin/page.tsx` — 로그인 페이지, 변경 없음
- `lib/admin-auth.ts` — 인증 로직, 변경 없음
- `lib/types.ts` — 타입 정의, 변경 없음
- `components/AdminTable.tsx` — 기존 주문 테이블, 삭제하지 않고 유지 (orders 기반 기능은 별도 탭으로 이후 통합 가능)

---

## 7. UI 레이아웃

### 7-1. 전체 페이지 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│  / 내지마요  관리자 대시보드                        [로그아웃]       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│  │ 전체 약정서  │ │ 서명완료     │ │ 오늘 생성    │ │ 총 대여금액  ││
│  │    12건      │ │    8건       │ │    2건       │ │ 4억5천만원   ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│
│                                                                     │
│  [전체]  [서명대기]  [서명완료]                                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ 생성일   │ 채권자   │ 채무자   │ 금액        │ 상태   │ 상세   ││
│  ├──────────┼──────────┼──────────┼─────────────┼────────┼────────┤│
│  │ 05-28    │ 김철수   │ 김영희   │ 5,000만원   │서명완료│[보기]  ││
│  │ 05-27    │ 이민준   │ 이소연   │ 3,000만원   │서명대기│[보기]  ││
│  │ 05-26    │ 박지훈   │ 박수진   │ 1,500만원   │서명완료│[보기]  ││
│  │ 05-25    │ 최현우   │ 최미래   │ 2,000만원   │서명대기│[보기]  ││
│  │ 05-20    │ 정태양   │ 정달빛   │  800만원    │  만료  │[보기]  ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### 7-2. 요약 카드 상세

```
┌────────────────────────┐
│ 전체 약정서            │
│                        │
│  12                    │  ← 숫자 크게 (text-3xl font-bold)
│  건                    │  ← 단위 작게 (text-sm text-slate-500)
└────────────────────────┘
```

카드 4종:

| 카드 | 라벨 | 값 | 색상 포인트 |
|------|------|----|------------|
| 1 | 전체 약정서 | N건 | slate |
| 2 | 서명완료 | N건 | green |
| 3 | 오늘 생성 | N건 | blue |
| 4 | 총 대여금액 | N억 N천만원 | indigo |

### 7-3. 필터 탭

```
[ 전체 12 ]  [ 서명대기 4 ]  [ 서명완료 8 ]
  ^활성탭(진한 배경)     ^비활성(흰 배경)
```

각 탭에 건수 숫자를 badge로 표시. 탭 클릭 시 해당 status로 API 재호출.

### 7-4. 테이블 컬럼 정의

| 컬럼 | 데이터 | 정렬 | 모바일 표시 |
|------|--------|------|------------|
| 생성일 | createdAt → MM-DD | 좌 | 표시 |
| 채권자 | lender.name | 좌 | 표시 |
| 채무자 | borrower.name | 좌 | 표시 |
| 금액 | amount → 한국식 원 단위 | 우 | 표시 |
| 상태 | dashboardStatus → 배지 | 중앙 | 표시 |
| 상세보기 | 버튼 | 중앙 | 표시 |

**모바일 처리**: `md:hidden` / `md:table-cell` 클래스로 채권자·채무자 중 하나를 숨기거나, 480px 미만에서는 테이블 대신 카드 리스트 레이아웃으로 전환.

### 7-5. 상태 배지 색상

| dashboardStatus | 라벨 | 배경색 | 글자색 |
|-----------------|------|--------|--------|
| pending | 서명대기 | bg-yellow-100 | text-yellow-700 |
| signed | 서명완료 | bg-green-100 | text-green-700 |
| expired | 만료 | bg-slate-100 | text-slate-500 |

### 7-6. 상세 모달 레이아웃

```
┌──────────────────────────────────────────────────────────────────────┐
│  약정서 상세                                               [X 닫기]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ─ 기본 정보 ──────────────────────────────────────────────────────  │
│  생성일:  2026-05-28        약정서 ID: mock-001-...                  │
│  상태배지: [서명완료]       가족관계: 부모 → 자녀                    │
│                                                                      │
│  ─ 금융 조건 ──────────────────────────────────────────────────────  │
│  대여금액: 50,000,000원     이자율: 무이자                           │
│  대여기간: 2026-05-01 ~ 2027-05-01    상환방법: 만기일시상환         │
│                                                                      │
│  ─ 채권자 (갑) ────────────────────────────────────────────────────  │
│  성명: 김철수   생년월일: 700101   전화: 010-1234-5678               │
│  이메일: chulsoo@example.com                                         │
│  주소: 서울시 강남구                                                 │
│  서명: [서명 이미지 표시 — 최대 240px 폭]                            │
│  서명일시: 2026-05-01 10:30 (IP: 123.456.789.0)                     │
│                                                                      │
│  ─ 채무자 (을) ────────────────────────────────────────────────────  │
│  성명: 김영희   생년월일: 950215   전화: 010-9876-5432               │
│  이메일: younghee@example.com                                        │
│  주소: 서울시 서초구                                                 │
│  서명: [서명 이미지 표시 — 최대 240px 폭]                            │
│  서명일시: 2026-05-02 14:00 (IP: 987.654.321.0)                     │
│                                                                      │
│  ─ 문서 다운로드 ──────────────────────────────────────────────────  │
│  [약정서 PDF 다운로드]   [감사추적 인증서 PDF 다운로드]              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**모달 동작**:
- 배경 클릭 시 닫힘
- ESC 키로 닫힘 (useEffect + keydown 이벤트)
- 모달 열릴 때 body scroll 잠금 (overflow-hidden)
- 로딩 중 spinner 표시
- 서명 이미지 없을 경우 "서명 이미지 없음" 텍스트 표시

---

## 8. 컴포넌트 상세 스펙

### 8-1. app/admin/dashboard/page.tsx (수정)

**역할**: 서버 컴포넌트. 인증 가드 + 레이아웃.

**변경 사항**:
- 기존 `AdminTable` 임포트 → `DashboardTable` 임포트로 교체
- 헤더에 페이지 설명 텍스트 추가 ("약정서 전체 현황")

```
기존: <AdminTable />
변경: <DashboardTable />
```

### 8-2. components/admin/DashboardStats.tsx (신규)

**역할**: 클라이언트 컴포넌트. 요약 카드 4종 렌더링.

**Props**:
```typescript
interface DashboardStatsProps {
  stats: DashboardStats;
  loading?: boolean;
}
```

**동작**:
- loading=true 시 카드 내부에 skeleton shimmer 표시
- 금액은 `formatNumber()` (lib/interest-calc.ts의 기존 함수) 사용
- 금액이 1억 이상이면 "N억 N천만원" 형식으로 별도 포맷 함수 작성

### 8-3. components/admin/StatusBadge.tsx (신규)

**역할**: dashboardStatus → 한글 라벨 + 색상 배지.

**Props**:
```typescript
interface StatusBadgeProps {
  status: "pending" | "signed" | "expired";
  size?: "sm" | "md"; // 기본 md
}
```

**렌더 결과 예시**:
```html
<span class="rounded-full px-2.5 py-1 text-xs font-medium bg-yellow-100 text-yellow-700">
  서명대기
</span>
```

### 8-4. components/admin/DashboardTable.tsx (신규)

**역할**: 클라이언트 컴포넌트. 약정서 목록 테이블 + 필터 탭 + 상세 모달 제어.

**State**:
```typescript
const [agreements, setAgreements] = useState<AgreementRow[]>([]);
const [stats, setStats] = useState<DashboardStats | null>(null);
const [filter, setFilter] = useState<"all" | "pending" | "signed">("all");
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [selectedId, setSelectedId] = useState<string | null>(null); // 모달 대상
```

**동작 흐름**:
1. 마운트 시 `/api/admin/agreements?status=all` fetch
2. 필터 탭 변경 시 `?status=pending` or `?status=signed` 로 재fetch
3. [보기] 버튼 클릭 → `setSelectedId(row.id)` → AgreementModal 열림
4. 모달 닫힘 → `setSelectedId(null)`

**테이블 행 클릭**: 행 전체 클릭이 아닌, [보기] 버튼만 모달 오픈 (기존 accordion 방식 제거)

**반응형**:
```
sm 이하 (< 640px):
  테이블 숨김 (hidden)
  카드 리스트 표시 (block)
  카드 1건 = 생성일 + 채권자→채무자 + 금액 + 상태 + [보기] 버튼

md 이상 (>= 768px):
  테이블 표시
  카드 리스트 숨김
```

### 8-5. components/admin/AgreementModal.tsx (신규)

**역할**: 클라이언트 컴포넌트. 약정서 상세 내용 + 서명 이미지 + PDF 다운로드.

**Props**:
```typescript
interface AgreementModalProps {
  agreementId: string;
  onClose: () => void;
}
```

**State**:
```typescript
const [detail, setDetail] = useState<AgreementDetail | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
```

**마운트 시 동작**:
```
1. GET /api/agreements/[agreementId] 호출
2. 응답: { agreement, order, signatures } 파싱
3. setDetail({ agreement, signatures })
```

**감사추적 PDF 다운로드 URL 생성**:
```typescript
// lenderSignToken 을 token 파라미터로 사용
const auditCertUrl = `/api/agreements/${agreementId}/audit-cert?token=${detail.agreement.lenderSignToken}`;
```

**서명 이미지 표시**:
```typescript
// signatures 배열에서 signerType별 찾기
const lenderSig = signatures.find(s => s.signerType === "lender");
const borrowerSig = signatures.find(s => s.signerType === "borrower");

// 이미지가 있으면 <img src={lenderSig.signatureImageBase64} /> 렌더
// 없으면 <p className="text-slate-400 text-sm">서명 이미지 없음</p>
```

**ESC 닫기**:
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [onClose]);
```

**body scroll 잠금**:
```typescript
useEffect(() => {
  document.body.style.overflow = "hidden";
  return () => { document.body.style.overflow = ""; };
}, []);
```

---

## 9. Mock 데이터 상세 정의

### 9-1. initMockSeedData() 함수 위치 및 호출 시점

**위치**: `lib/mock-store.ts` 하단에 추가

**호출 시점**: `/api/admin/agreements/route.ts` GET 핸들러 최상단에서

```typescript
// app/api/admin/agreements/route.ts
import { initMockSeedData } from "@/lib/mock-store";

export async function GET(req: NextRequest) {
  // Mock 모드이고 데이터가 없으면 시드 초기화
  if (isMockMode()) {
    initMockSeedData();
  }
  // ... 이하 로직
}
```

**initMockSeedData() 로직**:
```typescript
export function initMockSeedData(): void {
  const store = getStore();
  // 이미 데이터가 있으면 중복 주입 방지
  if (store.agreements.size > 0) return;

  SEED_AGREEMENTS.forEach(saveAgreement);
  SEED_SIGNATURES.forEach(addSignature);
}
```

### 9-2. 시드 데이터 5건 상세

| 건 | ID (앞 8자) | 채권자 | 채무자 | 금액 | 상태 | 관계 |
|----|------------|--------|--------|------|------|------|
| 1 | mock-001 | 김철수 | 김영희 | 5,000만원 | borrower_signed (서명완료) | 부모→자녀 |
| 2 | mock-002 | 이민준 | 이소연 | 3,000만원 | lender_signed (서명대기) | 형제자매 |
| 3 | mock-003 | 박지훈 | 박수진 | 1,500만원 | borrower_signed (서명완료) | 배우자 |
| 4 | mock-004 | 최현우 | 최미래 | 2,000만원 | draft (서명대기) | 자녀→부모 |
| 5 | mock-005 | 정태양 | 정달빛 | 800만원 | cancelled (만료) | 기타 |

**createdAt 범위**: 오늘 기준 -28일 ~ 오늘. 2건은 오늘 날짜로 설정 (todayCount = 2 검증용).

**서명 감사로그 시드**:
- mock-001: lender + borrower 서명 레코드 2건 (signatureImageBase64: null)
- mock-003: lender + borrower 서명 레코드 2건
- mock-002: lender 서명 레코드 1건만
- mock-004, mock-005: 서명 레코드 없음

---

## 10. 예상 에러 시나리오

| 에러 상황 | 발생 조건 | 처리 방법 |
|-----------|-----------|-----------|
| 인증 만료 | admin_session 쿠키 없거나 불일치 | API 401 → 화면에 "세션이 만료되었습니다. 다시 로그인해주세요." 메시지 + 로그인 페이지 redirect |
| 데이터 없음 | Mock 시드 미초기화 또는 Supabase 빈 테이블 | "약정서가 없습니다." 빈 상태 UI 표시 (에러 아님) |
| 상세 fetch 실패 | /api/agreements/[id] 404 또는 500 | 모달 내 "상세 정보를 불러오지 못했습니다." 에러 메시지 + [닫기] 버튼 |
| 감사추적 PDF token 불일치 | lenderSignToken이 만료되거나 변조 | 브라우저가 403 PDF 응답 수신 → 다운로드 실패 (alert "인증서 다운로드에 실패했습니다.") |
| 서명 이미지 base64 손상 | DB 저장 오류 | img onError 핸들러로 이미지 숨기고 "이미지를 불러올 수 없습니다." 표시 |
| Supabase 연결 실패 | 네트워크 오류 또는 키 불일치 | isMockMode() false인데 Supabase 오류 → 500 응답, 대시보드에 "서버 오류가 발생했습니다." 표시 |
| 필터 탭 fetch 중 탭 변경 | 연속 클릭으로 race condition | loading 상태 동안 탭 버튼 disabled 처리 또는 AbortController로 이전 요청 취소 |

---

## 11. 사용자 플로우

### 플로우 1: 대시보드 진입

```
1. /admin 접근
2. 비밀번호 입력 → POST /api/admin/login
3. 쿠키 설정 후 /admin/dashboard redirect
4. DashboardTable 마운트 → GET /api/admin/agreements?status=all
5. stats + agreements 수신 → 카드 + 테이블 렌더링
```

### 플로우 2: 필터 탭 변경

```
1. [서명대기] 탭 클릭
2. setFilter("pending")
3. GET /api/admin/agreements?status=pending 재호출
4. 테이블 업데이트 (전체 목록 중 pending만 표시)
   - 통계 카드는 항상 전체 기준으로 고정 표시 (필터와 무관)
```

### 플로우 3: 상세 모달 열기

```
1. 테이블 행의 [보기] 버튼 클릭
2. setSelectedId(agreementId)
3. AgreementModal 렌더링 시작
4. GET /api/agreements/[id] 호출 (loading spinner 표시)
5. 응답 수신 → 모달 내용 렌더링
6. [약정서 PDF] 클릭 → 새 탭으로 /api/agreements/[id]/pdf 열기
7. [감사추적 인증서] 클릭 → 새 탭으로 /api/agreements/[id]/audit-cert?token=xxx 열기
8. [X] 또는 배경 클릭 또는 ESC → 모달 닫힘
```

---

## 12. 구현 시 주의사항

### 기존 AdminTable.tsx 보존

- 기존 `AdminTable` 컴포넌트는 삭제하지 않는다.
- `/admin/dashboard/page.tsx`에서 `AdminTable` → `DashboardTable`로 교체만 한다.
- 이후 주문 관리 탭이 필요하면 `AdminTable`을 다시 탭으로 붙일 수 있다.

### Mock 모드 보장

- `isMockMode()` 체크는 `lib/config.ts`의 기존 함수 사용.
- 시드 데이터는 `agreements.size === 0` 체크로 중복 주입 방지.
- 서버 재시작(HMR) 시 스토어 초기화됨 — 이는 mock-store.ts 기존 설계이므로 그대로 허용.

### audit-cert token 주의

- 관리자 대시보드에서 감사추적 PDF 다운로드 시 `lenderSignToken`을 token으로 사용.
- 이 token은 현재 lender/borrower 모두 허용 (audit-cert route.ts 검증 로직 확인됨).
- 단, token이 null인 경우(이론상 없지만) 다운로드 버튼 비활성화 처리 필요.

### 금액 포맷 함수

- 기존 `formatNumber()`는 단순 콤마 포맷.
- 통계 카드의 "총 대여금액"은 억 단위 포맷 필요 → `DashboardStats.tsx` 내부에 별도 `formatAmount()` 함수 작성.

```typescript
function formatAmount(won: number): string {
  if (won >= 100000000) {
    const eok = Math.floor(won / 100000000);
    const man = Math.floor((won % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man.toLocaleString("ko-KR")}만원` : `${eok}억원`;
  }
  if (won >= 10000) {
    return `${Math.floor(won / 10000).toLocaleString("ko-KR")}만원`;
  }
  return `${won.toLocaleString("ko-KR")}원`;
}
```

---

## 13. 파일별 구현 순서 (권장)

개발자가 순서대로 구현하면 의존성 문제 없이 진행 가능하다.

1. `lib/mock-store.ts` — `initMockSeedData()` 및 시드 데이터 추가
2. `app/api/agreements/[id]/route.ts` — signatures 필드 응답 추가
3. `app/api/admin/agreements/route.ts` — 신규 API 엔드포인트 작성
4. `components/admin/StatusBadge.tsx` — 배지 컴포넌트 (독립)
5. `components/admin/DashboardStats.tsx` — 통계 카드 컴포넌트
6. `components/admin/AgreementModal.tsx` — 상세 모달 컴포넌트
7. `components/admin/DashboardTable.tsx` — 테이블 컴포넌트 (5, 6 완료 후)
8. `app/admin/dashboard/page.tsx` — 페이지에서 DashboardTable로 교체

---

다음 단계: developer 에이전트로 구현 진행
