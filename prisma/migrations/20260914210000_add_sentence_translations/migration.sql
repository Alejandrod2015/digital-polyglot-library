-- Traducciones al ingles de la frase de cada palabra, escritas a mano por un
-- chat ejecutor y guardadas por historia.
--
-- Aditiva y sin defecto: la columna nace null en todas las filas y nada la lee
-- hasta que alguien la escribe. El `fill_blank` curado sigue siendo la reserva.
ALTER TABLE "dp_story_practice_sets_v1"
  ADD COLUMN IF NOT EXISTS "sentenceTranslations" JSONB;
