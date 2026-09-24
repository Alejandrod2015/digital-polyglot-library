-- Ciudad que ENMARCA cada journey, y en que modo.
--
-- Regla dura del usuario (2026-09-24): la ciudad marco tiene que ser
-- reconocible FUERA de su pais por el publico anglosajon. Hasta hoy ese dato no
-- tenia sitio donde vivir (estaba en 21 textos, en la memoria y en los prompts
-- de portada), y auditarlo costaba tres pasadas sobre toda la base.
--
-- Aditiva y NULLABLE a proposito: NULL significa "nadie lo ha rellenado",
-- distinto de cityMode='multi' (gira de siete sitios) y de cityMode='none'
-- (sin ciudad por decision). Si "no aplica" se guardara como NULL, la
-- distincion se pierde en cuanto alguien mire la columna.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JourneyCityMode') THEN
    CREATE TYPE "JourneyCityMode" AS ENUM ('single', 'multi', 'none');
  END IF;
END
$$;

ALTER TABLE "dp_journeys_v1"
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "cityMode" "JourneyCityMode";
