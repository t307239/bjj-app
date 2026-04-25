-- z173: Enable RLS on stripe_webhook_events (z172 forgot it!)
--
-- Supabase advisor (security) flagged this as ERROR:
--   "Table public.stripe_webhook_events is public, but RLS has not been enabled."
--
-- Only service_role should access this table. The webhook handler uses
-- service_role key (bypassing RLS by default), so enabling RLS without
-- any policy effectively locks it down for anon/authenticated.

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies = all access denied (except service_role which bypasses RLS).
-- This is the desired behavior: only the webhook handler (server-side) writes,
-- and admins reading via the SQL editor (which uses service_role) can debug.

COMMENT ON TABLE stripe_webhook_events IS
  'Stripe webhook idempotency log. RLS enabled with no policies → only service_role can read/write. z172 (added) + z173 (RLS lock).';
