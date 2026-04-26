-- z192: Paid conversion attribution

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paid_ref TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_plan TEXT;

CREATE INDEX IF NOT EXISTS profiles_paid_ref_idx
  ON profiles (paid_ref) WHERE paid_ref IS NOT NULL;
