-- z173: Tighten over-permissive RLS policies flagged by Supabase advisor
--
-- Background: `get_advisors` returned 6 RLS warnings + 1 function warning.
-- The original policies were authored before Supabase added the
-- `rls_policy_always_true` linter, and many used `WITH CHECK true` with
-- `roles: public` — which technically allows anon/authenticated callers
-- to insert/update rows that should only be writable by the server-side
-- service_role.

-- 1. referrals: INSERT を referred_id = auth.uid() に絞る (なりすまし防止)
--    旧 policy は WITH CHECK (true) で誰でも任意ユーザーに紐づけ可能だった。
DROP POLICY IF EXISTS "Service can insert referrals" ON referrals;
CREATE POLICY "Users can insert their own referral attribution"
  ON referrals FOR INSERT
  TO authenticated
  WITH CHECK (referred_id = auth.uid());

-- 2. wiki_pages: INSERT/UPDATE を service_role のみに
--    Wiki content is admin-managed (GitHub Actions cron + scripts/),
--    never user-uploaded. Tightening to service_role removes the
--    theoretical risk of a logged-in user calling the REST API directly.
DROP POLICY IF EXISTS "wiki_pages_service_insert" ON wiki_pages;
DROP POLICY IF EXISTS "wiki_pages_service_update" ON wiki_pages;
CREATE POLICY "wiki_pages_service_insert"
  ON wiki_pages FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "wiki_pages_service_update"
  ON wiki_pages FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- 3. wiki_translations: 同上
DROP POLICY IF EXISTS "wiki_translations_service_insert" ON wiki_translations;
DROP POLICY IF EXISTS "wiki_translations_service_update" ON wiki_translations;
CREATE POLICY "wiki_translations_service_insert"
  ON wiki_translations FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "wiki_translations_service_update"
  ON wiki_translations FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- 4. ugc_video_submissions: 公開フォーム用。WITH CHECK true は意図的。
--    Defense-in-depth は Zod 検証 (slug/lang/url/video_id) + DB-based rate
--    limit (5 per 10min per IP) で route.ts 側で実施。
COMMENT ON POLICY "ugc_insert" ON ugc_video_submissions IS
  'INTENTIONAL: anon/authenticated insert allowed. Defense-in-depth via Zod (slug/lang/url/video_id validation) + DB-based rate limit (5 per 10min per IP) in app/api/wiki/submit-video/route.ts. RLS does not need to validate fields here.';

-- 5. set_referral_code function: search_path 固定
--    mutable search_path は SECURITY DEFINER 関数で privilege escalation の
--    余地を残す。public, pg_temp に固定して攻撃面縮小。
ALTER FUNCTION public.set_referral_code() SET search_path = public, pg_temp;
