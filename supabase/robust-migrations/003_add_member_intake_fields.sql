-- 003_add_member_intake_fields.sql
-- 入会時の追加項目を gym_members に追加する。
-- Why: スポーツ保険の加入手続きでフリガナが必須、年齢確認・キッズクラス判定に生年月日、
--      接触競技(柔術)の安全管理に緊急連絡先と既往症/アレルギーが必要。

alter table public.gym_members
  add column if not exists name_kana text,                    -- フリガナ
  add column if not exists birth_date date,                   -- 生年月日
  add column if not exists emergency_contact_name text,       -- 緊急連絡先 氏名
  add column if not exists emergency_contact_phone text,      -- 緊急連絡先 電話
  add column if not exists emergency_contact_relation text,   -- 緊急連絡先 続柄
  add column if not exists medical_notes text;                -- 既往症・アレルギー
