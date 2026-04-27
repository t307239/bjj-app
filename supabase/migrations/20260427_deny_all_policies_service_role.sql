-- z198: service-role only テーブルに deny-all RLS policy を追加 (多層防衛)
--
-- 背景:
--   z196 で stripe_webhook_events / onboarding_emails_log / email_send_log の
--   GRANT SELECT/INSERT/UPDATE/DELETE を anon/authenticated から REVOKE 済。
--   ただし RLS は ENABLED のまま policy 0件で advisor INFO (rls_enabled_no_policy) 残存。
--
-- 対応:
--   service_role は RLS を bypass するため deny-all policy USING (false) でも
--   cron / Stripe webhook の動作に一切影響なし。万一 GRANT 設定ミスで anon/authenticated
--   が SELECT 権限を再取得しても返値0件になる多層防衛。
--   advisor INFO も同時解消。
--
-- 設計意図 (Top app reference):
--   Stripe / Linear / Supabase 自身も sensitive log table は 「deny-all + service_role bypass」
--   パターンを採用。GRANT 単独より安全。

CREATE POLICY "deny_all_anon_authenticated"
  ON public.stripe_webhook_events
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_all_anon_authenticated"
  ON public.onboarding_emails_log
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_all_anon_authenticated"
  ON public.email_send_log
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
