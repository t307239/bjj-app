-- z199: ugc_video_submissions への anon/authenticated 直接 INSERT を REVOKE
--
-- 背景:
--   旧設計 (z57 系) では anon RLS policy `ugc_insert` で INSERT を許可していたが、
--   advisor が rls_policy_always_true WARN を継続検知。
--   さらに /api/wiki/submit-video の rate limit (5 / 10min / IP) が
--   anon RLS で SELECT 不可だったため count = 0 で **fail-open** していた。
--
-- 新設計 (z199):
--   - server-side route (/api/wiki/submit-video) を createAdminClient (service_role) に切替
--   - service_role は RLS bypass するため rate limit SELECT も実際に効く
--   - anon/authenticated は直接 DB 書き込み不可 (route 経由のみ)
--   - Zod validation + IP-based rate limit + AI triage の三層防衛は従来通り
--
-- 結果:
--   - advisor rls_policy_always_true WARN 解消 (1 → 0)
--   - rate limit が実際に動作 (spam 対策強化)

DROP POLICY IF EXISTS "ugc_insert" ON public.ugc_video_submissions;
DROP POLICY IF EXISTS "allow_insert_ugc" ON public.ugc_video_submissions;

-- 直接 INSERT 権限も REVOKE (RLS だけだと GRANT 残る危険)
REVOKE INSERT ON public.ugc_video_submissions FROM anon, authenticated;
