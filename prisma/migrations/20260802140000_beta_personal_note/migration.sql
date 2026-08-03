-- A hand-written line rendered inside the acceptance email. Separate from
-- `notes` (internal triage scribbles) on purpose: one is read by the applicant
-- and the other never should be.
ALTER TABLE "dp_beta_signups_v1"
  ADD COLUMN IF NOT EXISTS "personalNote" TEXT;
