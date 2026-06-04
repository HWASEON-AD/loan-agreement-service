import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const FIXED_TO = "gt.min@hwaseon.com";

const KOREAN: Record<string, { symbol: string; weight: string }> = {
  "SK하이닉스":    { symbol: "000660.KS", weight: "20%" },
  "두산에너빌리티": { symbol: "034020.KS", weight: "10%" },
  "삼양식품":      { symbol: "003230.KS", weight: "-"   },
  "코스피":        { symbol: "%5EKS11",   weight: "지수" },
};

const US: Record<string, { symbol: string; weight: string }> = {
  "Microsoft": { symbol: "MSFT",    weight: "20%" },
  "Alphabet":  { symbol: "GOOGL",   weight: "15%" },
  "ITA 방산ETF": { symbol: "ITA",   weight: "5%"  },
  "나스닥":    { symbol: "%5EIXIC", weight: "지수" },
};

const OTHER: Record<string, { symbol: string; weight: string }> = {
  "은선물": { symbol: "SI%3DF", weight: "선물" },
};

const ALL_SYMBOLS = { ...KOREAN, ...US, ...OTHER };

interface StockResult {
  price: string;
  prev: string;
  changePct: string;
  arrow: string;
  color: string;
  pctNum: number;
  ok: boolean;
}

const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://finance.yahoo.com/",
  "Origin": "https://finance.yahoo.com",
};

