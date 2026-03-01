-- Add context fields for learning-focused favorites
ALTER TABLE "Favorite"
ADD COLUMN IF NOT EXISTS "exampleSentence" TEXT,
ADD COLUMN IF NOT EXISTS "storySlug" TEXT,
ADD COLUMN IF NOT EXISTS "storyTitle" TEXT,
ADD COLUMN IF NOT EXISTS "sourcePath" TEXT,
ADD COLUMN IF NOT EXISTS "language" TEXT;

