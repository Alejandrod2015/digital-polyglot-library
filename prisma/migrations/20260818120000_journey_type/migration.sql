-- El TIPO de un journey no se guardaba en ninguna parte.
--
-- POR QUÉ (2026-08-18). Los ocho tipos viven en `dp_journey_types_v1` y el plan
-- de journeys los usa para fijar cuántos personajes fijos lleva, si el orden de
-- temas es obligado y qué son los siete temas. Pero `dp_journeys_v1` no tenía
-- columna para el tipo, así que solo se deducía del NOMBRE. Y el plan exige lo
-- contrario: "el nombre del journey nunca es el tipo", porque el nombre es la
-- promesa al comprador. Con dos journeys ya fuera de esa coincidencia
-- ("Hanseat", "Village Life in Andalusia") el tipo era ilegible.
--
-- Nullable a propósito: los journeys existentes se rellenan en el backfill y
-- los que queden sin tipo tienen que verse, no bloquear.
ALTER TABLE "dp_journeys_v1" ADD COLUMN IF NOT EXISTS "typeSlug" TEXT;

CREATE INDEX IF NOT EXISTS "dp_journeys_v1_typeSlug_idx" ON "dp_journeys_v1"("typeSlug");
