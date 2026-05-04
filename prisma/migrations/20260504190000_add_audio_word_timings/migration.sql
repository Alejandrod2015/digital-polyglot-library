-- Adds optional word-level alignment payload for new Karaoke-style highlight reader.
-- Existing rows stay NULL; legacy reader path ignores this column entirely.
ALTER TABLE "dp_journey_stories_v1" ADD COLUMN IF NOT EXISTS "audioWordTimings" JSONB;
