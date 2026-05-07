-- Adds optional dialect, register, generation, cultural, and voice provenance
-- metadata to journey stories. All fields are optional; existing rows stay
-- empty (NULL or empty array) until the editorial workflow backfills them.
-- These fields are the foundation for the dialect / heritage-learner
-- positioning and for asset-grade tagging of the story corpus.
--
-- IMPORTANT: This migration MUST be applied to the production DB before the
-- corresponding schema.prisma change ships. After deploy, prisma.journeyStory
-- queries (findUnique, findMany without explicit select) include these
-- columns and would fail with "column does not exist" if the DB is behind.

ALTER TABLE "dp_journey_stories_v1" ADD COLUMN IF NOT EXISTS "register" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "dp_journey_stories_v1" ADD COLUMN IF NOT EXISTS "generationCohort" TEXT;
ALTER TABLE "dp_journey_stories_v1" ADD COLUMN IF NOT EXISTS "culturalTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "dp_journey_stories_v1" ADD COLUMN IF NOT EXISTS "voiceProvenance" JSONB;
