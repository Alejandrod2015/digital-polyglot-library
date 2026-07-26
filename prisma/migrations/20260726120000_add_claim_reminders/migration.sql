-- Unredeemed-claim reminder tracking (src/lib/claimReminders.ts).
-- Additive: existing rows default to 0 reminders / no last-reminder timestamp.
ALTER TABLE "dp_claim_tokens_v1" ADD COLUMN "remindersSent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "dp_claim_tokens_v1" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