function fmtPrice(n: number, currency: string): string {
  return currency === "KRW"
    ? `${Math.round(n).toLocaleString("ko-KR")}원`
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function fetchStockV8(symbol: string): Promise<StockResult | null> {
  for (const base of ["https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"]) {
    try {
      const res = await fetch(`${base}/v8/finance/chart/${symbol}?interval=1d&range=1d`, {
        headers: BASE_HEADERS,
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) continue;
      const price = meta.regularMarketPrice as number;
      const prev = (meta.previousClose ?? meta.chartPreviousClose ?? price) as number;
      const pctNum = (meta.regularMarketChangePercent as number) ?? ((price - prev) / prev * 100);
      const currency = (meta.currency as string) ?? "";
      return {
        price: fmtPrice(price, currency),
        prev: fmtPrice(prev, currency),
        changePct: `${pctNum >= 0 ? "+" : ""}${pctNum.toFixed(2)}%`,
        arrow: pctNum >= 0 ? "▲" : "▼",
        color: pctNum >= 0 ? "#16a34a" : "#dc2626",
        pctNum,
        ok: true,
      };
    } catch { continue; }
  }
  return null;
}

async function fetchStockV11(symbol: string): Promise<StockResult | null> {
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v11/finance/quoteSummary/${symbol}?modules=price`,
      { headers: BASE_HEADERS, signal: AbortSignal.timeout(12000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.quoteSummary?.result?.[0]?.price;
    if (!p?.regularMarketPrice?.raw) return null;
    const price = p.regularMarketPrice.raw as number;
    const prev = (p.regularMarketPreviousClose?.raw as number) ?? price;
    const pctNum = ((p.regularMarketChangePercent?.raw as number) ?? 0) * 100;
    const currency = (p.currency as string) ?? "";
    return {
      price: fmtPrice(price, currency),
      prev: fmtPrice(prev, currency),
      changePct: `${pctNum >= 0 ? "+" : ""}${pctNum.toFixed(2)}%`,
      arrow: pctNum >= 0 ? "▲" : "▼",
      color: pctNum >= 0 ? "#16a34a" : "#dc2626",
      pctNum,
      ok: true,
    };
  } catch { return null; }
}

async function fetchStock(symbol: string): Promise<StockResult> {
  return (await fetchStockV8(symbol)) ??
         (await fetchStockV11(symbol)) ??
         { price: "확인 불가", prev: "-", changePct: "-", arrow: "-", color: "#6b7280", pctNum: 0, ok: false };
}

// 주가 데이터를 텍스트로 변환 (AI 프롬프트용)
function toText(group: Record<string, { symbol: string; weight: string }>, results: Record<string, StockResult>): string {
  return Object.entries(group)
    .map(([name, { weight }]) => {
      const d = results[name];
      if (!d?.ok) return `- ${name}(${weight}): 데이터 없음`;
      return `- ${name}(${weight}): ${d.price}, 전일 대비 ${d.arrow}${d.changePct}`;
    })
    .join("\n");
}

async function generateAnalysis(prompt: string): Promise<string> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content[0];
    return block.type === "text" ? block.text.trim() : "";
  } catch { return ""; }
}

// 테이블 HTML 생성
function buildTable(group: Record<string, { symbol: string; weight: string }>, results: Record<string, StockResult>): string {
  const TH = `style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;font-size:12px;border-bottom:2px solid #e2e8f0;"`;
  const THR = `style="padding:8px 12px;text-align:right;color:#64748b;font-weight:600;font-size:12px;border-bottom:2px solid #e2e8f0;"`;
  const rows = Object.entries(group).map(([name, { symbol, weight }]) => {
    const d = results[name] ?? { price: "확인 불가", prev: "-", changePct: "-", arrow: "-", color: "#6b7280", ok: false };
    return `<tr>
  <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;font-weight:500;">${name}</td>
  <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;">${symbol.replace(/%5E/g, "^").replace(/%3D/g, "=")}</td>
  <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#64748b;">${weight}</td>
  <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${d.price}</td>
  <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:${d.color};font-weight:600;">${d.arrow} ${d.changePct}</td>
  <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#94a3b8;font-size:12px;">${d.prev}</td>
</tr>`;
  }).join("\n");

  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
<thead><tr style="background:#f8fafc;">
  <th ${TH}>종목</th>
  <th ${TH}>심볼</th>
  <th ${THR}>비중</th>
  <th ${THR}>현재가</th>
  <th ${THR}>등락</th>
  <th ${THR}>전일종가</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>`;
}

function analysisBox(text: string): string {
  if (!text) return "";
  const lines = text.split("\n").map(l => `<p style="margin:4px 0;line-height:1.6;">${l}</p>`).join("");
  return `<div style="background:#f0f7ff;border-left:4px solid #1d4ed8;border-radius:6px;padding:14px 16px;margin-bottom:20px;font-size:14px;color:#1e293b;">
  <div style="font-weight:700;color:#1d4ed8;margin-bottom:8px;font-size:13px;">AI 분석</div>
  ${lines}
</div>`;
}

function sectionTitle(text: string): string {
  return `<h2 style="margin:24px 0 12px;font-size:15px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">${text}</h2>`;
}

function wrapHtml(title: string, subtitle: string, body: string, okCount: number, total: number): string {
  const statusColor = okCount >= total - 1 ? "#16a34a" : okCount > 0 ? "#f59e0b" : "#dc2626";
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:660px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <div style="background:#1d4ed8;padding:24px 28px;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">${title}</h1>
    <p style="margin:6px 0 0;color:#bfdbfe;font-size:14px;">${subtitle}</p>
  </div>
  <div style="padding:6px 28px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;">
    <span style="color:${statusColor};font-size:12px;font-weight:600;">데이터 수집 ${okCount}/${total}개 성공</span>
  </div>
  <div style="padding:24px 28px;">${body}</div>
  <div style="padding:16px 28px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;color:#94a3b8;font-size:12px;">CCR 자동 주식 브리핑 | 투자 참고용</p>
  </div>
</div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") ??
    (await req.json().catch(() => ({}))).api_key;
  if (!process.env.EMAIL_API_KEY || apiKey !== process.env.EMAIL_API_KEY) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 주가 병렬 수집
  const entries = Object.entries(ALL_SYMBOLS);
  const settled = await Promise.allSettled(entries.map(([, { symbol }]) => fetchStock(symbol)));
  const results: Record<string, StockResult> = {};
  entries.forEach(([name], i) => {
    const r = settled[i];
    results[name] = r.status === "fulfilled" ? r.value :
      { price: "확인 불가", prev: "-", changePct: "-", arrow: "-", color: "#6b7280", pctNum: 0, ok: false };
  });

  const okCount = Object.values(results).filter(r => r.ok).length;
  const total = entries.length;

  // KST 시간 계산
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const timeLabel = nowKst.toISOString().replace("T", " ").slice(0, 16);
  const kstHour = nowKst.getUTCHours();
  const isMorning = kstHour < 12;

  let html: string;
  let subject: string;

  if (isMorning) {
    // 오전 8:30 — 전날 국장 + 미장 종합 분석
    const krText = toText(KOREAN, results);
    const usText = toText(US, results);
    const otherText = toText(OTHER, results);

    const analysis = await generateAnalysis(
      `다음은 오늘 아침 포트폴리오 주가 데이터입니다.\n\n[국장]\n${krText}\n\n[미장]\n${usText}\n\n[기타]\n${otherText}\n\n국장과 미장 각각 주요 동향을 2줄씩 요약하고, 오늘 포트폴리오 관점에서 주목할 점 1가지를 간결하게 코멘트해주세요. 총 5줄 이내로.`
    );

    const body =
      analysisBox(analysis) +
      sectionTitle("🇰🇷 국장 (한국)") + buildTable(KOREAN, results) +
      sectionTitle("🇺🇸 미장 (미국)") + buildTable(US, results) +
      sectionTitle("기타") + buildTable(OTHER, results);

    subject = `[주식 브리핑] 오전 ${timeLabel} KST — 전날 종합`;
    html = wrapHtml("주식 브리핑 — 전날 종합", `${timeLabel} KST | 오전 브리핑`, body, okCount, total);

  } else {
    // 오후 8:30 — 국장/미장 각각 분석
    const krText = toText(KOREAN, results);
    const usText = toText(US, results);

    const [krAnalysis, usAnalysis] = await Promise.all([
      generateAnalysis(`다음은 오늘 국장(한국 주식) 현황입니다.\n\n${krText}\n\n주요 동향을 3줄 이내로 간결하게 분석해주세요.`),
      generateAnalysis(`다음은 현재 미장(미국 주식) 현황입니다.\n\n${usText}\n\n주요 동향을 3줄 이내로 간결하게 분석해주세요.`),
    ]);

    const body =
      sectionTitle("🇰🇷 국장 (한국)") +
      analysisBox(krAnalysis) + buildTable(KOREAN, results) +
      sectionTitle("🇺🇸 미장 (미국)") +
      analysisBox(usAnalysis) + buildTable(US, results) +
      sectionTitle("기타") + buildTable(OTHER, results);

    subject = `[주식 브리핑] 오후 ${timeLabel} KST — 국장/미장 현황`;
    html = wrapHtml("주식 브리핑 — 국장/미장 현황", `${timeLabel} KST | 오후 브리핑`, body, okCount, total);
  }

  // 이메일 발송
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    return NextResponse.json({ ok: false, error: "SMTP not configured" }, { status: 500 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.worksmobile.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: true },
    });
    await transporter.sendMail({ from: smtpUser, to: FIXED_TO, subject, html });
    return NextResponse.json({ ok: true, collected: okCount, total, session: isMorning ? "오전" : "오후" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
