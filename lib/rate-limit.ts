// lib/rate-limit.ts — IP+버킷 기준 슬라이딩 윈도우 rate limit (인메모리)
//
//   서버리스에서는 인스턴스별 메모리라 완벽한 전역 제한은 아니지만,
//   인증 없는 이메일 발송/생성 엔드포인트의 대량 남용(스팸·피싱·폭탄)을
//   실질적으로 크게 줄인다. 완벽한 전역 제한이 필요하면 별도 공유 스토어로 교체.

const globalForRate = globalThis as unknown as {
  __rateWindows?: Map<string, number[]>;
};

function store(): Map<string, number[]> {
  if (!globalForRate.__rateWindows) globalForRate.__rateWindows = new Map();
  return globalForRate.__rateWindows;
}

/**
 * 요청 허용 여부. true=통과, false=한도 초과(차단).
 * @param key    구분 키 (예: `create:1.2.3.4`)
 * @param limit  windowMs 동안 허용할 최대 요청 수
 * @param windowMs 윈도우(ms)
 */
export function allowRequest(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const m = store();
  const arr = (m.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    m.set(key, arr); // 정리된 배열 저장
    return false;
  }
  arr.push(now);
  m.set(key, arr);
  return true;
}
