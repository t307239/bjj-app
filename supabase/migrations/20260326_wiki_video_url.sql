-- Migration: Add video_url to wiki_pages
-- Purpose: Store curated YouTube video URL per article for Related Video section
-- Populated by: bjj-wiki/scripts/youtube_enricher.py (YouTube Data API batch)
-- Frontend: bjj-app/app/wiki/[lang]/[slug]/page.tsx shows UGC CTA when null

ALTER TABLE wiki_pages
  ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Index for batch queries (non-null check for enrichment status)
CREATE INDEX IF NOT EXISTS wiki_pages_video_url_is_null
  ON wiki_pages ((video_url IS NULL))
  WHERE video_url IS NULL;

COMMENT ON COLUMN wiki_pages.video_url IS
  'YouTube embed URL (e.g. https://www.youtube.com/embed/VIDEO_ID). '
  'Shared across languages. Populated by youtube_enricher.py batch. '
  'NULL = not yet enriched → frontend shows UGC Submit Link CTA.';
