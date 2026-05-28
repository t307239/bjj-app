-- z262: training_logs performance indexes
--
-- Why: All training log queries filter by (user_id, date) but no composite index
-- exists. Without this, every SELECT/COUNT does a sequential scan of the entire
-- training_logs table even when filtering by user_id. At small user counts this
-- is fast, but it also hurts cold-start latency on Vercel edge.
--
-- Index 1: covering index for the most common pattern:
--   .eq("user_id", userId).order("date", { ascending: false }).range(0, 9)
--   .eq("user_id", userId).gte("date", cutoff).order("date")
-- DESC on date matches the ORDER BY direction → index-only forward scan.
CREATE INDEX IF NOT EXISTS training_logs_user_date_idx
  ON training_logs(user_id, date DESC);

-- Index 2: partial index for partner autocomplete query.
-- The partner_username fetch uses:
--   .eq("user_id", userId).not("partner_username", "is", null).neq("partner_username", "")
-- A partial index (WHERE partner_username IS NOT NULL AND partner_username <> '')
-- is small (only rows with a value) and allows an index scan instead of seq scan.
CREATE INDEX IF NOT EXISTS training_logs_user_partner_idx
  ON training_logs(user_id, partner_username)
  WHERE partner_username IS NOT NULL AND partner_username <> '';
