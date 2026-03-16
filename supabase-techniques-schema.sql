-- techniques テーブルにカラムが不足している場合は以下を実行してください
-- Supabase Dashboard > SQL Editor で実行

-- 既存テーブルへのカラム追加（存在しない場合）
ALTER TABLE techniques ADD COLUMN IF NOT EXISTS mastery_level integer DEFAULT 1 CHECK (mastery_level BETWEEN 1 AND 5);
ALTER TABLE techniques ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- profilesテーブルへのカラム追加（存在しない場合）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- profilesテーブルのupdated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
