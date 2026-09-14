-- Respuesta personal a un reporte de feedback, enviada desde Studio.
-- Aditiva e idempotente: cuatro columnas nulas, no toca nada existente.
-- Se aplica con scripts/_applyBetaMigration.ts (prisma migrate deploy no
-- puede tomar su lock contra la URL pooled de Neon).
ALTER TABLE "dp_beta_feedback_v1" ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3);
ALTER TABLE "dp_beta_feedback_v1" ADD COLUMN IF NOT EXISTS "replySubject" TEXT;
ALTER TABLE "dp_beta_feedback_v1" ADD COLUMN IF NOT EXISTS "replyText" TEXT;
ALTER TABLE "dp_beta_feedback_v1" ADD COLUMN IF NOT EXISTS "replyProviderId" TEXT;
