-- 004_add_blood_type.sql
-- 依頼書 Section 3: 血液型 A/B/O/AB を会員情報に追加。
-- Why: 接触競技(柔術)の緊急時対応で血液型が有用。緊急連絡先・既往症と同じ安全管理項目。
--      NULL 許容(任意入力)、値は 4 種のみに CHECK 制約で限定して不正値混入を防ぐ。
alter table public.gym_members
  add column if not exists blood_type text
  check (blood_type is null or blood_type in ('A','B','O','AB'));
