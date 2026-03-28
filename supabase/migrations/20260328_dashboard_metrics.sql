-- Dashboard metrics aggregation function
-- Replaces 6 separate COUNT/SUM queries with a single RPC call.
-- Uses SECURITY INVOKER to inherit the caller's RLS policies.

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_user_id UUID,
  p_month_start TEXT,
  p_prev_month_start TEXT,
  p_week_start TEXT
)
RETURNS TABLE(
  month_count BIGINT,
  prev_month_count BIGINT,
  week_count BIGINT,
  technique_count BIGINT,
  total_count BIGINT,
  month_total_mins BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    -- Current month sessions
    (SELECT COUNT(*) FROM training_logs
     WHERE user_id = p_user_id AND date >= p_month_start) AS month_count,
    -- Previous month sessions
    (SELECT COUNT(*) FROM training_logs
     WHERE user_id = p_user_id AND date >= p_prev_month_start AND date < p_month_start) AS prev_month_count,
    -- Current week sessions
    (SELECT COUNT(*) FROM training_logs
     WHERE user_id = p_user_id AND date >= p_week_start) AS week_count,
    -- Total techniques
    (SELECT COUNT(*) FROM techniques
     WHERE user_id = p_user_id) AS technique_count,
    -- Total sessions
    (SELECT COUNT(*) FROM training_logs
     WHERE user_id = p_user_id) AS total_count,
    -- Month total minutes
    (SELECT COALESCE(SUM(duration_min), 0) FROM training_logs
     WHERE user_id = p_user_id AND date >= p_month_start) AS month_total_mins;
$$;
