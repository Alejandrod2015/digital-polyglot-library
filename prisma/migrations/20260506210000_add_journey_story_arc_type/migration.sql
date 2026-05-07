-- Adds optional narrative-arc tag (verb / unspoken-subtext / late-reveal / etc.)
-- so the journey can enforce variety mechanically rather than perceptually.
-- Existing rows stay NULL until the assistant backfills them.
ALTER TABLE "dp_journey_stories_v1" ADD COLUMN IF NOT EXISTS "arcType" TEXT;
