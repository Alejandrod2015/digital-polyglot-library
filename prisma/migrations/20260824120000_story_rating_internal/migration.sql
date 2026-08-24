-- Marca en la propia fila si el pulgar viene de casa.
--
-- Hasta ahora el endpoint escribia igual el voto de un tester y el de un
-- miembro del Studio, y separarlos era cosa de un script suelto
-- (scripts/ratingsTable.ts). Cualquier otra lectura sumaba los dos, que es
-- justo como el 2026-08-21 se reportaron seis pulgares del equipo como si
-- fueran senal de testers.
--
-- Idempotente: se puede reaplicar sin efecto.
ALTER TABLE "dp_story_ratings_v1"
  ADD COLUMN IF NOT EXISTS "internal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "dp_story_ratings_v1_internal_idx"
  ON "dp_story_ratings_v1"("internal");

-- Las filas que ya existen, marcadas contra la misma fuente de verdad que usa
-- el codigo: quien esta dado de alta en el Studio.
UPDATE "dp_story_ratings_v1" r
   SET "internal" = true
  FROM "dp_studio_members" m
 WHERE lower(trim(r."email")) = lower(trim(m."email"))
   AND r."internal" = false;
