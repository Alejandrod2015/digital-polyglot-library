-- Word-level aeneas alignments for stories from the static catalog
-- (src/data/books/*.ts). Same payload shape as
-- `dp_journey_stories_v1.audioWordTimings`. Populated by
-- `scripts/generateCatalogAudioTimings.ts`; consumed by
-- /api/mobile/audio-word-timings as a fallback when the slug isn't a
-- journey story.
CREATE TABLE IF NOT EXISTS "CatalogStoryAudioTimings" (
  "slug" TEXT NOT NULL PRIMARY KEY,
  "audioWordTimings" JSONB NOT NULL,
  "audioDurationSec" DOUBLE PRECISION,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
