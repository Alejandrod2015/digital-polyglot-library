-- Weekly-hours dropped from the public /beta form to reduce friction and
-- boost conversion. Existing rows keep their value; new submissions may omit it.

ALTER TABLE "dp_beta_signups_v1"
    ALTER COLUMN "weeklyHours" DROP NOT NULL;
