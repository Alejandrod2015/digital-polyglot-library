-- Ground-truth per-fragment offsets captured at multi-voice generation,
-- used by the audio editor as exact block boundaries. Additive, nullable.
-- IF NOT EXISTS so it's idempotent (applied surgically now or via deploy later).
ALTER TABLE "dp_journey_stories_v1" ADD COLUMN IF NOT EXISTS "audioFragments" JSONB;
