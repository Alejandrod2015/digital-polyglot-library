-- Which flavour of the target language the applicant wants. Journeys are
-- variant-scoped, so without this a Spanish learner can be invited into
-- content from the wrong region. Nullable: "not sure" is a valid answer.
ALTER TABLE "dp_beta_signups_v1"
  ADD COLUMN IF NOT EXISTS "targetVariant" TEXT;
