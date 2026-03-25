-- Fix: security_definer_view + function_search_path_mutable warnings
-- =========================================================
-- Supabase Security Advisor flagged two additional issues:
--
-- 1. security_definer_view (Error)
--    public.gym_member_stats view was created without SECURITY INVOKER,
--    so it runs with the definer's privileges instead of the caller's.
--    Fix: Recreate with WITH (security_invoker = on)
--
-- 2. function_search_path_mutable (Warning) — 2 functions
--    Functions without a fixed search_path are vulnerable to search_path
--    injection attacks. Fix: SET search_path = public on each function.
-- =========================================================

-- Fix 1: Recreate gym_member_stats with security_invoker = on
CREATE OR REPLACE VIEW public.gym_member_stats WITH (security_invoker = on) AS
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

GRANT SELECT ON public.gym_member_stats TO authenticated;

-- Fix 2: Lock down search_path on gyms_with_member_counts
ALTER FUNCTION public.gyms_with_member_counts() SET search_path = public;

-- Fix 3: Lock down search_path on handle_new_user
ALTER FUNCTION public.handle_new_user() SET search_path = public;
