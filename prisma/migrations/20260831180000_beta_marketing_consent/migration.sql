-- Segundo permiso del alta de beta, opcional: ofertas para testers y
-- novedades del producto. Nullable a proposito: null = no lo marco.
-- El modelo BetaSignup mapea a dp_beta_signups_v1.
ALTER TABLE "dp_beta_signups_v1" ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3);
