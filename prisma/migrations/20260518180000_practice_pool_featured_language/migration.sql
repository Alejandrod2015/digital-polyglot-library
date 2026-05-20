-- Practice exercise pool unification: turn StoryPracticeExercise from a
-- "10 fixed end-of-story items" set into a global pool that BOTH the
-- end-of-story screen AND the Practice tab can pull from.
--
-- - `featured`: marks the 10 (or N) exercises that show end-of-story.
--   The rest live in the pool and only surface in the Practice tab.
-- - `language`: denormalized from JourneyStory.journey.language so the
--   Practice tab can query the pool by language without joining 3 tables
--   per request.
--
-- Backfill keeps existing data working: every current exercise becomes
-- featured (so the 10-item end-of-story screen continues to render
-- exactly the same set today), and language is filled from the journey
-- so by-language queries work immediately on rollout.

ALTER TABLE "dp_story_practice_exercises_v1"
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "language" TEXT;

UPDATE "dp_story_practice_exercises_v1" e
SET "language" = j.language
FROM "dp_story_practice_sets_v1" s
JOIN "dp_journey_stories_v1" js ON js.id = s."storyId"
JOIN "dp_journeys_v1" j ON j.id = js."journeyId"
WHERE e."setId" = s.id
  AND e."language" IS NULL;

CREATE INDEX IF NOT EXISTS "dp_story_practice_exercises_v1_language_idx"
  ON "dp_story_practice_exercises_v1" ("language");

CREATE INDEX IF NOT EXISTS "dp_story_practice_exercises_v1_featured_idx"
  ON "dp_story_practice_exercises_v1" ("featured");

-- Composite index used by the Practice tab's "give me a random exercise
-- for word X in language Y" query path. Word + language is the natural
-- pool lookup key.
CREATE INDEX IF NOT EXISTS "dp_story_practice_exercises_v1_word_language_idx"
  ON "dp_story_practice_exercises_v1" ("word", "language");
