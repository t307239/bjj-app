-- z187: 1-click email unsubscribe (CAN-SPAM/GDPR/RFC 8058)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_marketing_opted_out BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.email_marketing_opted_out IS
  'z187: true なら gym-outreach (z177), onboarding-email (z186) を skip。 1-click unsubscribe で true 化。';

CREATE INDEX IF NOT EXISTS profiles_email_marketing_opted_out_idx
  ON profiles (email_marketing_opted_out)
  WHERE email_marketing_opted_out = true;
