-- Free-form operator note for the audio editor (manual reminder of what
-- to regenerate/upload). Additive, nullable: safe and non-breaking.
-- IF NOT EXISTS so it's idempotent whether applied surgically now or via
-- `prisma migrate deploy` later.
ALTER TABLE "dp_journey_stories_v1" ADD COLUMN IF NOT EXISTS "audioEditorNote" TEXT;
