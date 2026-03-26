-- ─────────────────────────────────────────────────────────────────────────────
-- ugc_video_submissions テーブル
-- ユーザーが投稿した YouTube 動画 URL を保持する。
-- LLM トリアージ後に approved になったものだけ wiki_pages.video_url に反映。
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ugc_video_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 対象 wiki ページ（slug + lang で一意に特定）
  slug            TEXT NOT NULL,
  lang            TEXT NOT NULL CHECK (lang IN ('en', 'ja', 'pt')),

  -- 投稿された YouTube URL と抽出済み video ID
  youtube_url     TEXT NOT NULL,
  video_id        TEXT NOT NULL,

  -- トリアージ状態
  -- pending   → 投稿直後（DB には入るが wiki に反映されない）
  -- approved  → AI/人手レビュー通過済み → wiki_pages.video_url に反映
  -- rejected  → スパム/不適切として却下
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),

  -- AI トリアージ結果（0〜100 スコア + メモ）
  ai_score        INTEGER,
  ai_notes        TEXT,

  -- 投稿者 IP（レート制限・スパム検知用）
  submitter_ip    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ
);

-- 審査待ち一覧取得用インデックス
CREATE INDEX IF NOT EXISTS ugc_video_submissions_status_idx
  ON ugc_video_submissions (status, created_at DESC);

-- slug 別集計用インデックス
CREATE INDEX IF NOT EXISTS ugc_video_submissions_slug_idx
  ON ugc_video_submissions (slug, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS（Row Level Security）
-- 投稿は誰でも可（anonymous insert）。
-- 読み書き（管理）は service_role キーのみ。
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ugc_video_submissions ENABLE ROW LEVEL SECURITY;

-- anon / authenticated ユーザーは INSERT のみ許可（自分の行は参照不可）
CREATE POLICY "allow_insert_ugc" ON ugc_video_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT / UPDATE / DELETE は service_role のみ（バッチスクリプト用）
-- service_role は RLS をバイパスするため明示ポリシー不要。
