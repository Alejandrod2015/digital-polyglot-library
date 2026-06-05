-- AlterTable
-- Adds the recurring-cast JSON column to JourneyStory (see src/lib/storyCast.ts /
-- journeyCasts.ts). Nullable, additive, no backfill. IF NOT EXISTS so it is
-- idempotent against environments where it was already applied out-of-band.
ALTER TABLE "dp_journey_stories_v1" ADD COLUMN IF NOT EXISTS "cast" JSONB;
