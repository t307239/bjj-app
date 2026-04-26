-- z189: Email cron 共通の send 履歴 + 24h frequency cap

CREATE TABLE IF NOT EXISTS email_send_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type  TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_to    TEXT,
  metadata    JSONB
);

CREATE INDEX IF NOT EXISTS email_send_log_user_sent_idx
  ON email_send_log (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS email_send_log_type_sent_idx
  ON email_send_log (email_type, sent_at DESC);

ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE email_send_log IS
  'z189: 全 email cron 共通の send 履歴 + 24h frequency cap. service_role only.';
