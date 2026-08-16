-- 007_split_medical_fields.sql
-- 依頼書 Section 14: 怪我・既往歴を「持病／アレルギー／怪我歴」の独立項目に分割
-- Why: 既存の medical_notes(自由記述)では緊急時に情報を素早く判別しにくい。
--      3項目に分けて管理者が一目で把握できるようにする。いずれも任意入力(NULL許容)。
--      medical_notes は既存データ保持のため残す(レガシー表示用)。
alter table public.gym_members
  add column if not exists chronic_conditions text,  -- 持病
  add column if not exists allergies          text,  -- アレルギー
  add column if not exists injury_history      text;  -- 怪我歴
