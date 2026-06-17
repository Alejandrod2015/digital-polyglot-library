-- Per-segment operator comments for the audio editor (keyed by fragment index).
ALTER TABLE "dp_journey_stories_v1" ADD COLUMN IF NOT EXISTS "audioEditorComments" JSONB;
