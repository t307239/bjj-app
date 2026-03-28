-- Migration: Referral tracking system
-- Each user gets a referral_code (first 8 chars of their ID).
-- When a referred user signs up, a row is inserted into referrals.

-- 1. Add referral_code to profiles (derived from user ID)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE DEFAULT NULL;

-- Backfill existing users: use first 8 chars of UUID
UPDATE profiles SET referral_code = LEFT(id::text, 8) WHERE referral_code IS NULL;

-- 2. Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referred_id)  -- a user can only be referred once
);

-- 3. Auto-populate referral_code for new users via trigger
CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := LEFT(NEW.id::text, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_referral_code ON profiles;
CREATE TRIGGER trg_set_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_referral_code();

-- 4. RLS for referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can read their own referrals (as referrer)
CREATE POLICY "Users can view their own referrals"
  ON referrals FOR SELECT
  USING (referrer_id = auth.uid());

-- Service role can insert (via auth callback)
CREATE POLICY "Service can insert referrals"
  ON referrals FOR INSERT
  WITH CHECK (true);

-- 5. Index for fast referral count queries
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
