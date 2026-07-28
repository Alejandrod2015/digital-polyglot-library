-- Los timings de karaoke del catalogo se indexaban por slug, y el slug NO es
-- unico: `el-vendedor-ambulante` existe en el libro argentino y en el
-- colombiano, asi que la segunda historia se quedaba sin karaoke. Se anade
-- la clave real (id de CatalogStory) de forma aditiva: la columna es
-- nullable, el slug sigue siendo la PK, y el backfill lo hace
-- scripts/backfillTimingStoryIds.ts.
ALTER TABLE "CatalogStoryAudioTimings" ADD COLUMN "storyId" TEXT;

CREATE UNIQUE INDEX "CatalogStoryAudioTimings_storyId_key"
  ON "CatalogStoryAudioTimings"("storyId");

ALTER TABLE "CatalogStoryAudioTimings"
  ADD CONSTRAINT "CatalogStoryAudioTimings_storyId_fkey"
  FOREIGN KEY ("storyId") REFERENCES "dp_catalog_stories_v1"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
