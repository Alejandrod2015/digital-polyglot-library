-- Resend's id for each send. Without it, "did that email actually arrive?"
-- means listing every email the account ever sent and filtering by address.
ALTER TABLE "dp_beta_email_log_v1"
  ADD COLUMN IF NOT EXISTS "providerId" TEXT;
