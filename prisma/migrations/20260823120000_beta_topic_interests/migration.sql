-- Los temas que marca un solicitante en el formulario de beta.
-- Aditiva y con default: las filas que ya existen quedan con el array vacío,
-- que es exactamente lo que son (nunca se les preguntó).
ALTER TABLE "dp_beta_signups_v1"
  ADD COLUMN IF NOT EXISTS "topicInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
