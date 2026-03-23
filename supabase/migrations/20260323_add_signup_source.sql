-- Migration: add signup_source to profiles
-- Records where a user came from when they signed up.
-- Format examples: "wiki:closed-guard", "wiki", null (direct)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signup_source TEXT DEFAULT NULL;
