/*
  Warnings:

  - A unique constraint covering the columns `[userId,word]` on the table `Favorite` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "LibraryBook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryBook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryBook_userId_idx" ON "LibraryBook"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryBook_userId_bookId_key" ON "LibraryBook"("userId", "bookId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_word_key" ON "Favorite"("userId", "word");
