-- Creates the standalone stories table as the destination of the second wave
-- of the Sanity -> Studio migration. Mirrors the `standaloneStory` document
-- schema from Sanity. Read-only from app code until the dedicated ETL script
-- (scripts/migrateStandaloneStoriesToStudio.ts) populates it.
--
-- IMPORTANT: Apply this migration to production before any reader code starts
-- preferring StandaloneStory over the Sanity-backed sources.

CREATE TABLE "dp_standalone_stories_v1" (
  "id"                       TEXT NOT NULL,
  "slug"                     TEXT NOT NULL,
  "sourceType"               TEXT NOT NULL DEFAULT 'sanity',
  "createStoryId"            TEXT,
  "createStoryUserId"        TEXT,
  "language"                 TEXT,
  "variant"                  TEXT,
  "region"                   TEXT,
  "level"                    TEXT,
  "cefrLevel"                TEXT,
  "focus"                    TEXT,
  "topic"                    TEXT,
  "journeyEligible"          BOOLEAN NOT NULL DEFAULT false,
  "journeyTopic"             TEXT,
  "journeyOrder"             INTEGER,
  "journeyFocus"             TEXT,
  "title"                    TEXT NOT NULL,
  "synopsis"                 TEXT,
  "text"                     TEXT NOT NULL DEFAULT '',
  "vocabRaw"                 TEXT,
  "vocab"                    JSONB,
  "cover"                    TEXT,
  "coverUrl"                 TEXT,
  "audio"                    TEXT,
  "audioUrl"                 TEXT,
  "audioQaStatus"            TEXT,
  "audioQaScore"             DOUBLE PRECISION,
  "audioQaNotes"             TEXT,
  "audioQaTranscript"        TEXT,
  "audioQaCheckedAt"         TIMESTAMP(3),
  "audioDeliveryQaStatus"    TEXT,
  "audioDeliveryQaScore"     DOUBLE PRECISION,
  "audioDeliveryQaNotes"     TEXT,
  "audioDeliveryQaCheckedAt" TIMESTAMP(3),
  "storyVocabQualityRaw"     TEXT,
  "vocabValidationRaw"       TEXT,
  "published"                BOOLEAN NOT NULL DEFAULT false,
  "sanityId"                 TEXT,
  "migratedFrom"             TEXT,
  "sourceCreatedAt"          TIMESTAMP(3),
  "sourceUpdatedAt"          TIMESTAMP(3),
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dp_standalone_stories_v1_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dp_standalone_stories_v1_slug_key" ON "dp_standalone_stories_v1"("slug");
CREATE INDEX "dp_standalone_stories_v1_language_level_idx" ON "dp_standalone_stories_v1"("language", "level");
CREATE INDEX "dp_standalone_stories_v1_cefrLevel_idx" ON "dp_standalone_stories_v1"("cefrLevel");
CREATE INDEX "dp_standalone_stories_v1_sourceType_idx" ON "dp_standalone_stories_v1"("sourceType");
CREATE INDEX "dp_standalone_stories_v1_journey_idx" ON "dp_standalone_stories_v1"("journeyEligible", "journeyTopic", "journeyOrder");
CREATE INDEX "dp_standalone_stories_v1_published_idx" ON "dp_standalone_stories_v1"("published");
CREATE INDEX "dp_standalone_stories_v1_sanityId_idx" ON "dp_standalone_stories_v1"("sanityId");
