-- Per-segment ElevenLabs regenerate counter for the audio editor (caps spend at 3/segment).
ALTER TABLE "dp_journey_stories_v1" ADD COLUMN IF NOT EXISTS "audioEditorRegenCounts" JSONB;
