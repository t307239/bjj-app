-- T-29: SkillMap position filter + edge notes
-- Add tags[] to technique_nodes for position-based filtering
-- Add notes text to technique_edges for edge annotations

ALTER TABLE technique_nodes
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

ALTER TABLE technique_edges
  ADD COLUMN IF NOT EXISTS notes text;
