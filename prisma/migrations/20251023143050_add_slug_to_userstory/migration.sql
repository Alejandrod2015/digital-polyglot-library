/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `dp_user_stories_v1` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `dp_user_stories_v1` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "dp_user_stories_v1" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "dp_user_stories_v1_slug_key" ON "dp_user_stories_v1"("slug");
