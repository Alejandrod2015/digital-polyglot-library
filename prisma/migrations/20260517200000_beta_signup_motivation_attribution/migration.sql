-- Add new required-going-forward fields and silent attribution JSON.
-- Pre-existing rows will have these NULL; the form validation requires
-- them only for new submissions.
ALTER TABLE "dp_beta_signups_v1"
  ADD COLUMN IF NOT EXISTS "motivation" TEXT,
  ADD COLUMN IF NOT EXISTS "applicationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "attribution" JSONB;
