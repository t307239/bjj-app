-- z196 (F-6): service-role only tables から anon/authenticated を REVOKE

REVOKE SELECT ON stripe_webhook_events FROM anon;
REVOKE SELECT ON onboarding_emails_log FROM anon;
REVOKE SELECT ON email_send_log FROM anon;

REVOKE INSERT, UPDATE, DELETE ON stripe_webhook_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON onboarding_emails_log FROM anon;
REVOKE INSERT, UPDATE, DELETE ON email_send_log FROM anon;

REVOKE SELECT, INSERT, UPDATE, DELETE ON stripe_webhook_events FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON onboarding_emails_log FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON email_send_log FROM authenticated;
