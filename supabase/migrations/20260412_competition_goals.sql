-- Competition countdown: upcoming competition goals with target dates
CREATE TABLE IF NOT EXISTS competition_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  date date NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE competition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own competition goals"
  ON competition_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own competition goals"
  ON competition_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own competition goals"
  ON competition_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own competition goals"
  ON competition_goals FOR DELETE
  USING (auth.uid() = user_id);

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_competition_goals_user_date
  ON competition_goals (user_id, date);
