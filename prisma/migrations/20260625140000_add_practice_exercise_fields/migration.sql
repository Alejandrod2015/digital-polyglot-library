-- Phase-1 scaffolding for the curated practice-exercise redesign. Additive,
-- non-destructive. Backfilled lazily; nothing reads these yet.
ALTER TABLE "dp_story_practice_exercises_v1"
  ADD COLUMN "cefr" TEXT,
  ADD COLUMN "audioText" TEXT,
  ADD COLUMN "audioVoiceId" TEXT,
  ADD COLUMN "distractorSource" TEXT;
