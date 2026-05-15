-- Beta tester applications captured from the public /beta form.
-- Admins review at /studio/beta-signups and trigger TestFlight invites manually.

CREATE TABLE "dp_beta_signups_v1" (
    "id"             TEXT         NOT NULL,
    "email"          TEXT         NOT NULL,
    "nativeLanguage" TEXT         NOT NULL,
    "targetLanguage" TEXT         NOT NULL,
    "currentLevel"   TEXT         NOT NULL,
    "hasIPhone"      BOOLEAN      NOT NULL,
    "currentApps"    TEXT,
    "weeklyHours"    TEXT         NOT NULL,
    "referralSource" TEXT,
    "consentedAt"    TIMESTAMP(3) NOT NULL,
    "status"         TEXT         NOT NULL DEFAULT 'pending',
    "notes"          TEXT,
    "invitedAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dp_beta_signups_v1_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dp_beta_signups_v1_email_key"
    ON "dp_beta_signups_v1"("email");

CREATE INDEX "dp_beta_signups_v1_status_idx"
    ON "dp_beta_signups_v1"("status");

CREATE INDEX "dp_beta_signups_v1_createdAt_idx"
    ON "dp_beta_signups_v1"("createdAt");
