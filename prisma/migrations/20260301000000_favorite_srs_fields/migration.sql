-- Add spaced-repetition fields to favorites
ALTER TABLE "Favorite"
ADD COLUMN IF NOT EXISTS "nextReviewAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "streak" INTEGER NOT NULL DEFAULT 0;

