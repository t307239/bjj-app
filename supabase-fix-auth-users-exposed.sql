-- Fix: auth_users_exposed security warning
-- =========================================================
-- Supabase flagged gym_member_stats view as a Critical issue:
-- It queries auth.users directly, exposing it to authenticated role via PostgREST.
--
-- Root cause (20260322_add_b2b_gym.sql line 62):
--   (SELECT display_name FROM auth.users WHERE id = p.id) AS display_name
--
-- Fix: use p.display_name from profiles instead — it already has this column.
-- =========================================================

CREATE OR REPLACE VIEW public.gym_member_stats AS
SELECT
  p.id AS student_id,
  p.gym_id,
  p.belt,
  p.stripe AS stripe_count,
  p.display_name,
  (
    SELECT MAX(date) FROM training_logs
    WHERE user_id = p.id
  ) AS last_training_date,
  (
    SELECT COUNT(*) FROM training_logs
    WHERE user_id = p.id
      AND date >= (NOW() - INTERVAL '30 days')::DATE
  ) AS sessions_last_30d
FROM profiles p
WHERE p.share_data_with_gym = true
  AND p.gym_id IS NOT NULL;

-- Re-grant SELECT to authenticated (in case it was lost in recreation)
GRANT SELECT ON public.gym_member_stats TO authenticated;
