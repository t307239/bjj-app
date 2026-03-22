-- Phase 3B: B2B Gym Dashboard
-- =============================================================
-- 1. gyms table
-- =============================================================
CREATE TABLE IF NOT EXISTS gyms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  invite_code  TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  is_active    BOOLEAN DEFAULT false, -- true after Stripe payment
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gyms_owner ON gyms(owner_id);
CREATE INDEX IF NOT EXISTS idx_gyms_invite_code ON gyms(invite_code);

-- =============================================================
-- 2. Add columns to profiles
-- =============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gym_id         UUID REFERENCES gyms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_gym_owner   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_data_with_gym BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS locale         TEXT DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_profiles_gym_id ON profiles(gym_id);

-- =============================================================
-- 3. RLS for gyms
-- =============================================================
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;

-- Anyone can read a gym by invite_code (needed for join flow)
CREATE POLICY "gyms_select_by_invite" ON gyms
  FOR SELECT USING (true); -- filtered in app by invite_code

-- Only owner can insert/update/delete their gym
CREATE POLICY "gyms_insert_owner" ON gyms
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "gyms_update_owner" ON gyms
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "gyms_delete_owner" ON gyms
  FOR DELETE USING (auth.uid() = owner_id);

-- =============================================================
-- 4. RLS view helper: gym_members
-- A gym owner can see profiles of members who opted in
-- =============================================================
-- NOTE: RLS on profiles already restricts users to their own row.
-- The gym owner reads via Supabase with service role on server-side,
-- or we create a secure view:

CREATE OR REPLACE VIEW gym_member_stats AS
SELECT
  p.id AS student_id,
  p.gym_id,
  p.belt,
  p.stripe AS stripe_count,
  -- Masked display name: show full name for owner queries
  (SELECT display_name FROM auth.users WHERE id = p.id) AS display_name,
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

-- Grant SELECT on the view to authenticated users (RLS applied via base table)
GRANT SELECT ON gym_member_stats TO authenticated;
