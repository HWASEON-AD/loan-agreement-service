# 주식 브리핑 이메일 발송 API 기획서

- 작성일: 2026-05-30
- 작성자: 시니어 기획자/아키텍트 (Claude)
- 대상 프로젝트: loan-agreement-service (Vercel 배포)
- 목적: CCR 원격 에이전트가 curl로 이메일을 직접 발송할 수 있는 API 엔드포인트 추가

---

## 1. 배경 및 문제 정의

### 현황
- Claude.ai CCR 루틴이 매일 08:30/20:30 KST에 주식 포트폴리오 브리핑을 생성함
- Gmail MCP는 Draft(초안) 생성만 가능하고 실제 발송 기능 없음
- 결과적으로 사용자(gt.min@hwaseon.com)가 브리핑 이메일을 수신하지 못하고 있음

### 해결 방향
- loan-agreement-service에 `/api/send-email` 라우트를 추가
- 해당 프로젝트는 이미 SMTP 환경변수(SMTP_HOST/PORT/USER/PASS)가 Vercel에 설정되어 있음
- nodemailer도 이미 `package.json`에 설치되어 있음 (`"nodemailer": "^8.0.9"`)
- 별도 배포 없이 기존 Vercel 자동 배포 파이프라인에 편승

---

## 2. 기능 목록

### 필수 기능
| 기능 | 설명 |
|------|------|
| POST /api/send-email | subject + body + api_key를 받아 SMTP로 이메일 발송 |
| API Key 인증 | `api_key` 파라미터가 환경변수 `EMAIL_API_KEY`와 일치해야만 발송 |
| 수신자 고정 | 발송 대상은 항상 `gt.min@hwaseon.com` (서버에서 하드코딩 — 외부에서 변경 불가) |
| HTML/텍스트 모두 지원 | body가 `<`로 시작하면 HTML, 아니면 plain text로 처리 |
| 성공/실패 JSON 응답 | `{"ok": true}` 또는 `{"ok": false, "error": "..."}` |

### 선택 기능 (향후 확장 가능)
| 기능 | 설명 |
|------|------|
| `to` 파라미터 지원 | API Key 인증 후 수신자 변경 허용 (현재는 고정 수신자만) |
| 발송 로그 저장 | Supabase에 발송 이력 기록 |
| rate limiting | 분당 N회 제한 (CCR 오작동 방지) |

---

## 3. API 엔드포인트 스펙

### 3-1. 요청 (Request)

```
POST https://loan-agreement-service.vercel.app/api/send-email
Content-Type: application/json
```

**Request Body (JSON)**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `api_key` | string | 필수 | 인증 키 (환경변수 EMAIL_API_KEY와 대조) |
| `subject` | string | 필수 | 이메일 제목 |
| `body` | string | 필수 | 이메일 본문 (HTML 또는 plain text) |

**예시 요청**

```json
{
  "api_key": "여기에_실제_API_키",
  "subject": "[주식 브리핑] 2026-05-30 08:30 KST",
  "body": "<h2>오늘의 포트폴리오 현황</h2><p>삼성전자 +1.2%...</p>"
}
```

### 3-2. 응답 (Response)

**성공 (HTTP 200)**
```json
{"ok": true}
```

**인증 실패 (HTTP 401)**
```json
{"ok": false, "error": "Unauthorized"}
```

**파라미터 누락 (HTTP 400)**
```json
{"ok": false, "error": "subject and body are required"}
```

**SMTP 발송 실패 (HTTP 500)**
```json
{"ok": false, "error": "SMTP 발송 실패: Connection refused"}
```

---

## 4. 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| 런타임 | Next.js 14 App Router API Route | 기존 프로젝트와 동일, 추가 배포 불필요 |
| SMTP 라이브러리 | nodemailer ^8.0.9 | 이미 package.json에 설치됨, lib/email.ts에서 사용 중 |
| SMTP 서버 | smtp.worksmobile.com:587 | NAVER Works, 기존 환경변수 그대로 사용 |
| 인증 | API Key (환경변수 비교) | JWT/OAuth 대비 CCR curl 호출에 적합하고 단순 |
| 타입 | TypeScript | 기존 프로젝트 전체가 TS |

**nodemailer 재사용 이유**: `lib/email.ts`에 이미 `getTransporter()` 싱글톤이 구현되어 있음.
새 라우트에서 이 함수를 그대로 import해 사용하면 코드 중복 없음.

---

## 5. 데이터 구조

### 5-1. 요청 타입

```typescript
type SendEmailRequest = {
  api_key: string;   // 인증 키
  subject: string;   // 이메일 제목 (최대 200자 권장)
  body: string;      // 이메일 본문 (HTML 또는 plain text)
};
```

