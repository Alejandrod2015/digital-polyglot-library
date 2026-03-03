ALTER TABLE "dp_user_stories_v1"
ADD COLUMN "audioStatus" TEXT NOT NULL DEFAULT 'pending';

UPDATE "dp_user_stories_v1"
SET "audioStatus" = CASE
  WHEN "audioUrl" IS NOT NULL AND btrim("audioUrl") <> '' THEN 'ready'
  ELSE 'failed'
END;
