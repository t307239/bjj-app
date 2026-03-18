-- Stripe Tier 2 Migration
-- Run this in Supabase Dashboard > SQL Editor

-- Add Stripe columns to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Index for webhook lookups by stripe_customer_id
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('is_pro', 'stripe_customer_id');
