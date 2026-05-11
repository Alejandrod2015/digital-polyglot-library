-- Creates the public catalog tables that become the destination of the
-- Sanity -> Studio migration. Books and stories that today live in Sanity
-- (and are mirrored into src/data/books) move into these tables one book
-- at a time, behind a per-slug feature flag.
--
-- Read-only from app code; writes happen exclusively through the ETL
-- script scripts/migrateBookToStudioCatalog.ts.
--
-- IMPORTANT: This migration MUST be applied to the production DB before
-- any app code starts reading from CatalogBook / CatalogStory.

CREATE TABLE "dp_catalog_books_v1" (
  "id"              TEXT NOT NULL,
  "slug"            TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "description"     TEXT NOT NULL DEFAULT '',
  "subtitle"        TEXT,
  "cover"           TEXT NOT NULL DEFAULT '/covers/default.jpg',
  "theme"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "language"        TEXT NOT NULL,
  "variant"         TEXT,
  "region"          TEXT,
  "level"           TEXT NOT NULL,
  "cefrLevel"       TEXT,
  "topic"           TEXT,
  "formality"       TEXT,
  "audioFolder"     TEXT NOT NULL DEFAULT '',
  "storeUrl"        TEXT,
  "published"       BOOLEAN NOT NULL DEFAULT true,
  "sourceCreatedAt" TIMESTAMP(3),
  "sourceUpdatedAt" TIMESTAMP(3),
  "migratedFrom"    TEXT,
  "sanityId"        TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dp_catalog_books_v1_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dp_catalog_books_v1_slug_key" ON "dp_catalog_books_v1"("slug");
CREATE INDEX "dp_catalog_books_v1_language_level_idx" ON "dp_catalog_books_v1"("language", "level");
CREATE INDEX "dp_catalog_books_v1_published_idx" ON "dp_catalog_books_v1"("published");

CREATE TABLE "dp_catalog_stories_v1" (
  "id"               TEXT NOT NULL,
  "bookId"           TEXT NOT NULL,
  "slug"             TEXT NOT NULL,
  "position"         INTEGER NOT NULL,
  "title"            TEXT NOT NULL,
  "text"             TEXT NOT NULL,
  "audio"            TEXT NOT NULL DEFAULT '',
  "cover"            TEXT,
  "coverUrl"         TEXT,
  "topic"            TEXT,
  "tags"             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "vocab"            JSONB,
  "language"         TEXT,
  "variant"          TEXT,
  "region"           TEXT,
  "level"            TEXT,
  "cefrLevel"        TEXT,
  "formality"        TEXT,
  "overrideMetadata" BOOLEAN NOT NULL DEFAULT false,
  "sourceCreatedAt"  TIMESTAMP(3),
  "sourceUpdatedAt"  TIMESTAMP(3),
  "migratedFrom"     TEXT,
  "sanityId"         TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dp_catalog_stories_v1_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dp_catalog_stories_v1_bookId_slug_key" ON "dp_catalog_stories_v1"("bookId", "slug");
CREATE INDEX "dp_catalog_stories_v1_bookId_position_idx" ON "dp_catalog_stories_v1"("bookId", "position");

ALTER TABLE "dp_catalog_stories_v1"
  ADD CONSTRAINT "dp_catalog_stories_v1_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "dp_catalog_books_v1"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
