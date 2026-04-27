-- z199b: ugc_video_submissions に deny-all policy を追加 (z198 同パターン)
--
-- 背景:
--   z199 で旧 ugc_insert policy を DROP した結果、advisor が
--   rls_enabled_no_policy INFO を新たに surface。
--
-- 対応:
--   service_role bypass のため deny-all USING (false) でも
--   /api/wiki/submit-video の動作に影響なし。多層防衛 + INFO 解消。

CREATE POLICY "deny_all_anon_authenticated"
  ON public.ugc_video_submissions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
