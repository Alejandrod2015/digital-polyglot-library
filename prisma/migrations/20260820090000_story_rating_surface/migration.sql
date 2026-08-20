-- Separa el pulgar de la historia del pulgar de su practica. Son dos preguntas
-- distintas y hasta ahora compartian fila: valorar la practica sobrescribia la
-- valoracion de la historia.
ALTER TABLE "dp_story_ratings_v1" ADD COLUMN "surface" TEXT NOT NULL DEFAULT 'story';

DROP INDEX IF EXISTS "dp_story_ratings_v1_userId_storySlug_key";

CREATE UNIQUE INDEX "dp_story_ratings_v1_userId_storySlug_surface_key"
  ON "dp_story_ratings_v1"("userId", "storySlug", "surface");

CREATE INDEX "dp_story_ratings_v1_surface_idx" ON "dp_story_ratings_v1"("surface");
