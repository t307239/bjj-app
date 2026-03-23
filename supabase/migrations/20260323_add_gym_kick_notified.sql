-- Add gym_kick_notified column to profiles
-- This flag drives the in-app "you were removed from gym" alert banner.
-- NULL / true = no banner needed. false = show persistent alert until dismissed.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gym_kick_notified BOOLEAN DEFAULT NULL;

-- When a gym owner kicks a member, set gym_kick_notified = false.
-- When the member dismisses the banner, set gym_kick_notified = true.
-- The dashboard checks: if gym_kick_notified = false AND gym_id IS NULL → show banner.
