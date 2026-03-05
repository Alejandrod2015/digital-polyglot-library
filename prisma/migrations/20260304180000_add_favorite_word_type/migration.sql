-- Add grammatical category for vocabulary practice filters
ALTER TABLE "Favorite"
ADD COLUMN IF NOT EXISTS "wordType" TEXT;

CREATE INDEX IF NOT EXISTS "Favorite_userId_wordType_idx" ON "Favorite"("userId", "wordType");