### 5-2. 응답 타입

```typescript
type SendEmailResponse =
  | { ok: true }
  | { ok: false; error: string };
```

### 5-3. 환경변수 목록

| 변수명 | 설명 | Vercel 설정 여부 |
|--------|------|----------------|
| `SMTP_HOST` | SMTP 서버 주소 (smtp.worksmobile.com) | 설정 완료 |
| `SMTP_PORT` | SMTP 포트 (587) | 설정 완료 |
| `SMTP_USER` | 발신자 이메일 주소 | 설정 완료 |
| `SMTP_PASS` | SMTP 비밀번호 | 설정 완료 |
| `EMAIL_API_KEY` | 이 API 전용 인증 키 | **신규 추가 필요** |

**EMAIL_API_KEY 생성 방법**: 랜덤 32자 이상 문자열 권장
```
예시: stock-email-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 6. 파일/폴더 구조

### 6-1. 신규 생성 파일

```
app/
  api/
    send-email/
      route.ts          ← 신규 생성 (핵심 파일)
```

### 6-2. 수정 파일

```
lib/
  email.ts              ← getTransporter() 함수를 export로 변경 (또는 sendViaSmtp를 export)
```

현재 `lib/email.ts`의 `sendViaSmtp` 함수와 `getTransporter` 함수는 모듈 내부에서만 사용 가능(`function`, export 없음).
`send-email/route.ts`에서 재사용하려면 `sendViaSmtp`를 export하거나,
아니면 `route.ts`에서 nodemailer를 직접 import해도 무방 (트랜스포터 재생성 비용이 서버리스에서 미미함).

**권장: route.ts에서 nodemailer 직접 사용** — email.ts를 수정하지 않아 기존 로직에 영향 없음.

### 6-3. 최종 파일 목록 (변경 사항만)

```
app/api/send-email/route.ts    ← 신규 생성
```

환경변수 추가:
```
Vercel 대시보드 → loan-agreement-service → Settings → Environment Variables
EMAIL_API_KEY = [생성한 랜덤 키]  (Production + Preview + Development 모두 체크)
```

---

## 7. route.ts 상세 로직 설계

```
[요청 수신]
    ↓
[Content-Type 확인 → application/json 파싱]
    ↓
[api_key 검증]
    api_key !== process.env.EMAIL_API_KEY
    → 401 {"ok": false, "error": "Unauthorized"}
    ↓
[subject, body 존재 확인]
    누락 시 → 400 {"ok": false, "error": "subject and body are required"}
    ↓
[SMTP 환경변수 확인]
    SMTP_USER, SMTP_PASS 없으면 → 500 {"ok": false, "error": "SMTP not configured"}
    ↓
[nodemailer.createTransport() → sendMail()]
    수신자: gt.min@hwaseon.com (서버에서 고정)
    발신자: SMTP_USER (NAVER Works 계정)
    body가 "<"로 시작하면 html 필드, 아니면 text 필드로 전송
    ↓
[성공] → 200 {"ok": true}
[실패] → 500 {"ok": false, "error": SMTP 에러 메시지}
```

---

## 8. CCR 루틴 프롬프트 업데이트 방법

### 8-1. 기존 루틴 위치

Claude.ai → Projects → 해당 CCR 루틴 (trig_016et4MjTGfUi88r6VG8f1zZ)

### 8-2. 추가할 curl 호출 예시

CCR 루틴 프롬프트 마지막에 아래 지시문을 추가:

```
## 이메일 발송 지시

분석이 완료되면 아래 curl 명령으로 이메일을 직접 발송한다.
Gmail MCP의 Draft 생성은 사용하지 않는다.

curl -s -X POST https://loan-agreement-service.vercel.app/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "여기에_EMAIL_API_KEY_값",
    "subject": "[주식 브리핑] YYYY-MM-DD HH:MM KST",
    "body": "<여기에 HTML 형식 브리핑 본문>"
  }'

응답이 {"ok":true}이면 발송 성공. {"ok":false,...}이면 에러 내용을 응답에 포함한다.
```

### 8-3. HTML 본문 작성 가이드 (CCR 루틴 참고용)

```html
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#1d4ed8;">[주식 브리핑] 2026-05-30 08:30 KST</h2>
  
  <h3>포트폴리오 현황</h3>
  <table style="width:100%;border-collapse:collapse;">
    <tr style="background:#f1f5f9;">
      <th style="padding:8px;text-align:left;">종목</th>
      <th style="padding:8px;text-align:right;">비중</th>
      <th style="padding:8px;text-align:right;">등락</th>
    </tr>
    <!-- 종목 행 반복 -->
  </table>
  
  <h3>오늘의 주요 뉴스</h3>
  <ul>
    <li>항목1</li>
  </ul>
  
  <h3>AI 코멘트</h3>
  <p>분석 내용...</p>
  
  <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
    이 메일은 CCR 자동 브리핑 루틴이 발송합니다.
  </p>
