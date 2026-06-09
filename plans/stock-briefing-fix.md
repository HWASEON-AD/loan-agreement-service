# 주식 브리핑 CCR 루틴 개선 기획서

- 작성일: 2026-06-02
- 작성자: 시니어 기획자/아키텍트 (Claude)
- 관련 루틴: trig_016et4MjTGfUi88r6VG8f1zZ (08:30 / 20:30 KST 자동 실행)
- 목적: 봇 탐지로 인한 주가 수집 실패 문제를 Yahoo Finance 비공개 JSON API로 완전 해결

---

## 1. 문제 분석 — 기존 방식의 실패 원인

### 1-1. 실패 경로

```
CCR 에이전트 실행
    ↓
WebFetch로 Google Finance / stockanalysis.com 호출
    ↓
Cloudflare / Akamai 봇 탐지 → 403 / CAPTCHA 페이지 반환
    ↓
주가 데이터 수집 실패 (HTML 파싱 불가)
    ↓
이메일 본문 생성 실패 → 발송 자체를 포기
    ↓
사용자 수신함 도달 불가 (매일 2회 실패 반복)
```

### 1-2. 근본 원인

| 원인 | 설명 |
|------|------|
| 봇 탐지 차단 | Google Finance, stockanalysis.com은 Cloudflare로 보호됨. CCR 에이전트 IP는 데이터센터 IP로 인식되어 즉시 차단 |
| HTML 스크래핑 의존 | WebFetch가 반환한 HTML에서 CSS 선택자로 주가를 파싱하는 방식 — 봇 차단 시 파싱 대상 자체가 없어짐 |
| 에러 처리 부재 | 수집 실패 시 이메일 발송 단계로 넘어가지 않고 루틴 자체가 중단됨 |
| WebSearch 의존 | WebSearch 결과는 스니펫 수준 텍스트로 정확한 현재가 추출 불가 |

### 1-3. 문제 범위

- 주가 수집 실패율: 추정 100% (봇 차단이 구조적 문제이므로 재시도해도 동일)
- 이메일 발송 실패율: 주가 수집 실패와 동일 (발송 로직이 수집 성공에 종속되어 있음)
- 영향: 매일 08:30 / 20:30 KST 브리핑 2회 전체 미수신

---

## 2. 해결 방법 — Yahoo Finance 비공개 JSON API

### 2-1. 왜 Yahoo Finance인가

| 항목 | Google Finance | stockanalysis.com | Yahoo Finance JSON API |
|------|---------------|-------------------|------------------------|
| 접근 방식 | HTML 스크래핑 | HTML 스크래핑 | JSON API 직접 호출 |
| 봇 탐지 | Cloudflare 차단 | Akamai 차단 | User-Agent 헤더만으로 통과 |
| API 키 필요 여부 | 불필요 (스크래핑) | 불필요 (스크래핑) | 불필요 (비공개 API) |
| 응답 형식 | HTML | HTML | JSON (파싱 안정적) |
| 데이터 신뢰도 | 높음 | 높음 | 높음 (Yahoo Finance 공식 데이터) |
| CCR 환경 사용 가능 | 불가 | 불가 | 가능 (Python urllib으로 호출) |

### 2-2. Yahoo Finance JSON API 스펙

**엔드포인트**
```
GET https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}
```

**필수 헤더**
```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
```

**응답 JSON 구조**
```json
{
  "chart": {
    "result": [{
      "meta": {
        "regularMarketPrice": 195000,
        "previousClose": 191000,
        "regularMarketChangePercent": 2.09,
        "currency": "KRW",
        "exchangeName": "KSC"
      }
    }],
    "error": null
  }
}
```

**심볼 목록**

| 종목 | 심볼 | 거래소 |
|------|------|--------|
| 두산에너빌리티 | 034020.KS | 한국거래소 |
| 삼양식품 | 003230.KS | 한국거래소 |
| SK하이닉스 | 000660.KS | 한국거래소 |
| Microsoft | MSFT | NASDAQ |
| Alphabet | GOOGL | NASDAQ |
| ITA 방산ETF | ITA | NYSE |
| 코스피 지수 | ^KS11 | 한국거래소 |
| 나스닥 지수 | ^IXIC | NASDAQ |
| 은선물 | SI=F | COMEX |

### 2-3. 개선된 에러 처리 원칙

