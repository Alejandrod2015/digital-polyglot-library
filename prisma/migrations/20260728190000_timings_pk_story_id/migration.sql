-- Segunda mitad de 20260728180000. Con el slug de clave primaria SOLO cabia
-- una fila por slug, y el slug se repite entre libros
-- (`el-vendedor-ambulante` esta en el argentino y en el colombiano): la
-- segunda historia no podia tener timings propios ni aunque se alineara.
-- La clave pasa a ser la historia. Las 139 filas ya tienen storyId
-- (backfill: scripts/backfillTimingStoryIds.ts), asi que NOT NULL es seguro.
-- No se borra ninguna fila.
ALTER TABLE "CatalogStoryAudioTimings" ALTER COLUMN "storyId" SET NOT NULL;

ALTER TABLE "CatalogStoryAudioTimings" DROP CONSTRAINT "CatalogStoryAudioTimings_pkey";
DROP INDEX IF EXISTS "CatalogStoryAudioTimings_storyId_key";
ALTER TABLE "CatalogStoryAudioTimings" ADD CONSTRAINT "CatalogStoryAudioTimings_pkey" PRIMARY KEY ("storyId");

-- El slug deja de ser unico; se indexa para las apps viejas que solo saben
-- pedir por slug.
CREATE INDEX "CatalogStoryAudioTimings_slug_idx" ON "CatalogStoryAudioTimings"("slug");
