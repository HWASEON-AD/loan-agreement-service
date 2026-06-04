import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const maxDuration = 60;

const FIXED_TO = "gt.min@hwaseon.com";

const SYMBOLS: Record<string, { symbol: string; weight: string }> = {
  "두산에너빌리티": { symbol: "034020.KS", weight: "10%" },
  "삼양식품": { symbol: "003230.KS", weight: "-" },
  "SK하이닉스": { symbol: "000660.KS", weight: "20%" },
  "Microsoft": { symbol: "MSFT", weight: "20%" },
  "Alphabet": { symbol: "GOOGL", weight: "15%" },
  "ITA 방산ETF": { symbol: "ITA", weight: "5%" },
  "코스피": { symbol: "%5EKS11", weight: "지수" },
  "나스닥": { symbol: "%5EIXIC", weight: "지수" },
  "은선물": { symbol: "SI%3DF", weight: "선물" },
};

interface StockResult {
  price: string;
  prev: string;
  changePct: string;
  arrow: string;
  color: string;
  ok: boolean;
}

const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://finance.yahoo.com/",
  "Origin": "https://finance.yahoo.com",
};

function formatPrice(n: number, currency: string): string {
  return currency === "KRW"
    ? `${Math.round(n).toLocaleString("ko-KR")}원`
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function fetchStockV8(symbol: string): Promise<StockResult | null> {
  const endpoints = [
    `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: BASE_HEADERS, signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) continue;

      const price = meta.regularMarketPrice as number;
      const prev = (meta.previousClose ?? meta.chartPreviousClose ?? price) as number;
      const changePct = (meta.regularMarketChangePercent as number) ?? ((price - prev) / prev * 100);
      const currency = (meta.currency as string) ?? "";

      return {
        price: formatPrice(price, currency),
        prev: formatPrice(prev, currency),
        changePct: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`,
        arrow: changePct >= 0 ? "▲" : "▼",
        color: changePct >= 0 ? "#16a34a" : "#dc2626",
        ok: true,
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchStockV11(symbol: string): Promise<StockResult | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v11/finance/quoteSummary/${symbol}?modules=price`;
    const res = await fetch(url, { headers: BASE_HEADERS, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.quoteSummary?.result?.[0]?.price;
    if (!p?.regularMarketPrice?.raw) return null;

    const price = p.regularMarketPrice.raw as number;
    const prev = (p.regularMarketPreviousClose?.raw as number) ?? price;
    // v11 returns decimal (0.028 = 2.8%), multiply by 100
    const changePct = ((p.regularMarketChangePercent?.raw as number) ?? 0) * 100;
    const currency = (p.currency as string) ?? "";

    return {
      price: formatPrice(price, currency),
      prev: formatPrice(prev, currency),
      changePct: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`,
      arrow: changePct >= 0 ? "▲" : "▼",
      color: changePct >= 0 ? "#16a34a" : "#dc2626",
      ok: true,
    };
  } catch {
    return null;
  }
}

async function fetchStock(_name: string, symbol: string): Promise<StockResult> {
  const result = (await fetchStockV8(symbol)) ?? (await fetchStockV11(symbol));
  return result ?? { price: "확인 불가", prev: "-", changePct: "-", arrow: "-", color: "#6b7280", ok: false };
}

function buildHtml(
  results: Record<string, StockResult>,
  timeLabel: string,
  session: string
): string {
  const okCount = Object.values(results).filter((r) => r.ok).length;
  const total = Object.keys(SYMBOLS).length;
  const statusColor = okCount >= 7 ? "#16a34a" : okCount > 0 ? "#f59e0b" : "#dc2626";

  const rows = Object.entries(SYMBOLS)
    .map(([name, { symbol, weight }]) => {
      const d = results[name] ?? { price: "확인 불가", prev: "-", changePct: "-", arrow: "-", color: "#6b7280", ok: false };
      return `<tr>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:500;">${name}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">${symbol.replace(/%5E/g, "^").replace(/%3D/g, "=")}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#64748b;">${weight}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${d.price}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:${d.color};font-weight:600;">${d.arrow} ${d.changePct}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;color:#94a3b8;font-size:13px;">${d.prev}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:640px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <div style="background:#1d4ed8;padding:24px 28px;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">주식 브리핑</h1>
    <p style="margin:6px 0 0;color:#bfdbfe;font-size:14px;">${timeLabel} KST &nbsp;|&nbsp; ${session} 브리핑</p>
  </div>
  <div style="padding:10px 28px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;">
    <span style="color:${statusColor};font-size:13px;font-weight:600;">데이터 수집: ${okCount}/${total}개 성공</span>
  </div>
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
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div style="padding:24px 28px;margin-top:24px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;color:#94a3b8;font-size:12px;">CCR 자동 주식 브리핑 | 투자 참고용</p>
  </div>
</div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") ?? (await req.json().catch(() => ({}))).api_key;
  if (!process.env.EMAIL_API_KEY || apiKey !== process.env.EMAIL_API_KEY) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const entries = Object.entries(SYMBOLS);
  const settled = await Promise.allSettled(
    entries.map(([name, { symbol }]) => fetchStock(name, symbol))
  );
  const results: Record<string, StockResult> = {};
  entries.forEach(([name], i) => {
    const r = settled[i];
    results[name] = r.status === "fulfilled" ? r.value : { price: "확인 불가", prev: "-", changePct: "-", arrow: "-", color: "#6b7280", ok: false };
  });

  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const timeLabel = nowKst.toISOString().replace("T", " ").slice(0, 16);
  const session = nowKst.getUTCHours() < 12 ? "오전" : "오후";

  const html = buildHtml(results, timeLabel, session);
  const subject = `[주식 브리핑] ${timeLabel} KST ${session}`;

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

    const okCount = Object.values(results).filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, collected: okCount, total: Object.keys(SYMBOLS).length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