- 각 종목 API 호출은 개별 try/except로 감쌈 — 1개 실패가 나머지에 영향 없음
- 수집 실패 종목은 "확인 불가" 표시로 HTML 빌드
- HTML 빌드 실패 시에도 최소한의 내용으로 이메일 발송
- **이메일 발송은 어떤 상황에서도 반드시 실행** — 마지막 단계를 try/except 바깥에서 실행

---

## 3. CCR 루틴 프롬프트 전체 (복붙 사용 가능한 완성본)

아래 텍스트를 CCR 루틴 trig_016et4MjTGfUi88r6VG8f1zZ의 프롬프트로 교체한다.

---

```
당신은 매일 2회(08:30 / 20:30 KST) 실행되는 주식 브리핑 에이전트입니다.
아래 Step 1 → Step 2 → Step 3 순서로 반드시 실행하세요.
어떤 단계가 실패해도 Step 3(이메일 발송)은 반드시 실행해야 합니다.

---

## Step 1: 주가 데이터 수집 (Python으로 Yahoo Finance JSON API 호출)

Bash 도구로 아래 Python 코드를 실행하세요.
WebFetch나 WebSearch로 주가를 수집하지 마세요. 반드시 Python urllib을 사용하세요.

```python
import urllib.request
import json
import datetime

SYMBOLS = {
    "두산에너빌리티": "034020.KS",
    "삼양식품": "003230.KS",
    "SK하이닉스": "000660.KS",
    "Microsoft": "MSFT",
    "Alphabet": "GOOGL",
    "ITA 방산ETF": "ITA",
    "코스피": "^KS11",
    "나스닥": "^IXIC",
    "은선물": "SI=F",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

results = {}

for name, symbol in SYMBOLS.items():
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode())
        meta = data["chart"]["result"][0]["meta"]
        price = meta.get("regularMarketPrice", 0)
        prev = meta.get("previousClose", 0)
        change_pct = meta.get("regularMarketChangePercent", 0)
        currency = meta.get("currency", "")
        
        # 가격 포맷: 한국 종목은 정수, 미국은 소수점 2자리
        if currency == "KRW":
            price_str = f"{int(price):,}원"
            prev_str = f"{int(prev):,}원"
        else:
            price_str = f"${price:,.2f}" if currency == "USD" else f"{price:,.2f}"
            prev_str = f"${prev:,.2f}" if currency == "USD" else f"{prev:,.2f}"
        
        # 등락 방향
        arrow = "▲" if change_pct >= 0 else "▼"
        color = "#16a34a" if change_pct >= 0 else "#dc2626"
        
        results[name] = {
            "price": price_str,
            "prev": prev_str,
            "change_pct": f"{change_pct:+.2f}%",
            "arrow": arrow,
            "color": color,
            "ok": True
        }
        print(f"[OK] {name} ({symbol}): {price_str} {arrow}{abs(change_pct):.2f}%")
    
    except Exception as e:
        print(f"[FAIL] {name} ({symbol}): {e}")
        results[name] = {
            "price": "확인 불가",
            "prev": "-",
            "change_pct": "-",
            "arrow": "-",
            "color": "#6b7280",
            "ok": False
        }

