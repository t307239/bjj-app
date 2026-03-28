-- Optimize RLS policies: extract subqueries into stable helper functions.
-- This avoids repeated SELECT + COUNT inside INSERT/UPDATE/DELETE policies
-- for technique_nodes and technique_edges, reducing per-statement overhead.

-- ─── Helper: check if user is Pro ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_user_pro(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COALESCE(
    (SELECT is_pro FROM profiles WHERE id = p_user_id),
    false
  );
$$;

-- ─── Helper: check if user can insert technique node (Pro OR < 10 nodes) ──────
CREATE OR REPLACE FUNCTION can_insert_technique_node(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    is_user_pro(p_user_id)
    OR (SELECT COUNT(*) FROM technique_nodes WHERE user_id = p_user_id) < 10;
$$;

-- ─── Helper: check if user can insert technique edge (Pro OR < 15 edges) ──────
CREATE OR REPLACE FUNCTION can_insert_technique_edge(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    is_user_pro(p_user_id)
    OR (SELECT COUNT(*) FROM technique_edges WHERE user_id = p_user_id) < 15;
$$;

-- ─── Replace RLS policies with function-based versions ────────────────────────

-- DROP old INSERT policies
DROP POLICY IF EXISTS "nodes_insert_pro_or_free_limit" ON technique_nodes;
DROP POLICY IF EXISTS "edges_insert_pro_or_free_limit" ON technique_edges;

-- CREATE new INSERT policies using helper functions
CREATE POLICY "nodes_insert_pro_or_free_limit" ON technique_nodes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND can_insert_technique_node(auth.uid())
  );

CREATE POLICY "edges_insert_pro_or_free_limit" ON technique_edges
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND can_insert_technique_edge(auth.uid())
  );

-- DROP old UPDATE policies
DROP POLICY IF EXISTS "nodes_update_pro_only" ON technique_nodes;
DROP POLICY IF EXISTS "edges_update_pro_only" ON technique_edges;

-- CREATE new UPDATE policies using helper function
CREATE POLICY "nodes_update_pro_only" ON technique_nodes
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (is_user_pro(auth.uid()));

CREATE POLICY "edges_update_pro_only" ON technique_edges
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (is_user_pro(auth.uid()));

-- DROP old DELETE policies
DROP POLICY IF EXISTS "nodes_delete_pro_only" ON technique_nodes;
DROP POLICY IF EXISTS "edges_delete_pro_only" ON technique_edges;

-- CREATE new DELETE policies using helper function
CREATE POLICY "nodes_delete_pro_only" ON technique_nodes
  FOR DELETE USING (
    auth.uid() = user_id
    AND is_user_pro(auth.uid())
  );

CREATE POLICY "edges_delete_pro_only" ON technique_edges
  FOR DELETE USING (
    auth.uid() = user_id
    AND is_user_pro(auth.uid())
  );
