-- Q-34: Data integrity verification queries
-- Run periodically in Supabase SQL Editor to check for orphaned/inconsistent data
-- See also: docs/BACKUP_RUNBOOK.md

-- 1. Orphaned training logs (user deleted but logs remain)
SELECT tl.id, tl.user_id, tl.created_at
FROM training_logs tl
LEFT JOIN profiles p ON p.id = tl.user_id
WHERE p.id IS NULL
LIMIT 10;

-- 2. Orphaned techniques (user deleted but techniques remain)
SELECT t.id, t.user_id, t.name
FROM techniques t
LEFT JOIN profiles p ON p.id = t.user_id
WHERE p.id IS NULL
LIMIT 10;

-- 3. Soft-deleted accounts past 30-day window (should be hard-deleted)
SELECT id, display_name, deleted_at,
  (NOW() - deleted_at::timestamptz) AS age
FROM profiles
WHERE deleted_at IS NOT NULL
  AND (NOW() - deleted_at::timestamptz) > INTERVAL '30 days';

-- 4. Duplicate training logs (same user, same date, same duration)
SELECT user_id, date, duration_minutes, COUNT(*) as dupes
FROM training_logs
GROUP BY user_id, date, duration_minutes
HAVING COUNT(*) > 1;

-- 5. Table sizes and row counts (monitoring growth)
SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS row_count,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- ============================================================
-- Q-64: Extended integrity checks (2026-04-16)
-- ============================================================

-- 6. Orphaned push subscriptions (user deleted but subscriptions remain)
SELECT ps.id, ps.user_id, ps.endpoint
FROM push_subscriptions ps
LEFT JOIN profiles p ON p.id = ps.user_id
WHERE p.id IS NULL
LIMIT 10;

-- 7. Orphaned goals (user deleted but goals remain)
SELECT g.id, g.user_id, g.created_at
FROM goals g
LEFT JOIN profiles p ON p.id = g.user_id
WHERE p.id IS NULL
LIMIT 10;

-- 8. Orphaned skill map nodes (user deleted but nodes remain)
SELECT tn.id, tn.user_id, tn.label
FROM technique_nodes tn
LEFT JOIN profiles p ON p.id = tn.user_id
WHERE p.id IS NULL
LIMIT 10;

-- 9. Training logs with invalid duration (negative or impossibly long)
SELECT id, user_id, date, duration_min
FROM training_logs
WHERE duration_min < 0 OR duration_min > 1440
LIMIT 10;

-- 10. Techniques with invalid mastery level (outside 1-5 range)
SELECT id, user_id, name, mastery_level
FROM techniques
WHERE mastery_level < 1 OR mastery_level > 5
LIMIT 10;

-- 11. Profiles with is_pro=true but no active Stripe subscription
-- (Detects billing state drift)
SELECT p.id, p.display_name, p.is_pro, p.stripe_customer_id
FROM profiles p
WHERE p.is_pro = true
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM stripe_subscriptions s
    WHERE s.customer_id = p.stripe_customer_id
      AND s.status IN ('active', 'trialing')
  )
LIMIT 10;

-- 12. Future-dated training logs (date > today + 1 day)
SELECT id, user_id, date, created_at
FROM training_logs
WHERE date::date > (CURRENT_DATE + INTERVAL '1 day')
LIMIT 10;

-- 13. Push subscriptions with expired/stale endpoints (> 90 days old without update)
SELECT id, user_id, endpoint,
  (NOW() - updated_at::timestamptz) AS age
FROM push_subscriptions
WHERE updated_at < NOW() - INTERVAL '90 days'
LIMIT 10;

-- 14. Database bloat check (dead tuples indicating need for VACUUM)
SELECT
  relname AS table_name,
  n_dead_tup AS dead_tuples,
  n_live_tup AS live_tuples,
  CASE WHEN n_live_tup > 0
    THEN ROUND(100.0 * n_dead_tup / n_live_tup, 1)
    ELSE 0
  END AS dead_pct,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 100
ORDER BY n_dead_tup DESC;