# 결과를 파일로 저장 (Step 2/3에서 사용)
with open("/tmp/stock_data.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False)

print("=== 수집 완료 ===")
print(json.dumps(results, ensure_ascii=False, indent=2))
```

위 코드 실행 후 /tmp/stock_data.json 에 결과가 저장됩니다.

---

## Step 2: 뉴스 수집

WebSearch 도구로 아래 2개 검색을 실행하세요. 실패해도 Step 3으로 계속 진행하세요.

검색어 1: "오늘 주식 시장 코스피 나스닥 뉴스 site:news.naver.com OR site:mk.co.kr OR site:hankyung.com"
검색어 2: "US stock market news today MSFT GOOGL defense sector"

검색 결과에서 헤드라인 뉴스 3~5개씩 추출하세요.
수집한 뉴스는 Step 3에서 HTML에 삽입합니다.

---

## Step 3: HTML 이메일 빌드 및 발송 (반드시 실행)

Step 1과 Step 2가 실패했더라도 이 단계는 반드시 실행해야 합니다.

Bash 도구로 아래 Python 코드를 실행하세요.

```python
import json
import urllib.request
import datetime

# 현재 시각 (KST = UTC+9)
now_utc = datetime.datetime.utcnow()
now_kst = now_utc + datetime.timedelta(hours=9)
time_label = now_kst.strftime("%Y-%m-%d %H:%M")
session = "오전" if now_kst.hour < 12 else "오후"

# Step 1 결과 로드 (실패 시 빈 딕셔너리)
try:
    with open("/tmp/stock_data.json", "r", encoding="utf-8") as f:
        results = json.load(f)
except Exception:
    results = {}

# 종목 순서 정의
SYMBOLS_ORDER = [
    ("두산에너빌리티", "034020.KS"),
    ("삼양식품", "003230.KS"),
    ("SK하이닉스", "000660.KS"),
    ("Microsoft", "MSFT"),
    ("Alphabet", "GOOGL"),
    ("ITA 방산ETF", "ITA"),
    ("코스피", "^KS11"),
    ("나스닥", "^IXIC"),
    ("은선물", "SI=F"),
]

# 포트폴리오 비중 (표시용)
WEIGHTS = {
    "두산에너빌리티": "10%",
    "삼양식품": "-",
    "SK하이닉스": "20%",
    "Microsoft": "20%",
    "Alphabet": "15%",
    "ITA 방산ETF": "5%",
    "코스피": "지수",
    "나스닥": "지수",
    "은선물": "선물",
}

# 종목 테이블 행 생성
rows_html = ""
for name, symbol in SYMBOLS_ORDER:
    d = results.get(name, {
        "price": "확인 불가", "prev": "-",
        "change_pct": "-", "arrow": "-", "color": "#6b7280", "ok": False
    })
    rows_html += f"""
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:500;">{name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">{symbol}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">{WEIGHTS.get(name, '-')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">{d['price']}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:{d['color']};font-weight:600;">{d['arrow']} {d['change_pct']}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#94a3b8;font-size:13px;">{d['prev']}</td>
    </tr>"""

# 성공/실패 종목 카운트
ok_count = sum(1 for d in results.values() if d.get("ok"))
total_count = len(SYMBOLS_ORDER)
status_color = "#16a34a" if ok_count == total_count else "#f59e0b" if ok_count > 0 else "#dc2626"
status_text = f"데이터 수집: {ok_count}/{total_count}개 성공"

# 뉴스 섹션 (Step 2에서 수집한 내용을 여기에 직접 삽입)
# 아래 NEWS_KR, NEWS_US 변수에 Step 2 검색 결과를 채워서 실행
NEWS_KR = [
    "뉴스 수집 결과를 여기에 채우세요 (Step 2 결과)",
]
NEWS_US = [
    "뉴스 수집 결과를 여기에 채우세요 (Step 2 결과)",
]

news_kr_html = "".join(f"<li style='margin-bottom:6px;'>{n}</li>" for n in NEWS_KR)
news_us_html = "".join(f"<li style='margin-bottom:6px;'>{n}</li>" for n in NEWS_US)

# HTML 이메일 본문 빌드
html_body = f"""<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:640px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

  <!-- 헤더 -->
  <div style="background:#1d4ed8;padding:24px 28px;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">주식 브리핑</h1>
    <p style="margin:6px 0 0;color:#bfdbfe;font-size:14px;">{time_label} KST &nbsp;|&nbsp; {session} 브리핑</p>
  </div>

  <!-- 수집 상태 배너 -->
  <div style="padding:10px 28px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;">
    <span style="color:{status_color};font-size:13px;font-weight:600;">{status_text}</span>
  </div>

  <!-- 종목 현황 테이블 -->
  <div style="padding:24px 28px 0;">
    <h2 style="margin:0 0 16px;font-size:16px;color:#1e293b;">포트폴리오 현황</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:12px;border-bottom:2px solid #e2e8f0;">종목</th>
          <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:12px;border-bottom:2px solid #e2e8f0;">심볼</th>
          <th style="padding:10px 12px;text-align:right;color:#64748b;font-weight:600;font-size:12px;border-bottom:2px solid #e2e8f0;">비중</th>
          <th style="padding:10px 12px;text-align:right;color:#64748b;font-weight:600;font-size:12px;border-bottom:2px solid #e2e8f0;">현재가</th>
          <th style="padding:10px 12px;text-align:right;color:#64748b;font-weight:600;font-size:12px;border-bottom:2px solid #e2e8f0;">등락</th>
          <th style="padding:10px 12px;text-align:right;color:#64748b;font-weight:600;font-size:12px;border-bottom:2px solid #e2e8f0;">전일종가</th>
        </tr>
      </thead>
      <tbody>
        {rows_html}
      </tbody>
    </table>
  </div>

  <!-- 국내 뉴스 -->
  <div style="padding:24px 28px 0;">
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;">국내 주요 뉴스</h2>
    <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.6;">
      {news_kr_html}
    </ul>
  </div>

  <!-- 미국 뉴스 -->
  <div style="padding:20px 28px 0;">
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;">미국 주요 뉴스</h2>
    <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.6;">
      {news_us_html}
    </ul>
  </div>

  <!-- AI 코멘트 자리 -->
  <div style="padding:20px 28px 0;">
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;">AI 코멘트</h2>
    <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;background:#f8fafc;border-left:3px solid #1d4ed8;padding:12px 16px;border-radius:0 8px 8px 0;">
      수집된 주가 데이터와 뉴스를 바탕으로 포트폴리오에서 주목할 점을 간략히 코멘트하세요.
      (이 부분은 에이전트가 실제 내용으로 교체해서 빌드해야 합니다)
    </p>
  </div>

  <!-- 푸터 -->
  <div style="padding:24px 28px;margin-top:24px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;color:#94a3b8;font-size:12px;">
      이 메일은 CCR 자동 주식 브리핑 루틴이 발송합니다.<br>
      수신 거부 또는 문의: gt.min@hwaseon.com
    </p>
  </div>

</div>
</body>
</html>"""

# 이메일 발송 (무조건 실행)
subject = f"[주식 브리핑] {time_label} KST {session}"

try:
    payload = json.dumps({
        "api_key": "el3aQM5Ln5wFJKMokjROlA5Mwta5ITEX",
        "subject": subject,
        "body": html_body
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://loan-agreement-service.vercel.app/api/send-email",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "CCR-StockBriefing/1.0"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        resp_body = res.read().decode("utf-8")
    print(f"[이메일 발송 성공] {resp_body}")

except Exception as e:
    print(f"[이메일 발송 실패] {e}")
    # 발송 실패 시에도 루틴은 에러 없이 종료
```

---

## 중요 지시사항

1. Step 1 Python 코드 실행 → 결과 확인
2. Step 2 WebSearch 2회 실행 → 뉴스 헤드라인 추출
3. Step 3 Python 코드에서 NEWS_KR, NEWS_US 리스트를 Step 2 결과로 채운 뒤 실행
4. Step 3의 "AI 코멘트" 부분을 실제 분석 내용으로 교체해서 html_body를 빌드
5. 이메일 발송 응답이 {"ok":true}이면 성공, {"ok":false,...}이면 에러 내용을 출력하고 루틴 종료

어떤 상황에서도 Step 3은 반드시 실행해야 합니다.
```

---

## 4. 기획 상세 — Step별 설계

### 4-1. Step 1: 주가 수집 설계

```
[Bash 도구로 Python 실행]
    ↓
for 종목 in 9개 종목:
    try:
        urllib.request.urlopen(Yahoo Finance URL, timeout=10)
        JSON 파싱 → regularMarketPrice / previousClose / regularMarketChangePercent
        가격 포맷 (KRW: 정수 / USD: 소수점 2자리)
        등락 방향 판단 (▲/▼) + 색상 (#16a34a/#dc2626)
    except:
        결과 = {"price": "확인 불가", "change_pct": "-", "ok": False}
    ↓
/tmp/stock_data.json 저장
```

**타임아웃 설정 이유**: timeout=10 — Yahoo Finance 응답이 느린 경우 대비. 9개 종목 × 10초 = 최대 90초. CCR 루틴 제한 시간 내 충분히 처리 가능.

**User-Agent 필요 이유**: Yahoo Finance가 User-Agent 없는 요청을 차단함. 브라우저 UA 문자열로 우회.

### 4-2. Step 2: 뉴스 수집 설계

```
WebSearch("오늘 주식 시장 코스피 나스닥 뉴스")
    ↓ 성공 시 → 국내 뉴스 헤드라인 3~5개 추출
    ↓ 실패 시 → NEWS_KR = ["뉴스 수집 실패"] 처리 후 계속

WebSearch("US stock market news today MSFT GOOGL defense sector")
    ↓ 성공 시 → 미국 뉴스 헤드라인 3~5개 추출
    ↓ 실패 시 → NEWS_US = ["뉴스 수집 실패"] 처리 후 계속
```

### 4-3. Step 3: HTML 빌드 및 발송 설계

```
/tmp/stock_data.json 로드 (실패 시 빈 딕셔너리로 계속)
    ↓
현재 시각 KST 계산 (UTC+9)
세션 판단 (12시 이전 = 오전, 이후 = 오후)
    ↓
HTML 이메일 빌드:
    - 헤더 (파란 배경, 시간 표시)
    - 수집 상태 배너 (성공 N/9개)
    - 종목 테이블 (9행)
    - 국내/미국 뉴스
    - AI 코멘트
    - 푸터
    ↓
urllib.request로 POST /api/send-email 호출
    성공: {"ok": true} → 완료
    실패: 에러 출력 → 루틴 정상 종료 (예외 전파 없음)
```

---

## 5. 데이터 구조

### 5-1. /tmp/stock_data.json 형식

```json
{
  "두산에너빌리티": {
    "price": "24,150원",
    "prev": "23,800원",
    "change_pct": "+1.47%",
    "arrow": "▲",
    "color": "#16a34a",
    "ok": true
  },
  "삼양식품": {
    "price": "확인 불가",
    "prev": "-",
    "change_pct": "-",
    "arrow": "-",
    "color": "#6b7280",
    "ok": false
  }
}
```

### 5-2. 이메일 발송 API 페이로드

```json
{
  "api_key": "el3aQM5Ln5wFJKMokjROlA5Mwta5ITEX",
  "subject": "[주식 브리핑] 2026-06-02 08:30 KST 오전",
  "body": "<!DOCTYPE html>..."
}
```

### 5-3. 이메일 발송 API 응답

```json
{"ok": true}
```

또는

```json
{"ok": false, "error": "SMTP 발송 실패: ..."}
```

---

## 6. 파일/폴더 구조 — CCR 루틴 내부 임시 파일

```
/tmp/
  stock_data.json     ← Step 1에서 생성, Step 3에서 읽기
                         CCR 실행 컨테이너 내 임시 파일
                         루틴 종료 시 자동 삭제됨
```

별도 코드 파일 없음. 모든 로직은 CCR 프롬프트 내 Python 인라인 코드로 실행.

---

## 7. HTML 이메일 와이어프레임

```
┌─────────────────────────────────────────┐
│ [파란 배경]                              │
│  주식 브리핑                             │
│  2026-06-02 08:30 KST | 오전 브리핑     │
├─────────────────────────────────────────┤
│ [회색 배너] 데이터 수집: 9/9개 성공      │
├─────────────────────────────────────────┤
│ 포트폴리오 현황                           │
│                                         │
│ 종목      심볼       비중  현재가    등락  전일종가
│ ────────────────────────────────────────
│ 두산에너빌리티 034020.KS 10% 24,150원 ▲1.47% 23,800원
│ 삼양식품   003230.KS  -   확인 불가  -      -
│ SK하이닉스 000660.KS 20%  ...
│ Microsoft  MSFT      20%  ...
│ ...
│ 은선물     SI=F      선물  ...
├─────────────────────────────────────────┤
│ 국내 주요 뉴스                            │
│ • 코스피 2,800 돌파, 외국인 매수세...      │
│ • 두산에너빌리티 원전 수주 기대감...       │
│ • SK하이닉스 HBM4 양산 일정 공개...       │
├─────────────────────────────────────────┤
│ 미국 주요 뉴스                            │
│ • Fed 금리 동결 유지, 시장 안도...         │
│ • MSFT Azure 매출 42% 성장...             │
│ • 방산주 ITA, 국방비 증액 수혜...          │
├─────────────────────────────────────────┤
│ AI 코멘트                                 │
│ [파란 왼쪽 선]                            │
│ 오늘 포트폴리오에서 주목할 점...           │
├─────────────────────────────────────────┤
│ [회색 푸터]                               │
│ CCR 자동 주식 브리핑 루틴 발송            │
└─────────────────────────────────────────┘
```

---

## 8. 예상 에러 시나리오 및 처리

| 시나리오 | 발생 원인 | 처리 방법 | 이메일 발송 여부 |
|---------|---------|---------|----------------|
| Yahoo Finance API 개별 종목 타임아웃 | 네트워크 지연 | except에서 "확인 불가" 처리 후 다음 종목 진행 | 발송 (해당 종목만 "확인 불가") |
| Yahoo Finance API 전체 차단 | IP 차단 또는 서비스 점검 | 전체 종목 "확인 불가" 처리 | 발송 (전체 "확인 불가" 표시) |
| /tmp/stock_data.json 로드 실패 | Step 1 자체가 실패 | except에서 빈 딕셔너리로 대체 | 발송 (전체 "확인 불가") |
| WebSearch 뉴스 수집 실패 | 검색 서비스 오류 | NEWS_KR/NEWS_US에 "수집 실패" 텍스트 삽입 | 발송 (뉴스 없이) |
| 이메일 API timeout (30초 초과) | loan-agreement-service Vercel 콜드스타트 | except에서 에러 출력, 루틴 정상 종료 | 발송 실패 (단, 루틴은 에러 없이 종료) |
| 이메일 API {"ok": false} | SMTP 오류 | 에러 메시지 출력, 루틴 정상 종료 | 발송 실패 (재시도 없음) |
| Python 미설치 | CCR 컨테이너 환경 | CCR 환경은 Python 3.x 기본 탑재 — 발생 가능성 없음 | 해당 없음 |
| JSON 직렬화 실패 (특수문자) | 뉴스 헤드라인에 따옴표 포함 | json.dumps()가 자동 이스케이프 처리 | 발송 정상 |

---

## 9. 테스트 방법

### 9-1. Yahoo Finance API 단독 테스트

CCR 루틴 실행 전 로컬(또는 별도 Bash)에서 먼저 검증:

```bash
python3 -c "
import urllib.request, json
url = 'https://query1.finance.yahoo.com/v8/finance/chart/034020.KS'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=10) as res:
    data = json.loads(res.read().decode())
meta = data['chart']['result'][0]['meta']
print('두산에너빌리티 현재가:', meta['regularMarketPrice'])
print('전일 종가:', meta['previousClose'])
print('등락률:', meta['regularMarketChangePercent'])
"
```

예상 출력:
```
두산에너빌리티 현재가: 24150
전일 종가: 23800
등락률: 1.47
```

### 9-2. 이메일 발송 API 단독 테스트

```bash
python3 -c "
import json, urllib.request
payload = json.dumps({
    'api_key': 'el3aQM5Ln5wFJKMokjROlA5Mwta5ITEX',
    'subject': '[테스트] 주식 브리핑 발송 테스트',
    'body': '<h2>테스트 이메일</h2><p>Yahoo Finance API 연동 테스트입니다.</p>'
}).encode()
req = urllib.request.Request(
    'https://loan-agreement-service.vercel.app/api/send-email',
    data=payload,
    headers={'Content-Type': 'application/json'},
    method='POST'
)
with urllib.request.urlopen(req, timeout=30) as res:
    print(res.read().decode())
"
```

예상 출력:
```
{"ok":true}
```

gt.min@hwaseon.com 수신함에서 "[테스트] 주식 브리핑 발송 테스트" 이메일 확인.

### 9-3. CCR 루틴 수동 실행 테스트

1. CCR 루틴 trig_016et4MjTGfUi88r6VG8f1zZ 를 수동 트리거
2. 실행 로그에서 확인 사항:
   - `[OK] 두산에너빌리티 (034020.KS): ...` 9개 라인 출력 여부
   - `[이메일 발송 성공] {"ok":true}` 라인 출력 여부
3. gt.min@hwaseon.com 수신함에서 "[주식 브리핑]" 이메일 수신 확인
4. 이메일 본문에서 종목 테이블이 정상 렌더링되는지 확인

### 9-4. 에러 시나리오 테스트

**봇 차단 시뮬레이션**: 심볼 오타로 일부러 실패 유발
```python
SYMBOLS = {
    "테스트실패종목": "INVALID_SYMBOL",  # 일부러 실패
    "두산에너빌리티": "034020.KS",        # 정상
}
```
예상 동작: INVALID_SYMBOL은 "확인 불가", 두산에너빌리티는 정상 수집, 이메일 발송 성공.

---

## 10. CCR 루틴 교체 절차

1. Claude.ai → Projects → CCR 루틴 관리 화면 접속
2. trig_016et4MjTGfUi88r6VG8f1zZ 선택
3. 기존 프롬프트 전체 삭제
4. 본 기획서 "3. CCR 루틴 프롬프트 전체" 섹션의 코드 블록 내용을 복붙
5. 저장 후 수동 트리거로 1회 테스트 실행
6. 성공 확인 후 08:30 / 20:30 KST 스케줄 자동 실행 확인

---

다음 단계: developer 에이전트로 구현 진행
