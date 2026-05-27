// Supabase 클라이언트 — Mock 모드에서는 메모리 스토어(mock-store)를 사용하므로
// 이 클라이언트는 실모드(NEXT_PUBLIC_MOCK_MODE=false + 키 설정)에서만 생성된다.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isMockMode } from "./config";

let cachedClient: SupabaseClient | null = null;

// 서버 사이드 Supabase 클라이언트 획득 (service role 키 사용)
// Mock 모드이거나 키가 없으면 null 을 반환하고, 호출부에서 mock-store 로 폴백한다.
export function getSupabaseAdmin(): SupabaseClient | null {
  if (isMockMode()) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn(
      "[Supabase] URL 또는 SERVICE_ROLE_KEY 가 없습니다. mock-store 로 폴백합니다."
    );
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }
  return cachedClient;
}