</div>
```

### 8-4. curl에서 JSON body에 HTML 넣는 방법 (CCR 실행 참고)

CCR 루틴(Bash/curl 실행)에서 body에 HTML을 넣을 때는 jq를 사용하면 안전:

```bash
SUBJECT="[주식 브리핑] $(date '+%Y-%m-%d %H:%M') KST"
BODY="<h2>브리핑</h2><p>내용...</p>"

curl -s -X POST https://loan-agreement-service.vercel.app/api/send-email \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg s "$SUBJECT" --arg b "$BODY" --arg k "API키값" \
    '{api_key: $k, subject: $s, body: $b}')"
```

또는 파이썬으로:

```python
import json, urllib.request

payload = json.dumps({
    "api_key": "여기에_EMAIL_API_KEY_값",
    "subject": "[주식 브리핑] 2026-05-30",
    "body": "<h2>브리핑</h2><p>내용</p>"
}).encode()

req = urllib.request.Request(
    "https://loan-agreement-service.vercel.app/api/send-email",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST"
)
res = urllib.request.urlopen(req)
print(res.read().decode())
```

---

## 9. 보안 고려사항

| 위협 | 대응 방법 |
|------|-----------|
| 무단 이메일 발송 | `EMAIL_API_KEY` 인증 — 키 없으면 401 반환 |
| 수신자 조작 | 수신자(`to`)를 서버에서 `gt.min@hwaseon.com`으로 고정 — 요청 파라미터로 변경 불가 |
| API Key 노출 | Vercel 환경변수로만 관리 — 코드에 절대 하드코딩 금지 |
| 스팸 발송 대량 요청 | Vercel 서버리스 자체 타임아웃 + NAVER Works SMTP 발송 한도로 자연 제한 |
| MITM | Vercel HTTPS 강제 — 평문 HTTP 차단됨 |
| 로그 유출 | 응답에 api_key를 echo하지 않음, 서버 로그에도 마스킹 처리 |

### API Key 보관 원칙
- Vercel 환경변수에만 저장
- CCR 루틴 프롬프트에 직접 입력 시 CCR 실행 로그에 남을 수 있음
  - 대안: CCR 루틴에서 별도 환경 시크릿으로 관리 (Claude.ai CCR 시크릿 기능 사용 가능 시)
  - 현실적 대안: 루틴 프롬프트에는 키 자체 대신 "EMAIL_API_KEY 값을 사용한다"고 명시하고, 실행 시 사용자가 직접 주입

---

## 10. 예상 에러 시나리오

| 시나리오 | HTTP 코드 | 응답 | 처리 방법 |
|---------|-----------|------|-----------|
| api_key 누락 또는 불일치 | 401 | `{"ok":false,"error":"Unauthorized"}` | CCR에서 키 값 재확인 |
| subject 또는 body 누락 | 400 | `{"ok":false,"error":"subject and body are required"}` | CCR 프롬프트 수정 |
| SMTP_USER/PASS 미설정 | 500 | `{"ok":false,"error":"SMTP not configured"}` | Vercel 환경변수 확인 |
| SMTP 연결 타임아웃 | 500 | `{"ok":false,"error":"SMTP 발송 실패: ..."}` | NAVER Works 서비스 상태 확인 |
| Vercel 콜드 스타트 타임아웃 | 504 | (Vercel 자체 에러) | CCR에서 재시도 1회 |
| JSON 파싱 오류 (잘못된 body) | 400 | `{"ok":false,"error":"Invalid JSON"}` | curl 명령의 JSON 문법 확인 |
| 이메일 본문 너무 큼 | 413 | (Vercel 자체 에러, 4.5MB 제한) | HTML 본문 경량화 |

---

## 11. 구현 순서 (developer 에이전트용)

1. Vercel 대시보드에서 `EMAIL_API_KEY` 환경변수 추가 (Production + Preview + Development)
2. `app/api/send-email/route.ts` 파일 생성
3. 로컬에서 `npm run build` → 타입 에러 없는지 확인
4. git push → Vercel 자동 배포 대기
5. curl로 실제 발송 테스트:
   ```bash
   curl -s -X POST https://loan-agreement-service.vercel.app/api/send-email \
     -H "Content-Type: application/json" \
     -d '{"api_key":"테스트키","subject":"테스트","body":"<p>테스트 메일</p>"}'
   ```
6. gt.min@hwaseon.com 수신함 확인
7. CCR 루틴 프롬프트 업데이트

---

다음 단계: developer 에이전트로 구현 진행
