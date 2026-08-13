// /api/cron/law-check — 주택임대차보호법 개정 여부 매일 1회 확인 (Vercel Cron)
//
// 보안: Authorization: Bearer {CRON_SECRET}
//   ★ Vercel Cron 은 **GET** 으로 호출한다. 외부 트리거(POST)도 함께 받도록 둘 다 export 한다.
//
// 동작
//   1. 법제처 공식 페이지 2곳을 그대로 받아 시행일·법률번호·조문 본문 해시를 추출
//   2. 이전 저장값과 비교 → 달라졌으면 관리자에게 메일 (자동 반영은 하지 않는다)
//   3. 파싱/네트워크 실패는 실패로 기록하고, 연속 실패가 쌓이면 메일
//      (실패를 '이상 없음'으로 표시하면 침묵 실패가 된다)

import { NextRequest, NextResponse } from "next/server";
import { runLawCheck, readLawWatch, WATCH_TARGETS } from "@/lib/law-watch";
import { sendLawWatchAlert } from "@/lib/email";

export const runtime = "nodejs";
// 외부 사이트를 받아오므로 캐시 금지
export const dynamic = "force-dynamic";

// 연속 실패가 이 횟수 이상이면 알린다 (하루 1회 실행 기준 = 3일 연속 실패)
const FAILURE_ALERT_THRESHOLD = 3;

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const result = await runLawCheck(nowIso);

  try {
    if (result.ok && result.changes.length > 0) {
      // 변경 감지 → 사람이 확인해야 한다
      await sendLawWatchAlert({
        kind: "changed",
        title: "주택임대차보호법이 변경되었을 수 있습니다",
        lines: [
          ...result.changes,
          `현재 시행일: ${result.snapshot?.effectiveDate ?? "?"}`,
          `현재 법률번호: ${result.snapshot?.lawNumber ?? "?"} (${result.snapshot?.revisionType ?? "-"})`,
        ],
        url: WATCH_TARGETS.article.url,
      });
    } else if (!result.ok) {
      const row = await readLawWatch(WATCH_TARGETS.article.key);
      const fails = row?.consecutive_failures ?? 1;
      // 매번 보내면 시끄러우므로 임계치에 도달한 순간과 그 배수에서만 보낸다
      if (fails >= FAILURE_ALERT_THRESHOLD && fails % FAILURE_ALERT_THRESHOLD === 0) {
        await sendLawWatchAlert({
          kind: "failed",
          title: `법령 확인이 ${fails}회 연속 실패했습니다`,
          lines: [
            `마지막 오류: ${result.error ?? "-"}`,
            `마지막 성공: ${row?.last_success_at ?? "기록 없음"}`,
            "법제처 페이지 구조가 바뀌었을 수 있습니다. 파서를 확인해 주세요.",
          ],
          url: WATCH_TARGETS.article.url,
        });
      }
    }
  } catch (e) {
    // 알림 실패가 확인 결과 자체를 가리지 않게 한다
    console.error("[law-check] 알림 발송 실패:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    ok: result.ok,
    checkedAt: result.checkedAt,
    effectiveDate: result.snapshot?.effectiveDate ?? null,
    lawNumber: result.snapshot?.lawNumber ?? null,
    revisionType: result.snapshot?.revisionType ?? null,
    guideOk: result.guideOk,
    guideMissing: result.guideMissing,
    changes: result.changes,
    error: result.error,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
