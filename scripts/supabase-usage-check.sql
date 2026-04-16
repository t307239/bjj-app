-- =============================================================================
-- Supabase Usage Monitoring — 月次コストレビュー用
-- =============================================================================
-- 実行方法: Supabase Dashboard > SQL Editor にコピペ実行
-- 推奨頻度: 月1回（月初 or 月末）
-- 閾値超過時: docs/COST_PROJECTION.md の対策を参照
-- =============================================================================

-- ── 1. テーブルサイズランキング（上位10） ────────────────────────────────────
SELECT
  schemaname || '.' || tablename AS table_name,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS data_size,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename) - pg_relation_size(schemaname || '.' || tablename)) AS index_size,
  (SELECT reltuples::bigint FROM pg_class WHERE oid = (schemaname || '.' || tablename)::regclass) AS estimated_rows
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 10;

-- ── 2. DB全体サイズ ─────────────────────────────────────────────────────────
SELECT
  pg_size_pretty(pg_database_size(current_database())) AS database_size;

-- ── 3. アクティブ接続数（Supabase Pro = 60 direct + 200 pooler） ────────────
SELECT
  count(*) AS active_connections,
  state,
  usename
FROM pg_stat_activity
GROUP BY state, usename
ORDER BY count(*) DESC;

-- ── 4. ユーザー数推移（月別登録） ───────────────────────────────────────────
SELECT
  date_trunc('month', created_at) AS month,
  count(*) AS new_users,
  sum(count(*)) OVER (ORDER BY date_trunc('month', created_at)) AS cumulative_users
FROM auth.users
GROUP BY date_trunc('month', created_at)
ORDER BY month DESC
LIMIT 12;

-- ── 5. training_logs 月別ボリューム（最大のRead/Write対象） ──────────────────
SELECT
  date_trunc('month', created_at) AS month,
  count(*) AS new_logs,
  sum(count(*)) OVER (ORDER BY date_trunc('month', created_at)) AS cumulative_logs
FROM public.training_logs
GROUP BY date_trunc('month', created_at)
ORDER BY month DESC
LIMIT 12;

-- ── 6. Push Subscriptions 数（Web Push コスト指標） ──────────────────────────
SELECT
  count(*) AS total_push_subscriptions,
  count(DISTINCT user_id) AS unique_users_with_push
FROM public.push_subscriptions;

-- ── 7. Pro ユーザー数（収益源） ─────────────────────────────────────────────
SELECT
  count(*) FILTER (WHERE is_pro = true) AS pro_users,
  count(*) AS total_users,
  round(100.0 * count(*) FILTER (WHERE is_pro = true) / NULLIF(count(*), 0), 1) AS pro_pct
FROM public.profiles;

-- ── 8. デッドタプル（VACUUM必要性チェック） ──────────────────────────────────
SELECT
  schemaname || '.' || relname AS table_name,
  n_dead_tup AS dead_tuples,
  n_live_tup AS live_tuples,
  CASE WHEN n_live_tup > 0
    THEN round(100.0 * n_dead_tup / n_live_tup, 1)
    ELSE 0
  END AS dead_pct,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 100
ORDER BY n_dead_tup DESC
LIMIT 10;

-- ── 9. コスト閾値アラート ───────────────────────────────────────────────────
-- 以下の閾値を超えたら COST_PROJECTION.md の対策を実行:
--   DB size > 500MB → Pro plan limit考慮
--   training_logs > 100K rows → インデックス最適化検討
--   active connections > 50 → connection pooling設定確認
--   dead_pct > 20% → 手動 VACUUM 検討
SELECT
  CASE
    WHEN pg_database_size(current_database()) > 500 * 1024 * 1024 THEN '⚠️ DB size > 500MB'
    WHEN pg_database_size(current_database()) > 200 * 1024 * 1024 THEN '🟡 DB size > 200MB'
    ELSE '✅ DB size OK'
  END AS db_size_alert,
  pg_size_pretty(pg_database_size(current_database())) AS current_size;
