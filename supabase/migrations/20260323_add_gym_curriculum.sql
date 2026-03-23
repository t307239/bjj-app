-- Add curriculum dispatch columns to gyms table
-- curriculum_url: BJJ Wiki URL set by the gym owner (Pro only)
-- curriculum_set_at: when the curriculum was last dispatched
-- Members check if curriculum_set_at is within last 7 days to show the card

ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS curriculum_url    TEXT,
  ADD COLUMN IF NOT EXISTS curriculum_set_at TIMESTAMPTZ;
