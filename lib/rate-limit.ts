// 간단한 인메모리 레이트리밋 (서버리스 단일 인스턴스 기준 best-effort)
// - 분산(멀티 인스턴스) 환경에서는 인스턴스별로 카운트가 분리되어 완벽하지 않으나,
//   무인증 남용(이메일 폭탄·브루트포스·스팸)을 크게 줄이는 1차 방어선으로 사용한다.
// - 강한 보증이 필요하면 Supabase/Upstash 등 공유 저장소 기반으로 교체 권장.

type Bucket = { count: number; resetAt: number };

const globalForRL = globalThis as unknown as {
  __rlMap?: Map<string, Bucket>;
};

function getMap(): Map<string, Bucket> {
  if (!globalForRL.__rlMap) globalForRL.__rlMap = new Map();
  return globalForRL.__rlMap;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number; // 초
}

// key 별로 windowMs 동안 최대 limit 회 허용. 초과 시 ok=false + retryAfter(초).
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const map = getMap();
  const bucket = map.get(key);

  if (!bucket || now >= bucket.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfter: 0 };
}
