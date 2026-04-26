-- z186: Onboarding email sequence idempotency log
--
-- 各ユーザー × day_marker (day1/day3/day7/day14) の send 履歴を記録。
-- UNIQUE (user_id, day_marker) でロック → 同じユーザー × 同じ day で
-- 重複送信を物理的に防ぐ。

CREATE TABLE IF NOT EXISTS onboarding_emails_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_marker      TEXT NOT NULL CHECK (day_marker IN ('day1', 'day3', 'day7', 'day14')),
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  email           TEXT NOT NULL,
  locale          TEXT,
  UNIQUE (user_id, day_marker)
);

CREATE INDEX IF NOT EXISTS onboarding_emails_log_sent_at_idx
  ON onboarding_emails_log (sent_at DESC);

CREATE INDEX IF NOT EXISTS onboarding_emails_log_user_id_idx
  ON onboarding_emails_log (user_id);

ALTER TABLE onboarding_emails_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE onboarding_emails_log IS
  'Onboarding email sequence (Day 1/3/7/14) idempotency log. RLS enabled, service_role only. z186.';
