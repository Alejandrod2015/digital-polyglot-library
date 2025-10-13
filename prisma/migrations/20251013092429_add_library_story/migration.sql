-- CreateTable
CREATE TABLE "LibraryStory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryStory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryStory_userId_idx" ON "LibraryStory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryStory_userId_storyId_key" ON "LibraryStory"("userId", "storyId");
