-- Adds parallel `coverUrl` / `audioUrl` columns so the cdn.sanity.io -> R2
-- media migration can write the new public URL without overwriting the
-- original Sanity URL. The reader falls back: `coverUrl ?? cover` and
-- `audioUrl ?? audio`. Rolling back is a plain UPDATE setting the new
-- column to NULL.
--
-- Aditive only; no data backfill. Safe to apply to production.

ALTER TABLE "dp_catalog_books_v1" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT;
ALTER TABLE "dp_catalog_stories_v1" ADD COLUMN IF NOT EXISTS "audioUrl" TEXT;
