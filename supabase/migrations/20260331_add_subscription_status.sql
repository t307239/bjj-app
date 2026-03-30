-- Add subscription_status column to profiles
-- Used by Stripe webhook to track payment state:
--   'active'   — subscription healthy
--   'past_due' — invoice.payment_failed (Stripe retrying)
--   'canceled' — customer.subscription.deleted

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active'
  CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing'));

-- Index for webhook updates (lookup by stripe_customer_id)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
