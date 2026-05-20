-- Per-story practice voice override. NULL = use the per-language default
-- (Paola for italian, Dora for spanish, Cadu for portuguese). Independent
-- from `voiceId`, which is the narration voice for the full story body.

ALTER TABLE "dp_journey_stories_v1"
  ADD COLUMN IF NOT EXISTS "practiceVoiceId" TEXT;
