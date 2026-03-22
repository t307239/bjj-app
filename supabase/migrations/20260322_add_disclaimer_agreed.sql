-- Migration: Add training_disclaimer_agreed columns to profiles
-- Purpose: Legal defense evidence for Training Disclaimer acceptance (physical risk)
-- Required by REQUIREMENTS.md (Gemini v16, 地雷2: 怪我・人身傷害免責)
--
-- Run via: supabase db push  OR  execute in Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS training_disclaimer_agreed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_disclaimer_agreed_at timestamptz DEFAULT NULL;

-- Index for audit queries (e.g. find users who agreed before a certain date)
CREATE INDEX IF NOT EXISTS idx_profiles_disclaimer_agreed_at
  ON profiles (training_disclaimer_agreed_at)
  WHERE training_disclaimer_agreed = true;

-- Comment for documentation
COMMENT ON COLUMN profiles.training_disclaimer_agreed IS
  'True when user has accepted the BJJ physical risk training disclaimer. Required for legal defense.';
COMMENT ON COLUMN profiles.training_disclaimer_agreed_at IS
  'Timestamp when user accepted the training disclaimer. Stored as legal defense evidence.';
