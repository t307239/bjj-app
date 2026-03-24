-- Add instructor_name column to training_logs (was referenced in code but missing from DB)
ALTER TABLE training_logs ADD COLUMN IF NOT EXISTS instructor_name TEXT;
