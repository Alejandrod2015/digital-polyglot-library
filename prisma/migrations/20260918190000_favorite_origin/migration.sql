-- Origen de cada fila de Favorite: "user" (la guardo el usuario) o
-- "curriculum" (vocabulario de una historia terminada que practico sin
-- guardarla; la fila lleva su repaso y no sale en Favorites).
--
-- Aditiva: todas las filas existentes son "user", que es lo que eran.
ALTER TABLE "Favorite"
  ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'user';
CREATE INDEX IF NOT EXISTS "Favorite_userId_origin_idx" ON "Favorite"("userId", "origin");
