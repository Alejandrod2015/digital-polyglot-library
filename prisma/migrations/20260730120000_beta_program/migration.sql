-- Beta program: triage engine, TestFlight state, feedback loop, build notes.
--
-- Everything here is additive. The existing /beta form and
-- /studio/beta-signups keep working untouched while the new columns fill in.

-- ── BetaSignup: fields promoted out of the `attribution` JSON blob, plus the
-- triage / App Store Connect / tester-lifecycle state. ──
ALTER TABLE "dp_beta_signups_v1"
  ADD COLUMN IF NOT EXISTS "firstName"      TEXT,
  ADD COLUMN IF NOT EXISTS "appleIdEmail"   TEXT,
  ADD COLUMN IF NOT EXISTS "socialHandle"   TEXT,
  ADD COLUMN IF NOT EXISTS "platform"       TEXT NOT NULL DEFAULT 'ios',
  ADD COLUMN IF NOT EXISTS "googleEmail"    TEXT,
  ADD COLUMN IF NOT EXISTS "score"          INTEGER,
  ADD COLUMN IF NOT EXISTS "decision"       TEXT,
  ADD COLUMN IF NOT EXISTS "decisionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "decidedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ascTesterId"    TEXT,
  ADD COLUMN IF NOT EXISTS "ascInvitedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ascError"       TEXT,
  ADD COLUMN IF NOT EXISTS "clerkUserId"    TEXT,
  ADD COLUMN IF NOT EXISTS "planGrantedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "planRevokedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastActiveAt"   TIMESTAMP(3);

-- Backfill the promoted columns from the JSON the form has been writing since
-- 2026-05. `->>` returns NULL when the key is absent, which is exactly the
-- value we want for the rows that predate those fields.
UPDATE "dp_beta_signups_v1"
SET
  "firstName"    = COALESCE("firstName",    "attribution" ->> 'firstName'),
  "appleIdEmail" = COALESCE("appleIdEmail", "attribution" ->> 'appleIdEmail'),
  "socialHandle" = COALESCE("socialHandle", "attribution" ->> 'socialHandle')
WHERE "attribution" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "dp_beta_signups_v1_clerkUserId_idx"
  ON "dp_beta_signups_v1" ("clerkUserId");

-- ── Idempotency ledger for the beta lifecycle cron. ──
CREATE TABLE IF NOT EXISTS "dp_beta_email_log_v1" (
  "id"        TEXT NOT NULL,
  "signupId"  TEXT NOT NULL,
  "kind"      TEXT NOT NULL,
  "releaseId" TEXT NOT NULL DEFAULT '',
  "sentAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dp_beta_email_log_v1_pkey" PRIMARY KEY ("id")
);

-- The unique key is what makes the cron safe to run twice in a day.
-- `releaseId` defaults to '' rather than NULL on purpose: Postgres considers
-- NULLs distinct, so a nullable column here would silently allow duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS "dp_beta_email_log_v1_signupId_kind_releaseId_key"
  ON "dp_beta_email_log_v1" ("signupId", "kind", "releaseId");
CREATE INDEX IF NOT EXISTS "dp_beta_email_log_v1_kind_idx"
  ON "dp_beta_email_log_v1" ("kind");

-- ── Build notes. Created before feedback because feedback points at it. ──
CREATE TABLE IF NOT EXISTS "dp_beta_releases_v1" (
  "id"             TEXT NOT NULL,
  "platform"       TEXT NOT NULL DEFAULT 'ios',
  "version"        TEXT NOT NULL,
  "buildNumber"    TEXT NOT NULL,
  "headline"       TEXT NOT NULL,
  "whatsNew"       JSONB NOT NULL,
  "knownIssues"    JSONB,
  "askThem"        TEXT,
  "status"         TEXT NOT NULL DEFAULT 'draft',
  "publishedAt"    TIMESTAMP(3),
  "notifiedCount"  INTEGER NOT NULL DEFAULT 0,
  "createdByEmail" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dp_beta_releases_v1_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dp_beta_releases_v1_platform_buildNumber_key"
  ON "dp_beta_releases_v1" ("platform", "buildNumber");
CREATE INDEX IF NOT EXISTS "dp_beta_releases_v1_status_idx"
  ON "dp_beta_releases_v1" ("status");

-- ── Structured in-app feedback. ──
CREATE TABLE IF NOT EXISTS "dp_beta_feedback_v1" (
  "id"          TEXT NOT NULL,
  "signupId"    TEXT,
  "userId"      TEXT,
  "email"       TEXT NOT NULL,
  "platform"    TEXT NOT NULL,
  "appVersion"  TEXT,
  "buildNumber" TEXT,
  "deviceModel" TEXT,
  "osVersion"   TEXT,
  "screen"      TEXT,
  "kind"        TEXT NOT NULL,
  "rating"      INTEGER,
  "message"     TEXT NOT NULL,
  "context"     JSONB,
  "status"      TEXT NOT NULL DEFAULT 'new',
  "adminNotes"  TEXT,
  "releaseId"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dp_beta_feedback_v1_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dp_beta_feedback_v1_status_idx"    ON "dp_beta_feedback_v1" ("status");
CREATE INDEX IF NOT EXISTS "dp_beta_feedback_v1_createdAt_idx" ON "dp_beta_feedback_v1" ("createdAt");
CREATE INDEX IF NOT EXISTS "dp_beta_feedback_v1_email_idx"     ON "dp_beta_feedback_v1" ("email");
CREATE INDEX IF NOT EXISTS "dp_beta_feedback_v1_releaseId_idx" ON "dp_beta_feedback_v1" ("releaseId");

-- Deleting a signup (spam cleanup) must not take its feedback or block the
-- delete, so the feedback link is SET NULL while the email ledger cascades.
ALTER TABLE "dp_beta_email_log_v1"
  DROP CONSTRAINT IF EXISTS "dp_beta_email_log_v1_signupId_fkey";
ALTER TABLE "dp_beta_email_log_v1"
  ADD CONSTRAINT "dp_beta_email_log_v1_signupId_fkey"
  FOREIGN KEY ("signupId") REFERENCES "dp_beta_signups_v1" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dp_beta_feedback_v1"
  DROP CONSTRAINT IF EXISTS "dp_beta_feedback_v1_signupId_fkey";
ALTER TABLE "dp_beta_feedback_v1"
  ADD CONSTRAINT "dp_beta_feedback_v1_signupId_fkey"
  FOREIGN KEY ("signupId") REFERENCES "dp_beta_signups_v1" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dp_beta_feedback_v1"
  DROP CONSTRAINT IF EXISTS "dp_beta_feedback_v1_releaseId_fkey";
ALTER TABLE "dp_beta_feedback_v1"
  ADD CONSTRAINT "dp_beta_feedback_v1_releaseId_fkey"
  FOREIGN KEY ("releaseId") REFERENCES "dp_beta_releases_v1" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
