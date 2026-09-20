-- Segundas cuentas de Clerk de un mismo tester (2026-09-20): quien entra por
-- web con su correo y despues por la app iOS con "Hide My Email" de Apple
-- tiene dos cuentas. `clerkUserId` sigue siendo la primera; aqui van las
-- demas, para que el plan beta y la actividad cuenten en todas.
--
-- Aditiva: todas las filas existentes quedan con la lista vacia.
ALTER TABLE "dp_beta_signups_v1"
  ADD COLUMN IF NOT EXISTS "altClerkUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
