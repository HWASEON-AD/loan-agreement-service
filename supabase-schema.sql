-- ============================================================
-- loan-agreement-service Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에서 실행
-- ============================================================

-- ── agreements ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agreements (
  id                        UUID PRIMARY KEY,
  status                    TEXT NOT NULL DEFAULT 'draft',
  amount                    BIGINT NOT NULL,
  interest_rate             DECIMAL(6,4) NOT NULL DEFAULT 0,
  start_date                DATE NOT NULL,
  end_date                  DATE NOT NULL,
  repayment_method          TEXT NOT NULL DEFAULT 'lump_sum',
  interest_day              INTEGER,
  lender                    JSONB NOT NULL,
  borrower                  JSONB NOT NULL,
  family_relation           TEXT NOT NULL DEFAULT 'other',
  lender_sign_token         TEXT NOT NULL,
  borrower_sign_token       TEXT NOT NULL,
  borrower_token_expires_at TIMESTAMPTZ,
  pdf_base64                TEXT,
  document_hash             TEXT,
  lender_signed             BOOLEAN NOT NULL DEFAULT FALSE,
  borrower_signed           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── orders ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY,
  agreement_id      UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  amount            INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  payment_key       TEXT,
  paid_at           TIMESTAMPTZ,
  cert_mail_status  TEXT NOT NULL DEFAULT 'pending',
  cert_mail_sent_at TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── otp_codes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_codes (
  id            UUID PRIMARY KEY,
  agreement_id  UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  signer_type   TEXT NOT NULL,
  email         TEXT NOT NULL,
  code          TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used          BOOLEAN NOT NULL DEFAULT FALSE,
  fail_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── signature_records ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS signature_records (
  id                      UUID PRIMARY KEY,
  agreement_id            UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  signer_type             TEXT NOT NULL,
  signer_name             TEXT NOT NULL,
  signer_phone_masked     TEXT NOT NULL,
  signed_at               TIMESTAMPTZ NOT NULL,
  ip_address              TEXT NOT NULL,
  user_agent              TEXT NOT NULL,
  otp_verified            BOOLEAN NOT NULL DEFAULT FALSE,
  signature_image_base64  TEXT,
  document_hash           TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 인덱스 ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agreements_borrower_token
  ON agreements (borrower_sign_token);

CREATE INDEX IF NOT EXISTS idx_agreements_lender_token
  ON agreements (lender_sign_token);

CREATE INDEX IF NOT EXISTS idx_orders_agreement_id
  ON orders (agreement_id);

CREATE INDEX IF NOT EXISTS idx_otp_agreement_signer
  ON otp_codes (agreement_id, signer_type);

CREATE INDEX IF NOT EXISTS idx_signatures_agreement
  ON signature_records (agreement_id);

-- ── RLS 활성화 (anon 접근 전면 차단) ────────────────────────
ALTER TABLE agreements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_records ENABLE ROW LEVEL SECURITY;

-- anon 키로는 직접 접근 불가 (서비스 코드는 service_role 키 사용)
CREATE POLICY "deny_anon_agreements"
  ON agreements FOR ALL TO anon USING (false);

CREATE POLICY "deny_anon_orders"
  ON orders FOR ALL TO anon USING (false);

CREATE POLICY "deny_anon_otp"
  ON otp_codes FOR ALL TO anon USING (false);

CREATE POLICY "deny_anon_signatures"
  ON signature_records FOR ALL TO anon USING (false);
