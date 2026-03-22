-- Phase 3A: Skill Map (Mindmap-style technique graph)
-- technique_nodes: each node represents one BJJ technique
CREATE TABLE IF NOT EXISTS technique_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  -- position on canvas (PC react-flow)
  pos_x       FLOAT DEFAULT 0,
  pos_y       FLOAT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- technique_edges: directed edge source → target
CREATE TABLE IF NOT EXISTS technique_edges (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES technique_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES technique_nodes(id) ON DELETE CASCADE,
  label     TEXT,          -- e.g. "from guard", "counters", optional
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- prevent duplicate edges between same pair for same user
  UNIQUE (user_id, source_id, target_id)
);

-- Indexes for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_technique_nodes_user ON technique_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_technique_edges_user ON technique_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_technique_edges_source ON technique_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_technique_edges_target ON technique_edges(target_id);

-- RLS: Enable Row Level Security
ALTER TABLE technique_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE technique_edges ENABLE ROW LEVEL SECURITY;

-- SELECT: always allowed for own rows (read-only even for downgraded users)
CREATE POLICY "nodes_select_own" ON technique_nodes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "edges_select_own" ON technique_edges
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: allowed when is_pro=true OR current count <= 10 (free tier limit)
CREATE POLICY "nodes_insert_pro_or_free_limit" ON technique_nodes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      (SELECT is_pro FROM profiles WHERE id = auth.uid()) = true
      OR (SELECT COUNT(*) FROM technique_nodes WHERE user_id = auth.uid()) < 10
    )
  );

-- INSERT edges: allowed when is_pro=true OR current edge count < 15
CREATE POLICY "edges_insert_pro_or_free_limit" ON technique_edges
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      (SELECT is_pro FROM profiles WHERE id = auth.uid()) = true
      OR (SELECT COUNT(*) FROM technique_edges WHERE user_id = auth.uid()) < 15
    )
  );

-- UPDATE: pro only (position updates, name edits)
CREATE POLICY "nodes_update_pro_only" ON technique_nodes
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    (SELECT is_pro FROM profiles WHERE id = auth.uid()) = true
  );

CREATE POLICY "edges_update_pro_only" ON technique_edges
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    (SELECT is_pro FROM profiles WHERE id = auth.uid()) = true
  );

-- DELETE: pro only
CREATE POLICY "nodes_delete_pro_only" ON technique_nodes
  FOR DELETE USING (
    auth.uid() = user_id
    AND (SELECT is_pro FROM profiles WHERE id = auth.uid()) = true
  );

CREATE POLICY "edges_delete_pro_only" ON technique_edges
  FOR DELETE USING (
    auth.uid() = user_id
    AND (SELECT is_pro FROM profiles WHERE id = auth.uid()) = true
  );
