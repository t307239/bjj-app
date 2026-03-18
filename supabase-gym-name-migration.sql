-- ============================================================
-- Migration: Add gym_name column to profiles table
-- Purpose: B2B "Trojan Horse" strategy - collect gym affiliation
--          data to trigger auto-email to gym owners when 10-20
--          students from same gym have signed up.
--
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Add gym_name column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gym_name TEXT;

-- 2. Add index for efficient gym-based queries
--    (used to group users by gym and count members)
CREATE INDEX IF NOT EXISTS idx_profiles_gym_name
  ON profiles (gym_name)
  WHERE gym_name IS NOT NULL;

-- 3. Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'gym_name';

-- ============================================================
-- Query to identify gyms with 10+ members (B2B trigger)
-- Run this periodically to find gyms ready for outreach:
-- ============================================================
-- SELECT
--   gym_name,
--   COUNT(*) as member_count,
--   MIN(created_at) as first_joined,
--   MAX(created_at) as last_joined
-- FROM profiles
-- WHERE gym_name IS NOT NULL
--   AND gym_name != ''
-- GROUP BY gym_name
-- HAVING COUNT(*) >= 10
-- ORDER BY member_count DESC;
--
-- ============================================================
-- Template email for gym owner outreach (auto-trigger at 10+):
-- ============================================================
-- Subject: Your students are using BJJ App
-- Body:
--   "Hi [Gym Owner],
--    [N] students from [GYM_NAME] are already tracking their
--    BJJ practice with BJJ App. For $49/month, you can see all
--    their training data, send curriculum pushes, and identify
--    at-risk students before they quit.
--
--    Start your 14-day free trial: bjj-app-one.vercel.app/gym"
-- ============================================================
