-- Add nullable `synopsis` column to dp_catalog_stories_v1 so catalog
-- stories can carry a short editorial blurb (used by the reader preview,
-- social cards, SEO). Mirrors `synopsis` on JourneyStory + StandaloneStory
-- so all three story models converge.
--
-- Safe to apply against existing data: NULL default, no backfill needed.

ALTER TABLE "dp_catalog_stories_v1" ADD COLUMN IF NOT EXISTS "synopsis" TEXT;
