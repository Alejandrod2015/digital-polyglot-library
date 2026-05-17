-- Persisted, editorially curated practice exercises per JourneyStory.
-- The mobile end-of-story Practice flow reads from these tables when
-- a set exists for the story, so editors can fix individual exercises
-- in Studio without redeploying.

-- CreateTable
CREATE TABLE "dp_story_practice_sets_v1" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dp_story_practice_sets_v1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dp_story_practice_exercises_v1" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "sentence" TEXT NOT NULL,
    "audioUrl" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dp_story_practice_exercises_v1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dp_story_practice_sets_v1_storyId_key" ON "dp_story_practice_sets_v1"("storyId");

-- CreateIndex
CREATE INDEX "dp_story_practice_exercises_v1_setId_idx" ON "dp_story_practice_exercises_v1"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "dp_story_practice_exercises_v1_setId_orderIndex_key" ON "dp_story_practice_exercises_v1"("setId", "orderIndex");

-- AddForeignKey
ALTER TABLE "dp_story_practice_sets_v1" ADD CONSTRAINT "dp_story_practice_sets_v1_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "dp_journey_stories_v1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dp_story_practice_exercises_v1" ADD CONSTRAINT "dp_story_practice_exercises_v1_setId_fkey" FOREIGN KEY ("setId") REFERENCES "dp_story_practice_sets_v1"("id") ON DELETE CASCADE ON UPDATE CASCADE;
