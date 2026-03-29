-- AI Micro-Coach: cache columns on profiles table
-- Apply in Supabase Dashboard > SQL Editor
-- Safe to run multiple times (IF NOT EXISTS)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_coach_cache TEXT,
  ADD COLUMN IF NOT EXISTS ai_coach_last_generated TIMESTAMPTZ;

COMMENT ON COLUMN profiles.ai_coach_cache IS
  'Cached AI coaching feedback text (Pro feature). Regenerated max once per 7 days.';
COMMENT ON COLUMN profiles.ai_coach_last_generated IS
  'Timestamp of last AI coaching generation. Used to enforce 7-day cooldown.';
