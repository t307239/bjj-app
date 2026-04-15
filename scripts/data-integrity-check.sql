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
