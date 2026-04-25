-- z172: Stripe webhook idempotency table
--
-- Stripe explicitly states: "Webhook endpoints should be idempotent"
-- (https://stripe.com/docs/webhooks#best-practices). The same event can
-- be delivered multiple times: on retry after non-2xx, after timeouts,
-- and during failover. Without idempotency, double-processing can:
--   - Cancel B2C Pro subscription twice (race window with B2B activation)
--   - Trigger redundant DB writes (cheap but observability noise)
--   - Mis-attribute timing in dashboards
--
-- We store every event.id we've handled. UNIQUE constraint guarantees a
-- second insert with the same id fails (PG error 23505), and the webhook
-- handler treats that as "already processed → 200 OK, skip body".
--
-- Cleanup: rows older than 30 days can be vacuumed safely (Stripe
-- doesn't redeliver events older than ~24h in practice). Cron job left
-- as a follow-up.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id        TEXT PRIMARY KEY,           -- Stripe event.id (e.g., "evt_1ABC...")
  event_type      TEXT NOT NULL,              -- e.g., "checkout.session.completed"
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Optional metadata for debugging; keep small.
  customer_id     TEXT,                       -- Stripe customer id, if known
  user_id         UUID                        -- Our profile id, if resolved
);

-- For "show me last N events" queries.
CREATE INDEX IF NOT EXISTS stripe_webhook_events_processed_at_idx
  ON stripe_webhook_events (processed_at DESC);

-- Note: no RLS — only the webhook (using service role key) writes here.
-- Read access is admin-only (service role bypasses RLS by default).
