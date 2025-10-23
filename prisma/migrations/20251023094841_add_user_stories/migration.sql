-- CreateTable
CREATE TABLE "dp_user_stories_v1" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "vocab" JSONB NOT NULL,
    "audioUrl" TEXT,
    "language" TEXT NOT NULL,
    "region" TEXT,
    "level" TEXT NOT NULL,
    "focus" TEXT,
    "topic" TEXT NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dp_user_stories_v1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dp_user_stories_v1_userId_idx" ON "dp_user_stories_v1"("userId");

-- CreateIndex
CREATE INDEX "dp_user_stories_v1_createdAt_idx" ON "dp_user_stories_v1"("createdAt");
