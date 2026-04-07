-- T-31: Target weight tracker
-- Add target_weight and target_weight_date columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS target_weight numeric,
  ADD COLUMN IF NOT EXISTS target_weight_date date;
